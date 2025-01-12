import { io, Socket } from "socket.io-client";
import { getCurrentUserToken } from "./auth";

type EventType = "modify" | "delete" | "add" | "change" | "reconnect";

interface EventPayload {
  uid: string;
  dtype: any;
  type: EventType;
  data: any;
}

export class SocketDataManager {
  private static instance: SocketDataManager | null = null;
  private socket: Socket;
  private namespace: string = "/data";
  private dataKeys: string[] = [];
  private eventCallbacks: { [key: string]: { [event: string]: Function } } = {};
  private urlMap: { [key: string]: string } = {}; // Maps data keys to URLs
  private dataCache: { [key: string]: any } = {}; // Cache for initial data
  private authenticated: boolean;
  private reconnecting: boolean = false;

  private constructor(token: string) {
    if (!token) {
      throw new Error("User token is required");
    }

    this.authenticated = true;
    this.socket = io(this.namespace, {
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      path: "/socket.io",
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    this.setupEventListeners();
  }

  public static async getOrCreateInstance(
    urlMap: { [key: string]: string } = {}
  ): Promise<SocketDataManager> {
    if (!SocketDataManager.instance) {
      const token = await getCurrentUserToken();
      SocketDataManager.instance = new SocketDataManager(token!);
    }
    if (Object.keys(urlMap).length > 0) {
      await SocketDataManager.instance.updateConfig(urlMap);
    }
    return SocketDataManager.instance;
  }

  public static getInstance(): SocketDataManager | null {
    return SocketDataManager.instance;
  }

  public async updateConfig(newUrlMap: {
    [key: string]: string;
  }): Promise<void> {
    if (Object.keys(newUrlMap).length === 0) {
      throw new Error("URL map cannot be empty.");
    }

    const newKeys = Object.keys(newUrlMap);
    const token = await getCurrentUserToken();

    await new Promise<void>((resolve, reject) => {
      this.socket.emit("update-keys", newKeys, async (response: any) => {
        try {
          if (response.error) {
            console.error("Failed to update keys:", response.error);
            reject(
              new Error(
                "Failed to update data keys. Configuration not changed."
              )
            );
            return;
          }

          console.log("Successfully subscribed to new keys:", newKeys);
          this.urlMap = newUrlMap;
          this.dataKeys = newKeys;
          await this.fetchAllInitialData(token!);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private setupEventListeners(): void {
    this.socket.on("connect", async () => {
      console.log("Connected to server with token.");
      if (!this.authenticated) {
        this.reconnecting = true;
        const token = await getCurrentUserToken();
        this.socket.io.opts.extraHeaders = {
          Authorization: `Bearer ${token}`,
        };
        this.socket.disconnect().connect();
        this.authenticated = true;
        this.reconnecting = false;
        await this.updateConfig(this.urlMap);
        console.log("Re-authenticated with the latest token.");

        for (const datakey of this.dataKeys) {
          if (
            this.eventCallbacks[datakey] &&
            this.eventCallbacks[datakey]["reconnect"]
          ) {
            try {
              this.eventCallbacks[datakey]["reconnect"](
                null,
                null,
                this.dataCache[datakey] || null,
                datakey,
                "reconnect"
              );
            } catch (error) {
              console.error(
                `Error in reconnect callback for datakey "${datakey}":`,
                error
              );
            }
          }
        }
      }
    });

    this.socket.on("disconnect", () => {
      console.warn("Socket disconnected from server");
      if (!this.reconnecting) this.authenticated = false;
    });

    this.socket.on("error", (error: string) => {
      console.error("Socket error:", error);
    });

    this.socket.on("unauthorized", (message: string) => {
      throw new Error(`Unauthorized access. ${message}`);
    });
  }

  private async fetchAllInitialData(token: string): Promise<void> {
    for (const key of this.dataKeys) {
      try {
        this.dataCache[key] = await this.fetchInitialData(token, key);
        console.log(`Initial data loaded for ${key}:`, this.dataCache[key]);
      } catch (error) {
        console.error(`Failed to fetch initial data for ${key}:`, error);
      }
    }
  }

  public async fetchInitialData(token: string, dataKey: string): Promise<any> {
    const url = this.urlMap[dataKey];
    if (!url) {
      throw new Error(`No URL mapped for data key: ${dataKey}`);
    }

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok)
        throw new Error(`Failed to fetch initial data for ${dataKey}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching initial data for ${dataKey}:`, error);
      throw error;
    }
  }

  public setEventCallback(
    dataKey: string,
    eventType: EventType,
    callback: Function
  ): void {
    if (!this.eventCallbacks[dataKey]) {
      this.eventCallbacks[dataKey] = {};
    }
    this.eventCallbacks[dataKey][eventType] = callback;
  }

  public subscribe(): void {
    this.socket.on("data-change", (payload: EventPayload) => {
      const { uid, dtype, type, data } = payload;

      if (uid && dtype && type && data) {
        const d = JSON.parse(data);
        switch (type) {
          case "modify":
            if (this.dataCache[dtype]) {
              const updatedItem = d;
              this.updateCache(dtype, updatedItem);
            }
            break;

          case "delete":
            if (this.dataCache[dtype]) {
              const itemId = d.id;
              this.deleteFromCache(dtype, itemId);
            }
            break;

          case "add":
            if (this.dataCache[dtype]) {
              const newItem = d;
              this.addToCache(dtype, newItem);
            }
            break;

          default:
            console.error(`Unhandled data change type: ${type}`);
            break;
        }

        const eventKey = `${dtype}:${type}`;
        const event = new CustomEvent(eventKey, {
          detail: { uid, dtype, type, data: d },
        });
        window.dispatchEvent(event);

        if (this.eventCallbacks[dtype] && this.eventCallbacks[dtype][type]) {
          this.eventCallbacks[dtype][type](
            uid,
            d,
            this.dataCache[dtype],
            dtype,
            type
          );
        }

        console.log(this.eventCallbacks[dtype]["change"]);
        if (
          this.eventCallbacks[dtype] &&
          this.eventCallbacks[dtype]["change"]
        ) {
          this.eventCallbacks[dtype]["change"](
            uid,
            d,
            this.dataCache[dtype],
            dtype,
            type
          );
        }
      } else {
        console.error("Invalid payload structure:", payload);
      }
    });
  }

  public getDataCache(dtype: string): any {
    if (this.dataCache[dtype]) {
      return this.dataCache[dtype];
    } else {
      console.warn(`No data found in cache for dtype: ${dtype}`);
      return null; // Return null or an empty array if no data is found for the key
    }
  }

  // Helper methods to update, delete, and modify the cache
  private updateCache(dtype: string, updatedItem: any): void {
    const existingData = this.dataCache[dtype];
    if (existingData && Array.isArray(existingData)) {
      const index = existingData.findIndex(
        (item: any) => item.id === updatedItem.id
      );
      if (index !== -1) {
        // Update the item in the array
        existingData[index] = updatedItem;
      }
    } else {
      console.warn(`No data found in cache for dtype: ${dtype}`);
    }
  }

  private deleteFromCache(dtype: string, itemId: string): void {
    const existingData = this.dataCache[dtype];
    if (existingData && Array.isArray(existingData)) {
      const index = existingData.findIndex((item: any) => item.id === itemId);
      if (index !== -1) {
        // Remove the item from the array
        existingData.splice(index, 1);
      }
    } else {
      console.warn(`No data found in cache for dtype: ${dtype}`);
    }
  }

  private addToCache(dtype: string, newItem: any): void {
    const existingData = this.dataCache[dtype];
    if (existingData && Array.isArray(existingData)) {
      existingData.push(newItem);
    } else {
      console.warn(`No data found in cache for dtype: ${dtype}`);
    }
  }

  public unsubscribe(): void {
    this.socket.off("data-change");
  }

  public disconnect(): void {
    this.socket.disconnect();
  }
}
