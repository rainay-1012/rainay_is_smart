import { Collapse } from "bootstrap";
import DataTable from "datatables.net-bs5";
import "dropzone/dist/dropzone.css";
import Joi from "joi";
import _ from "lodash";
import { initMDB, Modal } from "mdb-ui-kit";
import TomSelect from "tom-select";
import { initInput } from ".";
import "../style/dashboard.scss";
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
  TableSuggestion,
  withBlock,
} from "./utils";

interface Vendor {
  id: string;
  name: string;
  address: string;
  email: string;
  category: string[];
}

export const showReviews = (
  d: any,
  reviewTemplate: HTMLTemplateElement,
  list: HTMLElement
) => {
  if (!d.gred || d.gred < 0) {
    return;
  }
  let colorClass = "bg-success";
  if (d.gred <= 33) {
    colorClass = "bg-danger";
  } else if (d.gred <= 66) {
    colorClass = "bg-warning";
  }
  mapToElement([
    {
      selector: "#review-gred",
      value: `${parseFloat(d.gred).toFixed(2)}%`,
    },
    {
      selector: "#review-gred-progress",
      style: { height: `${d.gred}%` },
      className: colorClass,
    },
  ]);
  d.reviews.forEach((review: any, index: number) => {
    const reviewElement: HTMLElement = (
      reviewTemplate.content.cloneNode(true) as HTMLElement
    ).firstElementChild as HTMLElement;

    const id = `review-${review.id}`;
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(review.date));

    reviewElement.id = id;
    list.appendChild(reviewElement);

    mapToElement([
      {
        selector: `#${id} .review-caption`,
        value: `"${review.caption}"`,
      },
      {
        selector: `#${id} .accordion-collapse`,
        attribute: {
          id: `accordion-collapse-${id}`,
          "data-mdb-parent": `#review-list`,
        },
      },
      {
        selector: `#${id} .accordion-button`,
        attribute: { "data-mdb-target": `#accordion-collapse-${id}` },
        style: review.caption
          ? {}
          : { "pointer-events": "none", "--after-content": "none" },
        className: review.caption ? "" : "no-collapse",
      },
      { selector: `#${id} .review-date`, value: formattedDate },
    ]);

    const stars = reviewElement.querySelectorAll(".bi-star-fill");
    for (let i = 0; i < stars.length; i++) {
      if (i < review.rating) {
        stars[i].classList.add("text-warning");
        stars[i].classList.remove("text-secondary");
      } else {
        stars[i].classList.add("text-secondary");
        stars[i].classList.remove("text-warning");
      }
    }
  });
  initMDB({ Collapse });
};

export async function initVendor() {
  initInput();

  const dataManager = await SocketDataManager.getOrCreateInstance({
    vendor: "/get_vendor_data",
  });
  let initialData = [];

  initialData = dataManager.getDataCache("vendor");

  dataManager?.subscribe();

  dataManager?.setEventCallback(
    "vendor",
    "add",
    (
      uid: string,
      data: any,
      dataset: any,
      dataType: string,
      eventType: string
    ) => {
      vendorTable.row.add(data).draw();
    }
  );

  dataManager?.setEventCallback(
    "vendor",
    "delete",
    (
      uid: string,
      data: any,
      dataset: any,
      dataType: string,
      eventType: string
    ) => {
      vendorTable.row(`#${data.id}`).remove().draw();
    }
  );

  dataManager?.setEventCallback(
    "vendor",
    "modify",
    (
      uid: string,
      data: any,
      dataset: any,
      dataType: string,
      eventType: string
    ) => {
      let d = vendorTable.row(`#${data.id}`).data();
      Object.assign(d, data);
      vendorTable.row(`#${data.id}`).invalidate().draw();
    }
  );

  dataManager?.setEventCallback(
    "vendor",
    "change",
    (
      uid: string,
      data: any,
      dataset: any,
      dataType: string,
      eventType: string
    ) => {
      vendorTable.responsive.recalc();
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

  dataManager?.setEventCallback(
    "vendor",
    "reconnect",
    (
      uid: string,
      data: any,
      dataset: any,
      dataType: string,
      eventType: string
    ) => {
      vendorTable.clear();
      vendorTable.rows.add(dataset.data).draw(true);
      vendorTable.responsive.recalc();
      showMessage(
        `Reconencted to server. Data of type ${dataType} has been refreshed to latest.`,
        {
          mode: "toast",
          position: "bottom-right",
        }
      );
    }
  );

  const vendorFormElm = document.querySelector("#vendor-modal");
  // const chatManager = ChatManager.getInstance();

  assert(
    vendorFormElm instanceof HTMLFormElement,
    "Vendor modal undefined or not HTMLFormElement"
  );

  const vendorForm = new Modal(vendorFormElm);

  const vendorSchema = Joi.object({
    id: Joi.string().allow("").optional(),
    name: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 3 characters long",
      "string.max": "Name must not exceed 100 characters",
    }),
    address: Joi.string().min(5).max(255).required().messages({
      "string.empty": "Address is required",
      "string.min": "Address must be at least 5 characters long",
      "string.max": "Address must not exceed 255 characters",
    }),
    category: Joi.array()
      .items(
        Joi.string().required().messages({
          "string.empty": "Each category must be a non-empty string.",
        })
      )
      .min(1)
      .required()
      .messages({
        "array.base": "Category must be an array.",
        "array.min": "At least one category must be selected.",
        "any.required": "Category is required.",
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } }) // Validate proper email format
      .required()
      .messages({
        "string.empty": "Email is required",
        "string.email": "Email must be a valid email address",
      }),
  });

  const vendormFormValidator = new FormValidator(vendorSchema, vendorFormElm);

  vendormFormValidator.attachValidation();

  const onVendorFormSubmit = async (evt: SubmitEvent) => {
    evt.preventDefault();
    const data = vendormFormValidator.validateForm();

    if (!data) {
      return;
    }

    await withBlock("#vendor-modal .modal-content", {
      opacity: 0.5,
      primary: true,
    })(async () => {
      try {
        const response = await fetch("/upsert_vendor", {
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

        showMessage(`Vendor successfully ${data.id ? "modified" : "added"}.`, {
          type: MessageType.SUCCESS,
          element: "#content-container",
        });
      } catch (e: any) {
        showMessage(e.message, {
          type: MessageType.DANGER,
          element: "#content-container",
        });
      } finally {
        vendorForm.hide();
      }
    })();
  };

  vendorFormElm.addEventListener("submit", onVendorFormSubmit);

  const onVendorFormHide = () => {
    vendormFormValidator.resetForm();
    categorySelect.clear();
  };

  vendorFormElm.addEventListener("hide.mdb.modal", onVendorFormHide);

  const categorySelect = new TomSelect("#category-list", {
    placeholder: "Select an category",
    sortField: "name",
    maxItems: 3,
    valueField: "id",
    labelField: "name",
    searchField: ["name", "id"],
    options: initialData.categories,
    hidePlaceholder: true,
    onItemAdd: function () {
      (this as any).setTextboxValue("");
      (this as any).refreshOptions();
    },
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
        a.className = "badge badge-light";
        div.append(a);

        return div;
      },
    },
  });

  const reviewModal = new Modal("#review-modal");
  const reviewList = document.getElementById("review-list");
  const reviewTemplate = document.getElementById("review-template");

  assert(
    reviewList instanceof HTMLElement &&
      reviewTemplate instanceof HTMLTemplateElement,
    "Review list or template undefined or not HTMLElement/HTMLTemplateElement"
  );

  const vendorTableElm = document.querySelector("#vendor-table");

  assert(
    vendorTableElm instanceof HTMLElement,
    "Vendor table undefined or invalid type"
  );

  $.fn.dataTable.Buttons.defaults.dom?.button?.className &&
    ($.fn.dataTable.Buttons.defaults.dom.button.className = "btn");

  const vendorTable = new DataTable(vendorTableElm, {
    rowId: "id",
    layout: {
      topStart: {
        buttons: [
          TableAction.generateExportButtonConfig({ columns: [1, 3, 4, 5] }),
          {
            text: `<i class="bi bi-box-arrow-in-up-right fw-bold me-2"></i>Consult`,
            className: "btn btn-light",
            action: async function () {
              const data = vendorTable
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
                "Vendor Table Selected Data"
              );
              vendorTable.buttons.info(
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
            text: `<i class="bi bi-plus-lg fw-bold me-2"></i>Add new vendor`,
            className: "btn btn-primary",
            action: function () {
              mapToElement([{ selector: ".modal-title", value: "Add Vendor" }]);
              vendorForm.show();
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
    pageLength: 5,
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
      { data: "name", title: "Name" },
      {
        data: "categories",
        title: "Category",
        orderable: false,
        render: function (data: any, _, row) {
          return data
            .map(function (category: string) {
              return `<div class="badge bg-primary d-block mb-1 py-2" style="width: min-content;">&nbsp;${category}&nbsp;</div>`;
            })
            .join("");
        },
      },
      { data: "email", title: "Email" },
      {
        data: "address",
        title: "Address",
        // @ts-ignore
        render: DataTable.render.ellipsis(20, true),
      },
      {
        data: "gred",
        title: "Gred",
        orderable: false,
        render: function (gred: number) {
          let colorClass = "text-success pointer-cursor";
          if (!gred || gred < 0) {
            colorClass = "text-secondary";
          } else if (gred <= 33) {
            colorClass = "text-danger pointer-cursor";
          } else if (gred <= 66) {
            colorClass = "text-warning pointer-cursor";
          }

          return `<i class="bi bi-circle-fill gred-icon ${colorClass}"></i>`;
        },
      },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: function (data: any) {
          const approvalIcon = `<i role="button" class="bi bi-check-circle ${
            data.approved ? "text-success pe-none" : ""
          } approval-icon"></i>`;

          return `${TableAction.generateActionHTML({
            type: "edit",
            className: "edit-icon",
          })} ${TableAction.generateActionHTML({
            type: "delete",
            className: "delete-icon",
          })} ${approvalIcon}`;
        },
      },
    ],
    initComplete: (settings, json) => {
      const table = settings.oInstance.api();
      table.rows.add(initialData.data).draw();
      table.responsive.recalc();

      TableAction.attachListeners({
        selector: "tr .gred-icon",
        table: table,
        callback(this, event, d) {
          showReviews(d, reviewTemplate, reviewList);
          reviewModal.show();
        },
      });

      TableAction.attachListeners({
        selector: "tr .edit-icon",
        table: table,
        callback(this, event, d) {
          mapToElement([
            { selector: "#vendor-modal input[name='id']", value: d.id },
            { selector: "#vendor-modal input[name='name']", value: d.name },
            { selector: "#vendor-modal input[name='email']", value: d.email },
            {
              selector: "#vendor-modal input[name='address']",
              value: d.address,
            },
            { selector: "#vendor-modal .modal-title", value: "Edit Vendor" },
          ]);
          categorySelect.setValue(d.categories);
          vendorForm.show();
        },
      });

      TableAction.attachListeners({
        selector: "tr .approval-icon",
        table: table,
        callback: async function (this: HTMLElement, event, d) {
          const apiRequestCallback = TableAction.createApiRequestCallback({
            message: "Are you sure you want to approve this vendor?",
            url: `/approve_vendor/${d.id}`,
            token: (await getCurrentUserToken())!,
          });
          await apiRequestCallback();
        },
      });

      TableAction.attachListeners({
        selector: "tr .delete-icon",
        table: table,
        callback: async function (this: HTMLElement, event, d) {
          const apiRequestCallback = TableAction.createApiRequestCallback({
            message: "Are you sure you want to delete this vendor?",
            url: `/delete_vendor/${d.id}`,
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
            vendorTable.search(inputElement.value).draw();
          }
        });
      } else {
        console.error("Search box not found in the DOM.");
      }
    },
  });

  const chatManager = ChatManager.getOrCreateInstance([
    {
      type: "table",
      tableId: "vendor-table",
      title: "Select vendors with top 10 gred",
      topN: 10,
      sort: { gred: "desc" },
    } as TableSuggestion,
  ]);

  return new Promise((resolve) => {
    resolve(() => {
      vendorForm.dispose();
      vendorFormElm.removeEventListener("submit", onVendorFormSubmit);
      vendorFormElm.removeEventListener("hide.mdb.modal", onVendorFormHide);
      dataManager?.unsubscribe();
      vendormFormValidator.dispose();
      vendorTable.destroy();
    });
  });
}
