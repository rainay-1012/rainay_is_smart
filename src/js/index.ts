import "bootstrap-icons/font/bootstrap-icons.css";
import $ from "jquery";
import "jquery-blockui";
import "../style/custom_theme.scss";
import { getCurrentUserToken, validateToken } from "./auth";
import { initDashboard } from "./dashboard";
import { initDeveloper } from "./dev_dashboard";
import { initItemPage } from "./item";
import { initLogin } from "./login";
import { initProcurement } from "./procurement";
import { initProfile } from "./profile";
import { initRegister } from "./register";
import { initReport } from "./report";
import { initVendor } from "./vendor";

export interface GeneralResponse {
  name: string;
  message: string;
}

export interface ContentResponse extends GeneralResponse {
  code: number;
  content: string;
}

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function blockElement(
  element: HTMLElement | string,
  {
    opacity = 1,
    type = "border", // New field: type
    small = false,
    primary = true,
    zIndex = 10000,
  }: {
    opacity?: number;
    type?: "grow" | "border" | "bar"; // Accepts "grow", "border", or "bar"
    small?: boolean;
    primary?: boolean;
    zIndex?: number;
  } = {}
) {
  const $element = $(element as any);

  // Spinner configuration
  const spinnerSizeClass = small ? "spinner-border-sm" : "";
  const spinnerColorClass = primary ? "text-primary" : "text-primary-emphasis";
  const spinnerType =
    type === "grow"
      ? "spinner-grow"
      : type === "border"
      ? "spinner-border"
      : "";

  if (type === "bar") {
    $element.addClass("container-loading-bar");
    $element.block({
      message: null,
      overlayCSS: {
        backgroundColor: "#f8f9fa",
        opacity: opacity,
        zIndex: zIndex - 1,
      },
      css: {
        border: "none",
        backgroundColor: "transparent",
        cursor: "wait",
        zIndex: zIndex,
      },
    });
  } else {
    $element.block({
      message: `
      <div class="${spinnerType} ${spinnerSizeClass} ${spinnerColorClass}" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>`,
      centerX: false,
      centerY: false,
      overlayCSS: {
        backgroundColor: "#f8f9fa",
        opacity: opacity,
        zIndex: zIndex - 1,
      },
      css: {
        border: "none",
        backgroundColor: "transparent",
        cursor: "wait",
        zIndex: zIndex,
        top: `calc(50% - ${(small ? 1 : 2) / 2}rem - 0.125rem)`,
        left: `calc(50% - ${(small ? 1 : 2) / 2}rem)`,
        width: "auto",
        height: "auto",
      },
    });
  }

  // $element.css("pointer-events", "none");
  // $element.prop("disabled", true);
}

export function unblockElement(element: HTMLElement | string) {
  const $element = $(element as any);
  $element.unblock();
  $element.removeClass("container-loading-bar");
  $element.css("pointer-events", "auto");
  $element.prop("disabled", false);
}

export function withBlock<T>(
  element: HTMLElement | string,
  blockParams: {
    opacity?: number;
    type?: "grow" | "border" | "bar";
    small?: boolean;
    primary?: boolean;
    zIndex?: number;
  } = {}
): (target: (...args: any[]) => Promise<T>) => (...args: any[]) => Promise<T> {
  // The main function to handle blocking and unblocking
  const applyBlock = (
    target: (...args: any[]) => Promise<T>
  ): ((...args: any[]) => Promise<T>) => {
    return async (...args: any[]) => {
      try {
        blockElement(element, blockParams);
        return await target(...args);
      } finally {
        unblockElement(element);
      }
    };
  };

  // Return a function that wraps the target
  return (target: (...args: any[]) => Promise<T>) => applyBlock(target);
}

export enum AlertType {
  SUCCESS = "success",
  DANGER = "danger",
  WARNING = "warning",
  INFO = "info",
}

export function showAlert(
  alertMessage: string,
  {
    element = "body",
    type = AlertType.INFO,
    position = "prepend",
    animated = true,
    timeout = 5000,
  } = {}
) {
  if (!Object.values(AlertType).includes(type)) {
    console.error(`Invalid alert type: ${type}`);
    return;
  }

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible mb-0`;
  if (animated) alertDiv.classList.add("show");

  alertDiv.setAttribute("role", "alert");
  alertDiv.innerHTML = `
    ${alertMessage}
    <button type="button" class="btn-close" aria-label="Close"></button>
  `;

  const elm = $(element);

  if (position === "fixed-top") {
    alertDiv.style.position = "fixed";
    alertDiv.style.top = "0";
    alertDiv.style.left = "0";
    alertDiv.style.width = "100%";
    alertDiv.style.zIndex = "1050";
    elm.append(alertDiv);
  } else {
    elm.prepend(alertDiv);
  }

  const $alertDiv = $(alertDiv);

  if (animated) {
    $($alertDiv).slideDown(300);
  } else {
    $($alertDiv).show();
  }

  $alertDiv.find(".btn-close").on("click", function () {
    if (animated) {
      $alertDiv.slideUp(300, () => $alertDiv.remove()); // Slide up animation
    } else {
      $alertDiv.remove();
    }
  });

  setTimeout(() => {
    if (animated) {
      $($alertDiv).slideUp(300, () => $($alertDiv).remove());
    } else {
      $($alertDiv).remove();
    }
  }, timeout);
}

type InitFunction = () => Promise<any>;

interface Route {
  path: string;
  destination: string;
  init?: InitFunction;
  parent?: string;
}

export const routes = {
  default: {
    path: "/",
    destination: "main",
  },
  login: {
    path: "/login",
    destination: "main",
    init: initLogin,
  },
  register: {
    path: "/register",
    destination: "main",
    init: initRegister,
  },
  developer: {
    path: "/developer_dashboard",
    destination: "main",
    init: initDeveloper,
  },
  dashboard: {
    path: "/dashboard",
    destination: "main",
    init: initDashboard,
  },
  profile: {
    path: "/dashboard/profile",
    destination: "#content",
    parent: "dashboard",
    init: initProfile,
  },
  procurement: {
    path: "/dashboard/procurement",
    destination: "#content",
    parent: "dashboard",
    init: initProcurement,
  },
  item: {
    path: "/dashboard/item",
    destination: "#content",
    parent: "dashboard",
    init: initItemPage,
  },
  vendor: {
    path: "/dashboard/vendor",
    destination: "#content",
    parent: "dashboard",
    init: initVendor,
  },
  report: {
    path: "/dashboard/report",
    destination: "#content",
    parent: "dashboard",
    init: initReport,
  },
} as const satisfies Record<string, Route>;

let currentRoute: Route;
let disposers: any[] = [];

export function getRouteFromPath(path: string) {
  for (const value of Object.values(routes)) {
    if (value.path === path) {
      return value;
    }
  }
  console.error(`Invalid pathname ${path} (not within routes)`);
  return routes.default;
}

export function getCurrentRoute() {
  return currentRoute;
}

function getRouteChain(route: Route) {
  const chain = [route];

  while (route && route.parent) {
    route = routes[route.parent as keyof typeof routes];
    chain.unshift(route);
  }

  return chain;
}

function findCommonParent(curChain: Route[], destChain: Route[]) {
  let commonIndex = -1;
  for (let i = 0; i < Math.min(curChain.length, destChain.length); i++) {
    if (curChain[i] === destChain[i]) {
      commonIndex = i;
    } else {
      break;
    }
  }
  return commonIndex;
}

async function waitForAssetsToLoad(container: JQuery<HTMLElement>) {
  const assetPromises: Promise<any>[] = [];

  container.find("img").each(function (idx, elm) {
    const img = $(elm);
    const promise = new Promise<void>((resolve, reject) => {
      img.on("load", () => resolve());
      img.on("error", () => reject(new Error("Image failed to load")));
    });
    assetPromises.push(promise);
  });

  await Promise.allSettled(assetPromises);
}

async function fetchContent(route: Route): Promise<ContentResponse> {
  try {
    const response = await fetch(route.path, {
      method: "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Authorization: `Bearer ${await getCurrentUserToken()}`,
      },
    });

    if (!response.ok) {
      const errorResponse: ContentResponse = await response.json();
      return errorResponse;
    }

    const contentResponse = await response.json();
    console.log(contentResponse);
    return contentResponse;
  } catch (error) {
    console.error(error);
    return {
      name: "Client Error",
      message: "There was an issue processing the request on the client side.",
      code: 400,
      content: "<h1>Client Error: Invalid Request</h1>",
    };
  }
}

export async function replaceContent(
  content: string | HTMLElement,
  destination: string | HTMLElement
) {
  const tempContainer = $("<div>").html(content);
  await waitForAssetsToLoad(tempContainer);
  const destContent = destination;
  $(destContent as any).replaceWith(tempContainer.html());
}

export function updateHistoryState(
  currentPath: string,
  replace: boolean,
  historyData?: {
    route: string;
    blockParams: Record<string, unknown>;
  },
  pop?: boolean
) {
  if (pop) {
    return;
  }

  if (replace) {
    history.replaceState(null, "", currentPath);
  } else {
    history.pushState(historyData, "", currentPath);
  }
}

export async function navigate(
  route: Route,
  {
    pop = false,
    blockParams = {},
    replace = false,
    alert = "",
    alertParams = {},
  } = {}
) {
  const curChain = getRouteChain(currentRoute);
  const destChain = getRouteChain(route);
  const commonIndex = findCommonParent(curChain, destChain);
  const topParent = destChain[commonIndex + 1]?.destination;

  await withBlock(
    topParent,
    blockParams
  )(async () => {
    try {
      for (let i = disposers.length - 1; i > commonIndex; i--) {
        if (disposers[i]) {
          disposers[i]!();
          disposers[i] = null;
        }
      }
      disposers = disposers.slice(0, commonIndex + 1);

      currentRoute = route;
      for (let i = commonIndex + 1; i < destChain.length; i++) {
        const route = destChain[i];
        const response = await fetchContent(route);
        await replaceContent(response.content, route.destination);
        if (response.code >= 400) {
          return;
        }

        if (typeof route.init === "function") {
          disposers[i] = await route.init();
        } else {
          disposers[i] = null;
        }
      }

      updateHistoryState(
        route.path,
        replace,
        {
          route: currentRoute.path,
          blockParams: blockParams,
        },
        pop
      );
    } catch (error) {
      console.error("Error during navigation:", error);
    } finally {
      if (alert) {
        showAlert(alert, alertParams);
      }
    }
  })();
}

$(async function () {
  window.onpopstate = async (event) => {
    console.log("pop");
    const state = event.state || {};
    const { route = window.location.pathname, blockParams = {} } = state;

    await navigate(getRouteFromPath(route), {
      pop: true,
      blockParams,
    });
  };

  let route;
  let alert;
  let alertParams;

  if (window.location.pathname === "/" || window.location.pathname === "") {
    const userToken = await getCurrentUserToken();
    if (userToken) {
      try {
        const data = await validateToken(userToken);
        route = getRouteFromPath(data.redirect);
      } catch (error) {
        if (error instanceof Error) {
          console.trace(error);
        } else {
          const err = error as ContentResponse;
          route = routes.login;
          alert = `${err.name} : ${err.message}`;
          alertParams = {
            type: AlertType.DANGER,
            position: "fixed-top",
          };
        }
      }
    } else {
      route = routes.login;
    }
  } else {
    route = getRouteFromPath(window.location.pathname);
  }

  await navigate(route!, {
    replace: true,
    blockParams: {
      grow: true,
    },
    alert: alert,
    alertParams: alertParams,
  });
});

export function simulateAsyncRequest(time: number, data = null) {
  return new Promise((resolve, reject) => {
    if (time < 0) {
      return reject(new Error("Invalid time parameter"));
    }

    setTimeout(() => {
      resolve(data);
    }, time);
  });
}
