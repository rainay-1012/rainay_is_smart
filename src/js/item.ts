import DataTable from "datatables.net-bs5";
import Dropzone from "dropzone";
import Joi from "joi";
import $ from "jquery";
import _ from "lodash";
import { Modal } from "mdb-ui-kit";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.bootstrap5.min.css";
import { initInput } from ".";
import "../style/auth.scss";
import { getCurrentUser, getCurrentUserToken } from "./auth";
import { SocketDataManager } from "./socket";
import {
  assert,
  ChatManager,
  decodeHtml,
  FormValidator,
  mapToElement,
  MessageType,
  showMessage,
  TableAction,
  withBlock,
} from "./utils";

export async function initItemPage() {
  return new Promise<() => void>(async (resolve, reject) => {
    await withBlock("#content", {
      type: "border",
      small: false,
    })(async () => {
      console.log("hi");
      initInput();
      const dataManager = await SocketDataManager.getOrCreateInstance({
        item: "/get_item_data",
      });
      let initialData = [];

      initialData = dataManager.getDataCache("item");

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
          console.log(uid, data, dataType, eventType);
          itemTable.row.add(data).draw();
        }
      );

      dataManager?.setEventCallback(
        "item",
        "delete",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          itemTable.row(`#${data.id}`).remove().draw();
        }
      );

      dataManager?.setEventCallback(
        "item",
        "modify",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          console.log(data);
          let d = itemTable.row(`#${data.id}`).data();
          Object.assign(d, data);
          itemTable.row(`#${data.id}`).invalidate().draw();
        }
      );

      dataManager?.setEventCallback(
        "item",
        "change",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          itemTable.responsive.recalc();
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

      const itemFormElm = document.querySelector("#item-modal");
      // const chatManager = ChatManager.getInstance();

      assert(
        itemFormElm instanceof HTMLFormElement,
        "Item modal undefined or not HTMLFormElement"
      );

      const itemForm = new Modal(itemFormElm);

      const itemSchema = Joi.object({
        id: Joi.string().allow("").optional(),
        name: Joi.string().min(3).max(100).required().messages({
          "string.empty": "Name is required",
          "string.min": "Name must be at least 3 characters long",
          "string.max": "Name must not exceed 100 characters",
        }),
        category: Joi.string().required().messages({
          "any.required": "Category is required.",
        }),
      });

      const itemFormValidator = new FormValidator(itemSchema, itemFormElm);

      itemFormValidator.attachValidation();

      const onItemFormSubmit = async (evt: SubmitEvent) => {
        evt.preventDefault();
        const data = itemFormValidator.validateForm();

        if (!data) {
          return;
        }

        const formData = new FormData();

        Object.keys(data).forEach((key) => {
          formData.append(key, data[key]);
        });

        const files = photoDropzone.files;
        if (files.length > 0) {
          formData.append("photo", files[0]);
        }

        await withBlock("#item-modal .modal-content", {
          opacity: 0.5,
          primary: true,
        })(async () => {
          try {
            const response = await fetch("/upsert_item", {
              headers: {
                Authorization: `Bearer ${await getCurrentUserToken()}`,
              },
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw await response.json();
            }

            showMessage(
              `Item successfully ${data.id ? "modified" : "added"}.`,
              {
                type: MessageType.SUCCESS,
                element: "#content-container",
              }
            );
          } catch (e: any) {
            showMessage(e.message, {
              type: MessageType.DANGER,
              element: "#content-container",
            });
          } finally {
            itemForm.hide();
          }
        })();
      };

      itemFormElm.addEventListener("submit", onItemFormSubmit);

      const onItemFormHide = () => {
        itemFormValidator.resetForm();
        categorySelect.clear();
        photoDropzone.removeAllFiles(true);
      };

      itemFormElm.addEventListener("hide.mdb.modal", onItemFormHide);

      const categorySelect = new TomSelect("#category-list", {
        create: true,
        placeholder: "Select an category",
        sortField: "name",
        maxItems: 1,
        valueField: "id",
        labelField: "name",
        searchField: ["name", "id"],
        options: initialData.categories,
        hidePlaceholder: true,
        render: {
          option: function (data: any) {
            const div = document.createElement("div");
            div.className = "d-flex align-items-center";

            const span = document.createElement("span");
            span.className = "flex-grow-1";
            span.innerHTML = decodeHtml(data.name);
            div.append(span);

            const a = document.createElement("a");
            a.innerText = `#${data.id}`;
            a.className = "btn btn-sm btn-light";
            div.append(a);
            a.addEventListener("click", function (evt) {
              evt.stopPropagation();
              alert(`You clicked # within the "${data.text}" option`);
            });

            return div;
          },
        },
      });

      const procurementForm = document.querySelector("#procurement-form");

      assert(
        procurementForm instanceof HTMLFormElement,
        "Procurement form undefined or not form"
      );

      const procurementModal = new Modal(procurementForm);
      const procurementTableBody = document.querySelector(
        "#procurement-form tbody"
      );

      assert(
        procurementTableBody instanceof HTMLTableSectionElement,
        "Procurement table body undefined or incorrect type"
      );

      const procurementItemTemplate =
        document.querySelector("#item-row-template");

      assert(
        procurementItemTemplate instanceof HTMLTemplateElement,
        "Item template undefined or not HTMLTemplateElement"
      );

      const itemTableElm = document.querySelector("#item-table");

      assert(
        itemTableElm instanceof HTMLElement,
        "Item table undefined or incorrect type"
      );

      $.fn.dataTable.Buttons.defaults.dom?.button?.className &&
        ($.fn.dataTable.Buttons.defaults.dom.button.className = "btn");

      const itemTable = new DataTable(itemTableElm, {
        rowId: "id",
        layout: {
          topStart: {
            buttons: [
              TableAction.generateExportButtonConfig({ columns: [1, 3, 4, 5] }),
              {
                text: `<i class="bi bi-box-arrow-in-up-right fw-bold me-2"></i>Consult`,
                className: "btn btn-light",
                action: async function () {
                  const data = itemTable
                    .rows({ selected: true })
                    .data()
                    .toArray();
                  if (!data || data.length === 0) {
                    return;
                  }
                  chatManager.setData(
                    {
                      table: data.map((row) => {
                        return _.omit(row, ["reviews"]);
                      }),
                    },
                    "Item Table Selected Data"
                  );
                  itemTable.buttons.info(
                    "Attached to chat",
                    "Data has been sent to chatbot",
                    1500
                  );
                },
              },
            ],
          },
          topEnd: {
            buttons: [
              {
                text: `<i class="bi bi-bag fw-bold me-2"></i>Procurement`,
                className: "btn btn-secondary",
                action: function (e, dt, node, config) {
                  const data = itemTable.rows(".selected").data().toArray();

                  if (!data || data.length === 0) {
                    alert("Please select at least one item for procurement.");
                    return;
                  }

                  procurementTableBody.innerHTML = "";

                  data.forEach((row) => {
                    const itemElement: HTMLElement = (
                      procurementItemTemplate.content.cloneNode(
                        true
                      ) as HTMLElement
                    ).firstElementChild as HTMLElement;

                    const id = `item-${row.id}`;

                    itemElement.id = id;

                    procurementTableBody.appendChild(itemElement);

                    mapToElement([
                      { selector: `#${id} input[name='id']`, value: row.id },
                      {
                        selector: `#${id} input[name='name']`,
                        value: row.name,
                      },
                    ]);
                  });

                  procurementModal.show();
                },
              },
              {
                text: `<i class="bi bi-plus-lg fw-bold me-2"></i>Add new item`,
                className: "btn btn-primary",
                action: function (e, dt, node, config) {
                  itemForm.show();
                },
              },
            ],
          },
        },
        select: {
          style: "multi",
          selector: "td:not(:last-child)",
        },
        scrollCollapse: true,
        order: [[2, "asc"]],
        processing: true,
        serverSide: false,
        responsive: {
          details: {
            type: "column",
          },
        },
        paging: true,
        pageLength: 4,
        lengthChange: false,
        searching: true,
        ordering: true,
        columns: [
          {
            data: null,
            orderable: false,
            className: "dtr-control",
            defaultContent: "",
          },
          {
            data: null,
            orderable: false,
            render: DataTable.render.select(),
          },
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
            render: function (data) {
              return `<img src="${
                data ??
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTKnKnw0MtmVH5_-A-wrEh5OiTSL3lu_5MZZA&s"
              }" alt="Item Photo" class="object-fit-cover" style="width: 60px; height: 60px;" />`;
            },
          },
          { data: "name", title: "Item Name" },
          {
            data: "category",
            title: "Category",
            orderable: false,
            render: function (data) {
              return `<div class="badge bg-primary d-block mb-1 py-2" style="width: min-content;">&nbsp;${data}&nbsp;</div>`;
            },
          },
          {
            data: "last_update",
            title: "Last Update",
            // @ts-ignore
            render: DataTable.render.intlDateTime("en-US", {
              dateStyle: "medium",
            }),
          },
          {
            data: null,
            title: "Action",
            orderable: false,
            render: function (data: any) {
              return `${TableAction.generateActionHTML({
                type: "edit",
                className: "edit-icon",
              })} ${TableAction.generateActionHTML({
                type: "delete",
                className: "delete-icon",
              })}`;
            },
          },
        ],
        initComplete: (settings, json) => {
          const table = settings.oInstance.api();

          table.rows.add(initialData.data).draw();
          table.responsive.recalc();

          TableAction.attachListeners({
            selector: "tr .edit-icon",
            table: table,
            callback(this, event, d) {
              mapToElement([
                { selector: "#item-modal input[name='id']", value: d.id },
                { selector: "#item-modal input[name='name']", value: d.name },
                { selector: "#vendor-modal .modal-title", value: "Edit Item" },
              ]);
              console.log(d);

              categorySelect.setValue(
                _.find(initialData.categories, {
                  name: d.category,
                }).id
              );
              fetch(d.photo)
                .then((response) => {
                  if (!response.ok) {
                    throw new Error(
                      `Failed to fetch image: ${response.statusText}`
                    );
                  }
                  return response.blob();
                })
                .then((blob) => {
                  const fileName = d.photo.split("/").pop();
                  const file = new File([blob], fileName, { type: blob.type });
                  photoDropzone.addFile(file as any);
                })
                .catch((error) => {
                  console.error("Error fetching and adding image:", error);
                });
              itemForm.show();
            },
          });

          TableAction.attachListeners({
            selector: "tr .delete-icon",
            table: table,
            callback: async function (this: HTMLElement, event, d) {
              const apiRequestCallback = TableAction.createApiRequestCallback({
                message: "Are you sure you want to delete this item?",
                url: `/delete_item/${d.id}`,
                method: "DELETE",
                token: (await getCurrentUserToken())!,
              });
              await apiRequestCallback();
            },
          });

          const searchBox = document.querySelector("#searchbox");
          if (searchBox) {
            searchBox.addEventListener("input", function (evt) {
              const inputElement = evt.target;
              if (inputElement instanceof HTMLInputElement) {
                itemTable.search(inputElement.value).draw();
              }
            });
          } else {
            console.error("Search box not found in the DOM.");
          }
        },
      });

      const procurementSchema = Joi.object({
        id: Joi.alternatives().try(
          Joi.string().required().messages({
            "string.base": "ID must be a string",
            "any.required": "ID is required",
          }),
          Joi.array().items(Joi.string().required()).messages({
            "array.base": "ID must be an array of strings",
            "any.required": "ID is required",
          })
        ),
        name: Joi.alternatives().try(
          Joi.string().required().messages({
            "string.base": "Name must be a string",
            "any.required": "Name is required",
          }),
          Joi.array().items(Joi.string().required()).messages({
            "array.base": "Name must be an array of strings",
            "any.required": "Name is required",
          })
        ),
        quantity: Joi.alternatives().try(
          Joi.number().integer().min(1).required().messages({
            "number.base": "Quantity must be a number",
            "number.integer": "Quantity must be an integer",
            "number.min": "Quantity must be at least 1",
            "any.required": "Quantity is required",
          }),
          Joi.array().items(Joi.number().integer().min(1).required()).messages({
            "array.base": "Quantity must be an array of numbers",
            "any.required": "Quantity is required",
          })
        ),
        price: Joi.alternatives().try(
          Joi.string().required().messages({
            "string.base": "Price must be a string",
            "any.required": "Price is required",
          }),
          Joi.array().items(Joi.string().required()).messages({
            "array.base": "Price must be an array of strings",
            "any.required": "Price is required",
          })
        ),
      });

      const procurementFormValidator = new FormValidator(
        procurementSchema,
        procurementForm
      );

      procurementFormValidator.attachValidation();

      const onProcurementFormSubmit = async (evt: SubmitEvent) => {
        evt.preventDefault();
        const data = procurementFormValidator.validateForm();

        if (!data) {
          return;
        }

        await withBlock("#procurement-form .modal-content", {
          opacity: 0.5,
          primary: true,
        })(async () => {
          try {
            const response = await fetch("/add_procurement", {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${await getCurrentUserToken()}`,
              },
              method: "POST",
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw await response.json();
            }

            showMessage("Procurement successfully added.", {
              type: MessageType.SUCCESS,
              element: "#content-container",
            });
          } catch (e: any) {
            showMessage(e.message, {
              type: MessageType.DANGER,
              element: "#content-container",
            });
          } finally {
            procurementModal.hide();
          }
        })();
      };

      const categorySuggestions = initialData.categories.map(
        (category: any) => ({
          type: "table",
          tableId: "item-table",
          title: `Select items with category ${category.name}`,
          topN: 10,
          filter: { category: category.name },
        })
      );

      const chatManager = ChatManager.getOrCreateInstance(categorySuggestions);

      procurementForm.addEventListener("submit", onProcurementFormSubmit);

      resolve(async () => {
        dataManager.unsubscribe();
        itemTable.destroy();
        procurementForm.removeEventListener("submit", onProcurementFormSubmit);
      });
    })();
  });
}
