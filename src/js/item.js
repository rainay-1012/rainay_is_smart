import { Modal } from "bootstrap";
import DataTable from "datatables.net-bs5";
import Dropzone from "dropzone";
import "dropzone/dist/dropzone.css";
import "../style/auth.scss";

import TomSelect from "tom-select";
import { AlertType, blockElement, showAlert, unblockElement } from ".";
import { getCurrentUserToken } from "./auth";

export async function fetchItemData() {
  try {
    const response = await fetch("/get_item_data", {
      headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
    });
    if (!response.ok) {
      console.log(response.statusText);
    }
    return await response.json();
  } catch (e) {
    console.log(`Error fetching item data: ${e}`);
  }
}

export async function initItemPage() {
  document.querySelector("#content-title").innerHTML = "Item";

  console.log(await getCurrentUserToken());
  // console.log(await fetchItemData());
  // const items = await fetchItemData();

  const category = [
    { name: "Raw Materials" },
    { name: "Finished Goods" },
    { name: "Office Supplies" },
    { name: "IT & Technology" },
  ];
  const addNewProcurementModalElm = document.querySelector(
    "#add-new-procurement-modal"
  );
  const procurementModalBody =
    addNewProcurementModalElm.querySelector(".modal-body tbody");

  if (!addNewProcurementModalElm) {
    console.log(`Add new procurement modal: ${addNewProcurementModalElm}`);
    return;
  }
  const addNewProcurementModal = new Modal(addNewProcurementModalElm);

  const addNewItemModalElm = document.querySelector("#add-new-item-modal");
  if (!addNewItemModalElm) {
    console.log(`Add new item modal: ${addNewItemModalElm}`);
    return;
  }
  const addNewItemModal = new Modal(addNewItemModalElm);

  const itemSelect = new TomSelect("#category-list", {
    create: true,
    placeholder: "Select an category",
    sortField: "name",
    maxItems: 2,
    valueField: "name",
    labelField: "name",
    searchField: ["name"],
    options: category,
    hidePlaceholder: true,
  });

  Dropzone.autoDiscover = false;

  const photoDropzone = new Dropzone("#photo", {
    url: "/file/post",
    maxFiles: 1,
    thumbnailWidth: 125,
    thumbnailHeight: 125,
    addRemoveLinks: true,
    acceptedFiles: "image/*",
  });
  photoDropzone.on("addedfile", (file) => {
    photoDropzone.element.classList.add("border-0");
  });

  photoDropzone.on("removedfile", (file) => {
    photoDropzone.element.classList.remove("border-0");
  });

  addNewItemModalElm.addEventListener("hide.bs.modal", (evt) => {
    photoDropzone.removeAllFiles(true);
    itemSelect.clear();
    addNewItemModalElm.reset();
  });

  addNewItemModalElm.addEventListener("submit", async (evt) => {
    evt.preventDefault();

    const formData = new FormData(addNewItemModalElm);
    const selectedCategories = itemSelect.getValue();
    formData.append("categories", JSON.stringify(selectedCategories));
    const isModify =
      formData.get("data") !== null &&
      formData.get("data") !== undefined &&
      formData.get("data") !== "";
    console.log(isModify);

    const files = photoDropzone.files;
    if (files.length > 0) {
      formData.append("photo", files[0]);
    }

    console.log(Object.fromEntries(formData.entries()));

    try {
      blockElement(addNewItemModalElm.querySelector(".modal-content"), {
        opacity: 0.5,
      });
      const response = await fetch("/upsert_item", {
        headers: {
          Authorization: `Bearer ${await getCurrentUserToken()}`,
        },
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(
        `Item successfully ${isModify ? "modified" : "added"}.`,
        result
      );
      itemTable.ajax.reload();
      addNewItemModal.hide();
      showAlert(`Item successfully ${isModify ? "modified" : "added"}.`, {
        type: AlertType.SUCCESS,
        element: "#content-container",
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      showAlert("There was an error submitting the form. Please try again.", {
        type: AlertType.DANGER,
        element: "#content-container",
      });
    } finally {
      unblockElement(addNewItemModalElm.querySelector(".modal-content"));
    }
  });

  const itemTableElm = document.querySelector("#item-table");
  $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";
  if (!itemTableElm) {
    console.log(`Item table elm: ${itemTableElm}`);
    return;
  }
  const itemTable = new DataTable(itemTableElm, {
    ajax: {
      dataSrc: "",
      url: "/get_item_data",
      headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
    },
    rowId: "id",
    layout: {
      topStart: {
        buttons: [
          {
            extend: "collection",
            text: `<i class="bi bi-arrow-bar-up fw-bold me-2"></i>Export`,
            className: " btn-dark",
            buttons: [
              {
                extend: "copy",
                exportOptions: {
                  columns: [1, 3, 4, 5],
                },
              },
              {
                extend: "csv",
                exportOptions: {
                  columns: [1, 3, 4, 5],
                },
              },
              {
                extend: "excel",
                exportOptions: {
                  columns: [1, 3, 4, 5],
                },
              },
              {
                extend: "pdf",
                exportOptions: {
                  columns: [1, 3, 4, 5],
                },
              },
              {
                extend: "print",
                exportOptions: {
                  columns: [1, 3, 4, 5],
                },
              },
            ],
          },
        ],
      },
      topEnd: {
        buttons: [
          {
            text: `<i class="bi bi-bag fw-bold me-2"></i>Procurement`,
            className: "btn btn-outline-primary me-1",
            action: function (e, dt, node, config) {
              const data = itemTable.rows(".selected").data().toArray();
              procurementModalBody.innerHTML = "";
              data.forEach((row) => {
                console.log(row);
                const itemId = row.id;
                const itemName = row.name;
                const rowElement = document.createElement("tr");
                rowElement.innerHTML = `
                  <td>
                    <input
                      name="id[]"
                      type="text"
                      value="${itemId}"
                      hidden
                    />
                    <input
                      name="name[]"
                      value="${itemName}"
                      type="text"
                      class="form-control-plaintext ps-2"
                      readonly
                      required
                    />
                  </td>
                  <td>
                    <div>
                      <input
                        name="quantity[]"
                        class="form-control text-start"
                        type="number"
                        min="1"
                        required
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      name="price[]"
                      class="form-control text-start"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </td>
                `;

                procurementModalBody.appendChild(rowElement);
              });
              addNewProcurementModal.show();
            },
          },

          {
            text: `<i class="bi bi-plus fw-bold me-2"></i>Add new item`,
            className: "btn btn-primary text-light",
            action: function (e, dt, node, config) {
              addNewItemModalElm.querySelector(".modal-title").innerHTML =
                "New Item";
              addNewItemModal.show();
            },
          },
        ],
      },
    },
    order: [[1, "asc"]],
    select: { style: "multi", selector: "td:first-child" },
    processing: true,
    serverSide: false,
    responsive: true,
    paging: true,
    pageLength: 3,
    lengthChange: false,
    searching: true,
    ordering: true,
    columns: [
      {
        data: null,
        defaultContent: "",
        orderable: false,
        render: DataTable.render.select(),
      },
      { data: "id", title: "ID" },
      {
        data: "photo",
        title: "Photo",
        orderable: false,
        render: function (data) {
          return `<img src="${data}" alt="Item Photo" class="object-fit-cover" width=125 height=125 />`;
        },
      },
      { data: "name", title: "Item Name" },
      {
        data: "categories",
        title: "Category",
        orderable: false,
        render: function (data) {
          return data
            .map(function (category) {
              return `<div class="badge bg-primary d-block mb-1 py-2" style="width: min-content;">&nbsp;${category}&nbsp;</div>`;
            })
            .join("");
        },
      },
      { data: "last_update", title: "Last Update" },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: function (data, type, row) {
          const editIcon = `<i role="button" class="bi bi-pencil-fill edit-icon" data-id="${data.id}"></i>`;
          const deleteIcon = `<i role="button" class="bi bi-trash delete-icon" data-id="${data.id}"></i>`;

          return `${editIcon} ${deleteIcon}`;
        },
      },
    ],
    drawCallback: function () {
      document.querySelectorAll(".edit-icon").forEach((icon) => {
        icon.addEventListener("click", async () => {
          const itemId = icon.getAttribute("data-id");
          const rowData = itemTable.row(`#${itemId}`).data();
          itemSelect.setValue(rowData.categories);
          addNewItemModalElm.querySelector(`input[name="id"]`).value =
            rowData.id;
          addNewItemModalElm.querySelector(`input[name="name"]`).value =
            rowData.name;
          fetch(rowData.photo)
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch image: ${response.statusText}`
                );
              }
              return response.blob();
            })
            .then((blob) => {
              const fileName = rowData.photo.split("/").pop();
              const file = new File([blob], fileName, { type: blob.type });
              photoDropzone.addFile(file);
            })
            .catch((error) => {
              console.error("Error fetching and adding image:", error);
            });
          addNewItemModalElm.querySelector(".modal-title").innerHTML =
            "Modify Item";
          addNewItemModal.show();
        });
      });

      document.querySelectorAll(".delete-icon").forEach((icon) => {
        icon.addEventListener("click", async function () {
          const itemId = this.getAttribute("data-id");
          const confirmDelete = confirm(
            "Are you sure you want to delete this item?"
          );

          if (confirmDelete) {
            try {
              const response = await fetch(`/delete_item/${itemId}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${await getCurrentUserToken()}`,
                  "Content-Type": "application/json",
                },
              });

              const result = await response.json();

              if (response.ok) {
                showAlert("Item has been successfully deleted.", {
                  type: AlertType.SUCCESS,
                  element: "#content-container",
                });
                itemTable.ajax.reload();
              } else {
                showAlert(
                  "An error occurred while trying to delete the item. Please try again.",
                  {
                    type: AlertType.DANGER,
                    element: "#content-container",
                  }
                );
              }
            } catch (error) {
              console.error("Error:", error);
              showAlert(
                "An error occurred while trying to delete the item. Please try again.",
                {
                  type: AlertType.DANGER,
                  element: "#content-container",
                }
              );
            }
          }
        });
      });
    },
    initComplete: (settings, object) => {
      const wrapperDiv = document.createElement("div");
      wrapperDiv.classList.add("card", "p-3", "bg-white");

      itemTableElm.parentNode &&
        itemTableElm.parentNode.insertBefore(wrapperDiv, itemTableElm);
      wrapperDiv.appendChild(itemTableElm);
      document.querySelectorAll(".dt-buttons").forEach((elm) => {
        elm.classList.remove("btn-group");
      });
      $("#searchbox").on("keyup search input paste cut", function (evt) {
        itemTable.search(evt.target.value).draw();
      });
    },
  });

  return new Promise((resolve) => {
    resolve(() => {
      itemTable.destroy();
    });
  });
}
