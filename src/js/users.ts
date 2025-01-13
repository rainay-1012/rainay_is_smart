import { Modal } from "bootstrap";
import DataTable from "datatables.net-bs5";


import Joi from "joi";
import "jszip";
import "pdfmake";
import "pdfmake/build/vfs_fonts.js";
import { initInput } from ".";
import "../assets/logo only.svg";
import "../style/dev_dashboard.scss";
import { getCurrentUser, getCurrentUserToken } from "./auth";
import { SocketDataManager } from "./socket";
import {
  assert,
  FormValidator,
  mapToElement,
  MessageType,
  showMessage,
  TableAction,
  withBlock,
} from "./utils";

const defaultUserImage =
  "https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg";

export async function getUserPhotoURL({
  uid,
  photoURL,
}: {
  uid: string;
  photoURL: string | null;
}): Promise<string> {
  const cachedImage = sessionStorage.getItem(`photoData-${uid}`);
  console.log(cachedImage);

  if (cachedImage) {
    return cachedImage;
  }

  const url = photoURL ?? defaultUserImage;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image data"));
      reader.readAsDataURL(blob);
    });

    sessionStorage.setItem(`photoData-${uid}`, base64Image);

    return base64Image;
  } catch (error) {
    console.error("Error fetching or caching image:", error);
    return defaultUserImage;
  }
}

export async function initUsers() {
  await withBlock("#content", {
    opacity: 0.5,
    primary: true,
  })(async () => {
    initInput();
    const dataManager = await SocketDataManager.getOrCreateInstance({
      users: "/get_users_data",
    });

    let initialData = [];

    initialData = dataManager.getDataCache("users");

    dataManager?.subscribe();

    dataManager?.setEventCallback(
      "item",
      "add",
      (
        uid: string,
        data: any,
        dataset: any,
        dataType: string,
        eventType: string
      ) => {
        userTable.row.add(data).draw();
      }
    );

    dataManager?.setEventCallback(
      "users",
      "delete",
      (
        uid: string,
        data: any,
        dataset: any,
        dataType: string,
        eventType: string
      ) => {
        userTable.row(`#${data.id}`).remove().draw();
      }
    );

    dataManager?.setEventCallback(
      "users",
      "modify",
      (
        uid: string,
        data: any,
        dataset: any,
        dataType: string,
        eventType: string
      ) => {
        let d = userTable.row(`#${data.id}`).data();
        Object.assign(d, data);
        userTable.row(`#${data.id}`).invalidate().draw();
      }
    );

    dataManager?.setEventCallback(
      "users",
      "change",
      (uid: string, dataType: string, eventType: string) => {
        userTable.responsive.recalc();
        if (uid !== getCurrentUser()?.uid) {
          showMessage(
            `Data of type ${dataType} has been altered. Alter type: ${eventType}`,
            {
              mode: "toast",
              position: "bottom-right",
            }
          );
        }
      }
    );

    const userElm = document.querySelector("#user-table");

    //@ts-ignore
    $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";

    if (!userElm) {
      console.log(`User table elm: ${userElm}`);
      return;
    }

    const userFormElm = document.getElementById("user-form");

    assert(
      userFormElm instanceof HTMLFormElement,
      "User modal undefined or not Element"
    );

    const userModal = new Modal(userFormElm);

    // const data = initialData.data;

    // if (Array.isArray(data)) {
    //   await preFetchAndCacheImages(data);
    // } else {
    //   console.error('Data is not iterable:', data);
    // }

    async function preFetchAndCacheImages(data: any) {
      for (const row of data) {
        if (row.photo) {
          await getUserPhotoURL({ uid: row.id, photoURL: row.photo });
        }
      }
    }
    console.log(initialData);
    await preFetchAndCacheImages(initialData);

    const userTable = new DataTable(userElm, {
      rowId: "id",
      layout: {
        topStart: {
          buttons: [
            TableAction.generateExportButtonConfig({ columns: [1, 3, 4, 5] }),
          ],
        },
      },

      order: [[1, "asc"]],
      processing: true,
      serverSide: false,
      responsive: true,
      paging: true,
      pageLength: 5,
      lengthChange: false,
      searching: true,
      ordering: true,
      columns: [
        {
          data: "id",
          title: "ID",
          // @ts-ignore
          render: DataTable.render.ellipsis(10, true),
        },
        {
          data: "photo",
          title: "Photo",
          orderable: false,
          render: function (data, _, row) {
            const cachedImage = sessionStorage.getItem(`photoData-${row.id}`);
            const photoUrl = cachedImage || defaultUserImage;

            return `
            <img src="${photoUrl}" 
              alt="User Photo" 
              class="rounded-circle object-fit-cover border shadow-1-strong" 
              width="36" 
              height="36"/>
          `;
          },
        },
        { data: "username", title: "Username" },
        { data: "email", title: "Email" },
        {
          data: "role",
          title: "Role",
          className: "text-capitalize",
        },
        { data: "name", title: "Full Name", defaultContent: "N/A" },
        { data: "phoneNo", title: "Phone No.", defaultContent: "N/A" },
        {
          data: "date",
          title: "Date",
          //@ts-ignore
          render: DataTable.render.intlDateTime("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        },
        {
          data: null,
          title: "Action",
          orderable: false,
          className: "all",
          render: function (data: any) {
            return `
              ${TableAction.generateActionHTML({
                type: "edit",
                className: "edit-icon",
              })} 
              ${TableAction.generateActionHTML({
                type: "delete",
                className: "delete-icon",
              })}
            `;
          },
        },
      ],
      initComplete: (settings, json) => {
        const table = settings.oInstance.api();
        table.rows.add(Object.values(initialData)).draw();

        TableAction.attachListeners({
          selector: "tr .edit-icon",
          table: table,
          callback(this, event, d) {
            const cachedImage = sessionStorage.getItem(`photoData-${d.id}`);
            const photoUrl = cachedImage || defaultUserImage;
            console.log(d);
            const formatter = new Intl.DateTimeFormat("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            mapToElement([
              { selector: "#user-id", value: d.id },
              { selector: "#user-photo", attribute: { src: photoUrl } },
              {
                selector: "#user-form input[name='name']",
                value: d.name ?? "",
              },
              {
                selector: "#user-form input[name='username']",
                value: d.username ?? "",
              },
              {
                selector: "#user-form input[name='phoneNo']",
                value: d.phoneNo ?? "",
              },
              { selector: "#user-email", value: d.email },
              { selector: "#user-form select[name='role']", value: d.role },
              {
                selector: "#user-date",
                value: formatter.format(new Date(d.date)),
              },
              { selector: "#user-form input[name=uid]", value: d.id },
            ]);

            userModal.show();
          },
        });

        TableAction.attachListeners({
          selector: "tr .delete-icon",
          table: table,
          callback: async function (this: HTMLElement, event, d) {
            const apiRequestCallback = TableAction.createApiRequestCallback({
              message: "Are you sure you want to delete this user?",
              url: `/delete_user/${d.id}`,
              method: "DELETE",
              token: (await getCurrentUserToken())!,
            });
            await apiRequestCallback();
          },
        });
      },
    });

    const userFormValidator = new FormValidator(
      Joi.object({
        uid: Joi.string().allow("").optional(),
        role: Joi.string()
          .valid("admin", "executive", "manager")
          .required()
          .messages({
            "any.only": "Role must be one of admin, manager, or executive.",
            "string.empty": "Role is required.",
            "any.required": "Role cannot be empty.",
          }),
        name: Joi.string().required().messages({
          "string.empty": "Fullname is required.",
          "any.required": "Fullname cannot be empty.",
        }),
        username: Joi.string().required().messages({
          "string.empty": "Username is required.",
          "any.required": "Username cannot be empty.",
        }),
        phoneNo: Joi.string()
          .pattern(/^\+[1-9]\d{1,14}$/)
          .required()
          .messages({
            "string.pattern.base":
              "Phone number must be in a valid international format (e.g., +1234567890).",
            "string.empty": "Phone number is required.",
            "any.required": "Phone number cannot be empty.",
          }),
      }),
      userFormElm
    );

    userFormValidator.attachValidation();

    const onUserFormSubmit = async (evt: SubmitEvent) => {
      evt.preventDefault();

      const data = userFormValidator.validateForm();
      if (!data) return;

      withBlock(userFormElm, {
        opacity: 0.5,
        type: "border",
        primary: true,
      })(async () => {
        try {
          const response = await fetch("/update_user", {
            headers: {
              Authorization: `Bearer ${await getCurrentUserToken()}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            throw await response.json();
          }
          await getCurrentUser()?.reload();
          showMessage("Your profile information has been updated.", {
            mode: "toast",
            type: MessageType.SUCCESS,
          });
        } catch (e: any) {
          showMessage(e.message, {
            mode: "toast",
            type: MessageType.DANGER,
          });
        } finally {
          userModal.hide();
          userFormValidator.resetForm();
          const user = getCurrentUser();
          if (data.uid === user?.uid) {
            await user?.reload();
          }
        }
      })();
    };

    userFormElm.addEventListener("submit", onUserFormSubmit);

    return new Promise<() => void>((resolve) => {
      resolve(() => {
        dataManager?.unsubscribe();
        userTable.destroy();
        userFormElm.removeEventListener("submit", onUserFormSubmit);
      });
    });
  })();
}
