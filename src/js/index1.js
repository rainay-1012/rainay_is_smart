// import "bootstrap";
// import "bootstrap-icons/font/bootstrap-icons.css";
// import "boxicons/css/boxicons.min.css";

// import $ from "jquery";
// import "jquery-blockui";
// import "../assets/Login Widget.svg";
// import "../assets/logo only.svg";
// import "../style/custom_theme.scss";
// import { getCurrentUserToken, login } from "./auth.js";
// import { initDashboard } from "./dashboard.js";
// import { initDeveloper } from "./dev_dashboard.js";
// import { initItemPage } from "./item.js";
// import { initLogin } from "./login.js";
// import { initProcurement } from "./procurement.js";
// import "./profile.js";
// import { initProfile } from "./profile.js";
// import { initRegister } from "./register.js";
// import { initReport } from "./report.js";
// import { initVendor } from "./vendor.js";

// export const routes = {
//   login: {
//     path: "/login",
//     destination: "main",
//     init: initLogin,
//   },
//   register: {
//     path: "/register",
//     destination: "main",
//     init: initRegister,
//   },
//   developer: {
//     path: "/developer_dashboard",
//     destination: "main",
//     init: initDeveloper,
//   },
//   dashboard: {
//     path: "/dashboard",
//     destination: "main",
//     init: initDashboard,
//   },
//   profile: {
//     path: "/dashboard/profile",
//     destination: "#content",
//     parent: "dashboard",
//     init: initProfile,
//   },
//   procurement: {
//     path: "/dashboard/procurement",
//     destination: "#content",
//     parent: "dashboard",
//     init: initProcurement,
//   },
//   item: {
//     path: "/dashboard/item",
//     destination: "#content",
//     parent: "dashboard",
//     init: initItemPage,
//   },
//   vendor: {
//     path: "/dashboard/vendor",
//     destination: "#content",
//     parent: "dashboard",
//     init: initVendor,
//   },
//   report: {
//     path: "/dashboard/report",
//     destination: "#content",
//     parent: "dashboard",
//     init: initReport,
//   },
// };

// export let currentRoute = null;
// let disposers = [];

// function getRouteChain(route) {
//   const chain = [route];

//   while (route && route.parent) {
//     route = routes[route.parent];
//     chain.unshift(route);
//   }

//   return chain;
// }

// function findCommonParent(chain1, chain2) {
//   let commonIndex = -1;
//   for (let i = 0; i < Math.min(chain1.length, chain2.length); i++) {
//     if (chain1[i] === chain2[i]) {
//       commonIndex = i;
//     } else {
//       break;
//     }
//   }
//   return commonIndex;
// }

// export async function navigate(
//   route,
//   {
//     pop = false,
//     replace = false,
//     block = true,
//     blockParams = {},
//     minBlockTime = 0,
//     alert = "",
//     alertParams = {},
//     initParams = {},
//   } = {}
// ) {
//   console.log(route);
//   const targetChain = getRouteChain(route);
//   const currentChain = currentRoute ? getRouteChain(currentRoute) : [];

//   const commonIndex = findCommonParent(currentChain, targetChain);

//   for (let i = disposers.length - 1; i > commonIndex; i--) {
//     if (disposers[i]) {
//       disposers[i]();
//       disposers[i] = null;
//     }
//   }
//   disposers = disposers.slice(0, commonIndex + 1);

//   let topParent = targetChain[commonIndex + 1]?.destination || "body";
//   if (topParent === "main") {
//     topParent = "body";
//   }

//   if (block) {
//     blockElement(topParent, blockParams);
//   }
//   const startTime = Date.now();
//   let elapsedTime = 0;
//   currentRoute = route;
//   try {
//     for (let i = commonIndex + 1; i < targetChain.length; i++) {
//       const route = targetChain[i];
//       const response = await fetchContent(route.path);
//       const tempContainer = $("<div>").html(response.content);
//       await waitForAssetsToLoad(tempContainer);
//       const replaceContent = route.destination;
//       $(replaceContent).replaceWith(tempContainer.html());
//       if (response.status === "error") {
//         return;
//       }

//       if (typeof route.init === "function") {
//         disposers[i] = await route.init(initParams);
//       } else {
//         disposers[i] = null;
//       }
//     }

//     const historyData = {
//       route: route.path,
//       topParent,
//       block,
//       blockParams,
//       minBlockTime,
//     };
//     if (pop) {
//       return;
//     }
//     if (replace) {
//       history.replaceState(historyData, "", currentRoute.path);
//     } else {
//       history.pushState(historyData, "", currentRoute.path);
//     }
//   } catch (error) {
//     console.error("Error during navigation:", error);
//   } finally {
//     if (block) {
//       elapsedTime = Date.now() - startTime;

//       await new Promise((resolve) =>
//         setTimeout(resolve, minBlockTime - elapsedTime)
//       );
//       unblockElement(topParent);
//       if (alert) {
//         showAlert(alert, alertParams);
//       }
//     }
//   }
// }

// async function waitForAssetsToLoad(container) {
//   const assetPromises = [];

//   container.find("img").each(function () {
//     const img = $(this);
//     const promise = new Promise((resolve, reject) => {
//       img.on("load", resolve);
//       img.on("error", reject);
//     });
//     assetPromises.push(promise);
//   });

//   await Promise.allSettled(assetPromises);
// }

// export async function fetchContent(route) {
//   try {
//     const response = await fetch(route, {
//       method: "GET",
//       headers: {
//         "X-Requested-With": "XMLHttpRequest",
//         Authorization: `Bearer ${await getCurrentUserToken()}`,
//       },
//     });

//     if (!response.ok) {
//       const errorResponse = await response.json();
//       console.log(errorResponse);
//       return { status: "error", content: errorResponse.content };
//     }

//     return { status: "success", content: await response.text() };
//   } catch (error) {
//     console.error(error);
//     return { status: "error", content: "<h1>Something went wrong!</h1>" };
//   }
// }

// export const AlertType = {
//   SUCCESS: "success",
//   DANGER: "danger",
//   WARNING: "warning",
//   INFO: "info",
// };

// export function showAlert(
//   alertMessage,
//   {
//     element = "body",
//     type = AlertType.INFO,
//     position = "prepend",
//     animated = true,
//     timeout = 5000,
//   } = {}
// ) {
//   if (!Object.values(AlertType).includes(type)) {
//     console.error(`Invalid alert type: ${type}`);
//     return;
//   }

//   const alertDiv = document.createElement("div");
//   alertDiv.className = `alert alert-${type} alert-dismissible mb-0`;
//   if (animated) alertDiv.classList.add("show");

//   alertDiv.setAttribute("role", "alert");
//   alertDiv.innerHTML = `
//     ${alertMessage}
//     <button type="button" class="btn-close" aria-label="Close"></button>
//   `;

//   if (position === "fixed-top") {
//     alertDiv.style.position = "fixed";
//     alertDiv.style.top = "0";
//     alertDiv.style.left = "0";
//     alertDiv.style.width = "100%";
//     alertDiv.style.zIndex = "1050";
//     document.querySelector(element).appendChild(alertDiv);
//   } else {
//     document
//       .querySelector(element)
//       .insertAdjacentElement("afterbegin", alertDiv);
//   }

//   const $alertDiv = $(alertDiv);

//   if (animated) {
//     $($alertDiv).slideDown(300);
//   } else {
//     $($alertDiv).show();
//   }

//   $alertDiv.find(".btn-close").on("click", function () {
//     if (animated) {
//       $alertDiv.slideUp(300, () => $alertDiv.remove()); // Slide up animation
//     } else {
//       $alertDiv.remove();
//     }
//   });

//   setTimeout(() => {
//     if (animated) {
//       $($alertDiv).slideUp(300, () => $($alertDiv).remove());
//     } else {
//       $($alertDiv).remove();
//     }
//   }, timeout);
// }

// export function blockElement(
//   element,
//   {
//     opacity = 1,
//     small = false,
//     grow = false,
//     primary = true,
//     zIndex = 10000,
//   } = {}
// ) {
//   const $element = $(element);
//   const spinner = grow ? "spinner-grow" : "spinner-border";
//   const spinnerSizeClass = small ? "spinner-border-sm" : "";
//   const spinnerSize = small ? 1 : 2;
//   const spinnerColorClass = primary ? "text-primary" : "text-primary-emphasis";
//   $element.block({
//     message: `
//   <div class="${spinner} ${spinnerSizeClass} ${spinnerColorClass}" role="status">
//     <span class="visually-hidden">Loading...</span>
//   </div>`,
//     centerX: false,
//     centerY: false,
//     overlayCSS: {
//       backgroundColor: "#f8f9fa",
//       opacity: opacity,
//       zIndex: zIndex - 1,
//     },
//     css: {
//       border: "none",
//       backgroundColor: "transparent",
//       cursor: "wait",
//       zIndex: zIndex,
//       top: `calc(50% - ${spinnerSize / 2}rem - 0.125rem)`,
//       left: `calc(50% - ${spinnerSize / 2}rem)`,
//       width: "auto",
//       height: "auto",
//     },
//   });

//   $element.css("pointer-events", "none");
//   $element.prop("disabled", true);
// }

// export function unblockElement(element) {
//   const $element = $(element);
//   $element.unblock();
//   $element.css("pointer-events", "auto");
//   $element.prop("disabled", false);
// }

// export function getRouteFromPath(path) {
//   for (const [key, value] of Object.entries(routes)) {
//     if (value.path === path) {
//       return value;
//     }
//   }
//   console.error(`Route with path "${path}" not found.`);
//   return null;
// }

// $(async function () {
//   window.onpopstate = async (event) => {
//     console.log("pop");
//     const state = event.state || {};
//     const {
//       route = window.location.pathname,
//       replaceContent = "main",
//       block = true,
//       blockParams = {},
//       minBlockTime = 1000,
//     } = state;

//     await navigate(getRouteFromPath(route), {
//       pop: true,
//       replaceContent,
//       block,
//       blockParams,
//       minBlockTime,
//     });
//   };

//   let route;
//   let alert;
//   let alertParams;

//   if (window.location.pathname === "/" || window.location.pathname === "") {
//     const userToken = await getCurrentUserToken();
//     if (userToken) {
//       try {
//         const data = await login({ token: userToken });
//         route = getRouteFromPath(data.redirect_to);
//       } catch (error) {
//         route = routes.login;
//         alert = `${error.name} : ${error.message}`;
//         alertParams = {
//           type: AlertType.DANGER,
//           position: "fixed-top",
//         };
//       }
//     } else {
//       route = routes.login;
//     }
//   } else {
//     route = getRouteFromPath(window.location.pathname);
//   }

//   await navigate(route, {
//     replace: true,
//     blockParams: {
//       grow: true,
//     },
//     alert: alert,
//     alertParams: alertParams,
//   });
// });

// export function simulateAsyncRequest(time, data = null) {
//   return new Promise((resolve, reject) => {
//     if (typeof time !== "number" || time < 0) {
//       return reject(new Error("Invalid time parameter"));
//     }

//     setTimeout(() => {
//       resolve(data);
//     }, time);
//   });
// }
