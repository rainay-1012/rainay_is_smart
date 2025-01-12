// import { Modal } from "bootstrap";
// import DataTable from "datatables.net-bs5";
// import TomSelect from "tom-select";
// import { getCurrentUserToken } from "./auth";
// import {
//   MessageType,
//   blockElement,
//   showMessage,
//   unblockElement,
// } from "./utils";

// export async function fetchPurchaseData() {
//   try {
//     const response = await fetch("/get_purchase_data", {
//       headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
//     });
//     if (!response.ok) {
//       console.log(response.statusText);
//     }
//     return await response.json();
//   } catch (e) {
//     console.log(`Error fetching item data: ${e}`);
//   }
// }

// export async function initPurchasePage() {
//   document.querySelector("#content-title").innerHTML = "Purchase";

//   console.log(await getCurrentUserToken());
//   console.log(await fetchPurchaseData());
//   const purchases = await fetchPurchaseData(); //should i purchase / purchases

//   const status = [
//     { name: "Complete, Late" },
//     { name: "Complete, On time" },
//     { name: "Incomplete, On time" },
//     { name: "Incomplete, Late" },
//   ];

//   const addNewPurchaseModalElm = document.querySelector(
//     "#add-new-purchase-modal"
//   );
//   if (!addNewPurchaseModalElm) {
//     console.log(`Add new purchase modal: ${addNewPurchaseModalElm}`);
//     return;
//   }
//   const addNewPurchaseModal = new Modal(addNewPurchaseModalElm);

//   const purchaseSelect = new TomSelect("#status-list", {
//     create: true,
//     placeholder: "Select a status",
//     sortField: "name",
//     maxItems: 1,
//     valueField: "name",
//     labelField: "name",
//     searchField: ["name"],
//     options: status,
//     hidePlaceholder: true,
//   });

//   addNewPurchaseModalElm.addEventListener("submit", async (evt) => {
//     evt.preventDefault();

//     const formData = new FormData(addNewPurchaseModalElm);
//     const selectedStatus = purchaseSelect.getValue();
//     formData.append("status", JSON.stringify(selectedStatus));
//     const isModify =
//       formData.get("data") !== null &&
//       formData.get("data") !== undefined &&
//       formData.get("data") !== "";
//     console.log(isModify);

//     try {
//       blockElement(addNewPurchaseModalElm.querySelector(".modal-content"), {
//         opacity: 0.5,
//       });
//       const response = await fetch("/upsert_purchase", {
//         headers: {
//           Authorization: `Bearer ${await getCurrentUserToken()}`,
//         },
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         throw new Error(`Error: ${response.statusText}`);
//       }

//       const result = await response.json();
//       console.log(
//         `Purchase successfully ${isModify ? "modified" : "added"}.`,
//         result
//       );
//       purchaseTable.ajax.reload();
//       addNewPurchaseModal.hide();
//       showMessage(`Purchase successfully ${isModify ? "modified" : "added"}.`, {
//         type: MessageType.SUCCESS,
//         element: "#content-container",
//       });
//     } catch (error) {
//       console.error("Error submitting form:", error);
//       showMessage("There was an error submitting the form. Please try again.", {
//         type: MessageType.DANGER,
//         element: "#content-container",
//       });
//     } finally {
//       unblockElement(addNewPurchaseModalElm.querySelector(".modal-content"));
//     }
//   });

//   const purchaseTableElm = document.querySelector("#purchase-table");
//   $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";
//   if (!purchaseTableElm) {
//     console.log(`Purchase table elm: ${purchaseTableElm}`);
//     return;
//   }

//   const purchaseTable = new DataTable(purchaseTableElm, {
//     ajax: {
//       dataSrc: "",
//       url: "/get_purchase_data", // API endpoint to get RFQ data
//       headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
//     },
//     rowId: "id",
//     layout: {
//       topStart: {
//         buttons: [
//           {
//             extend: "collection",
//             text: `<i class="bi bi-arrow-bar-up fw-bold me-2"></i>Export`,
//             className: "btn-dark",
//             buttons: [
//               {
//                 extend: "copy",
//                 exportOptions: {
//                   columns: [1, 3, 4, 5],
//                 },
//               },
//               {
//                 extend: "csv",
//                 exportOptions: {
//                   columns: [1, 3, 4, 5],
//                 },
//               },
//               {
//                 extend: "excel",
//                 exportOptions: {
//                   columns: [1, 3, 4, 5],
//                 },
//               },
//               {
//                 extend: "pdf",
//                 exportOptions: {
//                   columns: [1, 3, 4, 5],
//                 },
//               },
//               {
//                 extend: "print",
//                 exportOptions: {
//                   columns: [1, 3, 4, 5],
//                 },
//               },
//             ],
//           },
//         ],
//       },

//       topEnd: {
//         buttons: [
//           {
//             text: `<i class="bi bi-plus-lg fw-bold me-2"></i>Add new purchase`,
//             className: "btn btn-primary text-light",
//             action: function (e, dt, node, config) {
//               addNewPurchaseModalElm.querySelector(".modal-title").innerHTML =
//                 "Add Purchase";
//               addNewPurchaseModal.show();
//             },
//           },
//         ],
//       },
//     },

//     order: [[1, "asc"]],
//     select: { style: "multi", selector: "td:first-child" },
//     processing: true,
//     serverSide: false,
//     responsive: true,
//     paging: true,
//     pageLength: 5,
//     lengthChange: false,
//     searching: true,
//     ordering: true,
//     columns: [
//       {
//         data: null,
//         defaultContent: "",
//         orderable: false,
//         render: DataTable.render.select(),
//       },
//       { data: "id", title: "ID" },
//       { data: "rfqid", title: "RFQ ID" },
//       { data: "quantity", title: "Item Quantity" },
//       { data: "price", title: "Total Price (RM)" },
//       {
//         data: "Status",
//         title: "Status",
//         orderable: false,
//         render: function (data) {
//           return data
//             .map(function (status) {
//               return `<div class="badge bg-primary d-block mb-1 py-2" style="width: min-content;">&nbsp;${status}&nbsp;</div>`;
//             })
//             .join("");
//         },
//       },
//       {
//         data: null,
//         title: "Action",
//         orderable: false,
//         render: function (data, type, row) {
//           const editIcon = `<i role="button" class="bi bi-pencil-fill edit-icon" data-id="${data.id}"></i>`;
//           const deleteIcon = `<i role="button" class="bi bi-trash delete-icon" data-id="${data.id}"></i>`;

//           return `${editIcon} ${deleteIcon}`;
//         },
//       },
//     ],

//     drawCallback: function () {
//       document.querySelectorAll(".edit-icon").forEach((icon) => {
//         icon.addEventListener("click", async () => {
//           const purchaseId = icon.getAttribute("data-id");
//           const rowData = purchaseTable.row(`#${purchaseId}`).data();
//           purchaseSelect.setValue(rowData.status);
//           addNewPurchaseModalElm.querySelector(`input[name="id"]`).value =
//             rowData.id;
//           addNewPurchaseModalElm.querySelector(".modal-title").innerHTML =
//             "Modify Purchase";
//           addNewPurchaseModal.show();
//         });
//       });

//       document.querySelectorAll(".delete-icon").forEach((icon) => {
//         icon.addEventListener("click", async function () {
//           const purchaseId = this.getAttribute("data-id");
//           const confirmDelete = confirm(
//             "Are you sure you want to delete this purchase?"
//           );

//           if (confirmDelete) {
//             try {
//               const response = await fetch(`/delete_purchase/${purchaseId}`, {
//                 method: "DELETE",
//                 headers: {
//                   Authorization: `Bearer ${await getCurrentUserToken()}`,
//                   "Content-Type": "application/json",
//                 },
//               });

//               const result = await response.json();

//               if (response.ok) {
//                 showMessage("Purchase has been successfully deleted.", {
//                   type: MessageType.SUCCESS,
//                   element: "#content-container",
//                 });
//                 purchaseTable.ajax.reload();
//               } else {
//                 showMessage(
//                   "An error occurred while trying to delete the purchase. Please try again.",
//                   {
//                     type: MessageType.DANGER,
//                     element: "#content-container",
//                   }
//                 );
//               }
//             } catch (error) {
//               console.error("Error:", error);
//               showMessage(
//                 "An error occurred while trying to delete the purchase. Please try again.",
//                 {
//                   type: MessageType.DANGER,
//                   element: "#content-container",
//                 }
//               );
//             }
//           }
//         });
//       });
//     },

//     initComplete: (settings, object) => {
//       const wrapperDiv = document.createElement("div");
//       wrapperDiv.classList.add("card", "p-3", "bg-white");

//       purchaseTableElm.parentNode &&
//         purchaseTableElm.parentNode.insertBefore(wrapperDiv, ipurchaseTableElm);
//       wrapperDiv.appendChild(purchaseTableElm);
//       document.querySelectorAll(".dt-buttons").forEach((elm) => {
//         elm.classList.remove("btn-group");
//       });
//       $("#searchbox").on("keyup search input paste cut", function (evt) {
//         purchaseTable.search(evt.target.value).draw();
//       });
//     },
//   });

//   const searchBox = document.querySelector("#searchbox");
//   if (searchBox) {
//     searchBox.addEventListener("input", function (evt) {
//       const inputElement = evt.target;
//       if (inputElement instanceof HTMLInputElement) {
//         vendorTable.search(inputElement.value).draw();
//       }
//     });
//   } else {
//     console.error("Search box not found in the DOM.");
//   }

//   return new Promise((resolve) => {
//     resolve(() => {
//       itemTable.destroy();
//     });
//   });
// }
