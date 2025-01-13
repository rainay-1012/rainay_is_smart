import "bootstrap-icons/font/bootstrap-icons.css";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons-bs5/css/buttons.bootstrap5.min.css";
import "datatables.net-buttons/js/buttons.html5.min.js";
import "datatables.net-buttons/js/buttons.print.min.js";
import "datatables.net-plugins/dataRender/ellipsis.mjs";
import "datatables.net-plugins/dataRender/intl.mjs";
import "datatables.net-plugins/sorting/file-size.mjs";
import "datatables.net-plugins/type-detection/file-size.mjs";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import "dropzone/dist/dropzone.css";
import $ from "jquery";
import "jquery-blockui";
import { initAccount } from "./account";
import { getCurrentUserToken, validateToken } from "./auth";
import { initDashboard } from "./dashboard";
import { initItemPage } from "./item";
import { initProcurement } from "./procurement";
// import { initQuotation } from "./quotation";
import "../style/custom_theme.scss";
import { initReport } from "./report";
import { initUserManual } from "./user_manual";
import { initVendor } from "./vendor";
// @ts-ignore
import {
  Carousel,
  Collapse,
  Dropdown,
  initMDB,
  Input,
  Modal,
  Offcanvas,
  Ripple,
} from "mdb-ui-kit";
import { initQuotation } from "./quotation";
import { initUsers } from "./users";
import { MessageType, showMessage, withBlock } from "./utils";

export interface Response {
  code: string;
  message: string;
  [key: string]: any;
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
  account: {
    path: "/account",
    destination: "main",
    init: initAccount,
  },

  dashboard: {
    path: "/dashboard",
    destination: "main",
    init: initDashboard,
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
  quotation: {
    path: "/dashboard/quotation",
    destination: "#content",
    parent: "dashboard",
    init: initQuotation,
  },
  report: {
    path: "/dashboard/report",
    destination: "#content",
    parent: "dashboard",
    init: initReport,
  },
  users: {
    path: "/dashboard/users",
    destination: "#content",
    parent: "dashboard",
    init: initUsers,
  },
  user_manual: {
    path: "/dashboard/user_manual",
    destination: "main",
    init: initUserManual,
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

async function fetchContent(route: Route): Promise<string> {
  try {
    const response = await fetch(route.path, {
      method: "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Authorization: `Bearer ${await getCurrentUserToken()}`,
      },
    });

    if (!response.ok) {
      const errorResponse: Response = await response.json();
      console.log(errorResponse);
      throw errorResponse;
    }

    const contentResponse = await response.text();
    return contentResponse;
  } catch (error) {
    throw error;
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
  { pop = false, replace = false, alert = "", alertParams = {} } = {}
) {
  const curChain = getRouteChain(currentRoute);
  const destChain = getRouteChain(route);
  const commonIndex = findCommonParent(curChain, destChain);

  try {
    await withBlock(destChain[Math.max(0, commonIndex + 1)].destination, {
      type: "border",
      primary: true,
    })(async () => {
      for (let i = disposers.length - 1; i > commonIndex; i--) {
        if (disposers[i]) {
          await disposers[i]!();
          disposers[i] = null;
        }
      }
      disposers = disposers.slice(0, commonIndex + 1);

      currentRoute = route;
      for (let i = commonIndex + 1; i < destChain.length; i++) {
        const route = destChain[i];

        const response = await fetchContent(route);

        await replaceContent(
          new DOMParser()
            .parseFromString(response, "text/html")!
            .querySelector(route.destination)?.outerHTML!,
          route.destination
        );

        if (typeof route.init === "function") {
          console.log(route);
          disposers[i] = await route.init();
        } else {
          disposers[i] = null;
        }
      }
    })();

    updateHistoryState(
      route.path,
      replace,
      {
        route: currentRoute.path,
      },
      pop
    );
  } catch (error) {
    console.error("Error during navigation:", error);
    await replaceContent(
      "<h1>Unexpected error occured. Please try again</h1>",
      route.destination
    );
  } finally {
    if (alert) {
      showMessage(alert, alertParams);
    }
  }
}

$(async function () {
  await withBlock("main", {
    type: "grow",
    primary: true,
  })(async () => {
    window.onpopstate = async (event) => {
      console.log("pop");
      const state = event.state || {};
      const { route = window.location.pathname } = state;

      await navigate(getRouteFromPath(route), {
        pop: true,
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
          if (error instanceof Response) {
            console.trace(error);
          } else {
            const err = error as Response;
            route = routes.account;
            alert = `${err.code} : ${err.message}`;
            alertParams = {
              type: MessageType.DANGER,
              position: "fixed-top",
            };
          }
        }
      } else {
        route = routes.account;
      }
    } else {
      route = getRouteFromPath(window.location.pathname);
    }

    await navigate(route!, {
      replace: true,
      alert: alert,
      alertParams: alertParams,
    });

    function observeDOMChanges() {
      const targetNode = document.body;

      const observer = new MutationObserver((mutationsList, observer) => {
        mutationsList.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                initMDB({ Ripple, Carousel, Input });
              }
            });
          }
        });
      });

      const config = { childList: true, subtree: true };

      observer.observe(targetNode, config);
    }

    observeDOMChanges();

    initMDB({ Ripple, Carousel, Modal, Dropdown, Input, Offcanvas, Collapse });
  })();
});

export const initInput = () => {
  document.querySelectorAll(".form-outline").forEach((element) => {
    const input = new Input(element);
    input.update();
  });
};

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
