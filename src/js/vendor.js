import { Modal } from "bootstrap";
import DataTable from "datatables.net-bs5";
import "dropzone/dist/dropzone.css";
import TomSelect from "tom-select";
import { AlertType, blockElement, showAlert, unblockElement } from ".";
import "../style/dashboard.scss";
import { getCurrentUserToken } from "./auth";

export async function initVendor() {
  document.querySelector("#content-title").innerHTML = "Vendor";

  // const vendorData = [
  //   {
  //     id: "01",
  //     name: "starbucks",
  //     categories: ["coffee", "beverages"], // list of categories
  //     email: "starbucks@gmail.com",
  //     address: "123 Starbucks St, Coffee City, USA", // example address
  //     gred: 85, // score between 0-100
  //   },
  //   {
  //     id: "02",
  //     name: "chagee",
  //     categories: ["tea", "beverages"],
  //     email: "chagee@gmail.com",
  //     address: "456 Chagee Ave, Tea Town, USA",
  //     gred: 55,
  //   },
  //   {
  //     id: "03",
  //     name: "tealive",
  //     categories: ["tea", "beverages"],
  //     email: "tealive@gmail.com",
  //     address: "789 Tealive Rd, Tea City, USA",
  //     gred: 72,
  //   },
  //   {
  //     id: "04",
  //     name: "zus",
  //     categories: ["snacks", "beverages"],
  //     email: "inquiry@zus.com",
  //     address: "321 Zus Blvd, Snack City, USA",
  //     gred: 62,
  //   },
  //   {
  //     id: "04",
  //     name: "zus",
  //     categories: ["snacks", "beverages"],
  //     email: "inquiry@zus.com",
  //     address: "321 Zus Blvd, Snack City, USA",
  //     gred: 62,
  //   },
  // ];

  const addNewVendorModalElm = document.querySelector("#add-new-vendor-modal");

  if (!addNewVendorModalElm) {
    console.log(`Add new vendor modal: ${addNewVendorModalElm}`);
    return;
  }

  const addNewVendorModal = new Modal(addNewVendorModalElm);
  //
  addNewVendorModalElm.addEventListener("submit", async (evt) => {
    evt.preventDefault();

    const formData = new FormData(addNewVendorModalElm);
    const selectedCategories = categorySelect.getValue();
    formData.append("categories", JSON.stringify(selectedCategories));

    const isModify =
      formData.get("id") !== null &&
      formData.get("id") !== undefined &&
      formData.get("id") !== "";
    console.log(isModify);

    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    try {
      blockElement(addNewVendorModalElm.querySelector(".modal-content"), {
        opacity: 0.5,
      });
      const response = await fetch("/upsert_vendor", {
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
        `Vendor successfully ${isModify ? "modified" : "added"}.`,
        result
      );
      vendorTable.ajax.reload(); // Assuming vendorTable is the DataTable instance
      addNewVendorModal.hide();
      showAlert(`Vendor successfully ${isModify ? "modified" : "added"}.`, {
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
      unblockElement(addNewVendorModalElm.querySelector(".modal-content"));
    }
  });
  //

  const category = [
    { name: "Raw Materials" },
    { name: "Finished Goods" },
    { name: "Office Supplies" },
    { name: "IT & Technology" },
  ];

  const categorySelect = new TomSelect("#category-list", {
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

  const vendorTableElm = document.querySelector("#vendor-table");
  $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";
  if (!vendorTableElm) {
    console.log(`Vendor table elm: ${vendorTableElm}`);
    return;
  }
  const vendorTable = new DataTable(vendorTableElm, {
    // data: vendorData,
    ajax: {
      url: "/get_vendor_data",
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
            text: `<i class="bi bi-plus fw-bold me-2"></i>Add new vendor`,
            className: "btn btn-primary text-light",
            action: function (e, dt, node, config) {
              addNewVendorModalElm.querySelector(".modal-title").innerHTML =
                "Add Vendor";
              addNewVendorModal.show();
            },
          },
        ],
      },
    },
    processing: true,
    serverSide: false,
    responsive: true,
    paging: true,
    pageLength: 5,
    lengthChange: false,
    searching: true,
    ordering: true,
    columns: [
      { data: "id", title: "ID", className: "text-center" },
      { data: "name", title: "Vendor Name", className: "text-center" },
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
      { data: "email", title: "Email", className: "text-center" },
      { data: "address", title: "Address", className: "text-center" },
      {
        data: "gred",
        title: "Gred",
        orderable: false,
        render: function (gred) {
          let colorClass = "text-success";
          if (gred <= 33) {
            colorClass = "text-danger";
          } else if (gred <= 66) {
            colorClass = "text-warning"; // orange
          }

          return `<i class="bi bi-circle-fill ${colorClass}"></i>`;
        },
      },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: function (data, type, row) {
          const editIcon = `<i role="button" class="bi bi-pencil-fill edit-icon" data-id="${data.id}"></i>`;
          const deleteIcon = `<i role="button" class="bi bi-trash delete-icon" data-id="${data.id}"></i>`;
          const approvalIcon = `<i role="button" class="bi bi-check-circle ${
            data.approved ? "text-success pe-none" : ""
          } approval-icon" data-id="${data.id}"></i>`;

          return `${editIcon} ${deleteIcon} ${approvalIcon}`;
        },
      },
    ],
    drawCallback: function () {
      document.querySelectorAll(".edit-icon").forEach((icon) => {
        icon.addEventListener("click", async () => {
          const vendorId = icon.getAttribute("data-id");
          const rowData = vendorTable.row(`#${vendorId}`).data();
          addNewVendorModalElm.querySelector(`input[name="id"]`).value =
            rowData.id;
          addNewVendorModalElm.querySelector(`input[name="name"]`).value =
            rowData.name;
          addNewVendorModalElm.querySelector(`input[name="email"]`).value =
            rowData.email;
          addNewVendorModalElm.querySelector(`input[name="address"]`).value =
            rowData.address;
          categorySelect.setValue(rowData.categories);
          addNewVendorModalElm.querySelector(".modal-title").innerHTML =
            "Edit Vendor";

          addNewVendorModal.show();
        });
      });

      document.querySelectorAll(".delete-icon").forEach((icon) => {
        icon.addEventListener("click", async function () {
          const vendorId = icon.getAttribute("data-id");
          const confirmDelete = confirm(
            "Are you sure you want to delete this vendor?"
          );
          if (confirmDelete) {
            try {
              const response = await fetch(`/delete_vendor/${vendorId}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${await getCurrentUserToken()}`,
                  "Content-Type": "application/json",
                },
              });

              if (response.ok) {
                showAlert("Vendor has been successfully deleted.", {
                  type: AlertType.SUCCESS,
                  element: "#content-container",
                });
                vendorTable.ajax.reload();
              } else {
                showAlert(
                  "An error occurred while trying to delete the vendor. Please try again.",
                  {
                    type: AlertType.DANGER,
                    element: "#content-container",
                  }
                );
              }
            } catch (error) {
              console.error("Error:", error);
              showAlert(
                "An error occurred while trying to delete the vendor. Please try again.",
                {
                  type: AlertType.DANGER,
                  element: "#content-container",
                }
              );
            }
          }
        });
      });

      document
        .querySelectorAll(".approval-icon:not(.pe-none)")
        .forEach((icon) => {
          icon.addEventListener("click", async function () {
            const vendorId = icon.getAttribute("data-id");
            const confirmApprove = confirm(
              "Are you sure you to approve this vendor?"
            );
            if (confirmApprove) {
              try {
                const response = await fetch(`/approve_vendor/${vendorId}`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${await getCurrentUserToken()}`,
                    "Content-Type": "application/json",
                  },
                });

                if (response.ok) {
                  showAlert("Vendor has been successfully approved.", {
                    type: AlertType.SUCCESS,
                    element: "#content-container",
                  });
                  vendorTable.ajax.reload();
                } else {
                  showAlert(
                    "An error occurred while trying to app the vendor. Please try again.",
                    {
                      type: AlertType.DANGER,
                      element: "#content-container",
                    }
                  );
                }
              } catch (error) {
                console.error("Error:", error);
                showAlert(
                  "An error occurred while trying to approve the vendor. Please try again.",
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

      if (vendorTableElm.parentNode) {
        vendorTableElm.parentNode.insertBefore(wrapperDiv, vendorTableElm);
      }
      wrapperDiv.appendChild(vendorTableElm);

      // Remove the 'btn-group' class from all dt-buttons
      document.querySelectorAll(".dt-buttons").forEach(function (elm) {
        elm.classList.remove("btn-group");
      });

      // Handle search input events
      const searchBox = document.querySelector("#searchbox");
      if (searchBox) {
        // Add a null check
        searchBox.addEventListener("input", function (evt) {
          const inputElement = evt.target;
          if (inputElement instanceof HTMLInputElement) {
            vendorTable.search(inputElement.value).draw(); // Call search and redraw the DataTable
          }
        });
      } else {
        console.error("Search box not found in the DOM.");
      }
    },
  });

  return new Promise((resolve) => {
    resolve(() => {});
  });
}
