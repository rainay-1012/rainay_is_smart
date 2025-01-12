import DataTable from "datatables.net-bs5";
import "list.js";
import List from "list.js";
import _ from "lodash";
import { Modal } from "mdb-ui-kit";
import { initInput } from ".";
import { getCurrentUserToken } from "./auth";
import { SocketDataManager } from "./socket";
import { assert, mapToElement, TableAction, withBlock } from "./utils";
import { showReviews } from "./vendor";

export async function initProcurement() {
  await withBlock("#content", {
    opacity: 0.5,
    primary: true,
  })(async () => {
    initInput();

    const slider = document.querySelector("#procurement-list-inner");

    assert(
      slider instanceof HTMLElement,
      "Procurement list inner undefined or invalid type"
    );

    let isDown: boolean = false;
    let startX: number;
    let scrollLeft: number;

    slider.addEventListener("mousedown", (e: MouseEvent) => {
      isDown = true;
      slider.classList.add("active");
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener("mouseleave", () => {
      isDown = false;
      slider.classList.remove("active");
    });

    slider.addEventListener("mouseup", () => {
      isDown = false;
      slider.classList.remove("active");
    });

    slider.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 3; // scroll-fast
      slider.scrollLeft = scrollLeft - walk;
      console.log(walk);
    });

    const dataManager = await SocketDataManager.getOrCreateInstance({
      procurement: "/get_procurement_data",
    });
    let data = [];

    data = dataManager.getDataCache("procurement");

    const procurementList = new List(
      "procurement-list",
      {
        // @ts-ignore
        item: (values: any) => {
          const percentage =
            (values.rfq_complete / values.rfq_total) * 100 || 0;
          const formattedDate = new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(values.date));

          return `
    <div class="border-0  procurement-list-item" data-id="${values.id}">
      <div class="card shadow-2-strong pointer-cursor">
        <div class="card-body p-3">
          <div class="mb-4 d-flex align-items-start justify-content-between">
            <div class="d-flex flex-column justify-content-center me-4">
              <div class="fw-medium small id">#${values.id}</div>
              <small class="text-muted date">${formattedDate.toString()}</small>
            </div>
            <span class="badge badge-${
              percentage === 100 ? "primary" : "warning"
            }  mt-1">${percentage === 100 ? "Processed" : "Pending"}</span>
          </div>
          <div
            class="progress mb-2"
            style="height: 8px"
          >
            <div
              class="progress-bar"
              role="progressbar"
              style="width: ${percentage}%"
            ></div>
          </div>
          <span class="small rfq_complete">
            ${values.rfq_complete}
          </span>
          <span class="small"> RFQs Processed</span>
          <span class="text-muted small">of <span class="rfq_total">${
            values.rfq_total
          }</span> RFQs</span>
        </div>
      </div>
    </div>
    `;
        },
      },
      data.data
    );

    let procurementId;

    $("#procurement-list").on("click", ".procurement-list-item", function () {
      withBlock("#procurement-content", {
        opacity: 1,
        type: "none",
        minTime: 200,
      })(async () => {
        mapToElement([{ selector: "#default-content", className: "d-none" }]);
        document
          .querySelector("#vendor-default-content")
          ?.classList.remove("d-none");
        mapToElement([
          { selector: "#vendor-default-content", value: "No data available" },
        ]);
        procurementId = $(this).attr("data-id");
        vendorList.clear();
        procurementTable
          .clear()
          .rows.add(_.filter(data.data, { id: procurementId }).at(0).items)
          .draw();
      })();
    });

    const searchBox = document.querySelector("#searchbox");
    if (searchBox) {
      searchBox.addEventListener("input", function (evt) {
        const inputElement = evt.target as HTMLInputElement;
        procurementList.search(inputElement.value);
      });
    } else {
      console.error("Search box not found in the DOM.");
    }

    const procurementTableElm = document.querySelector("#procurement-table");

    assert(
      procurementTableElm instanceof HTMLElement,
      "Procurement table undefined or invalid type"
    );

    const procurementTable = new DataTable(procurementTableElm, {
      rowId: "id",

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
          data: "item_id",
          title: "ID",
          // @ts-ignore
          render: DataTable.render.ellipsis(10, true),
        },
        { data: "name", title: "Name", responsivePriority: 10, width: "30%" },
        {
          data: "category",
          title: "Category",
          responsivePriority: 10,
          width: "20%",
        },
        { data: "quantity", title: "Quantity" },
        { data: "unit_price", title: "Unit Price" },
      ],
      initComplete: (settings, json) => {
        const searchBox = document.querySelector("#searchbox");
        if (searchBox) {
          searchBox.addEventListener("input", function (evt) {
            const inputElement = evt.target;
            if (inputElement instanceof HTMLInputElement) {
              procurementTable.search(inputElement.value).draw();
            }
          });
        } else {
          console.error("Search box not found in the DOM.");
        }
      },
    });

    const vendorList = new List("vendor-list", {
      sortClass: "gred",
      // @ts-ignore
      item: (values: any) => {
        let colorClass = "badge-primary";
        if (!values.gred || values.gred < 0) {
          colorClass = "badge-secondary";
        } else if (values.gred <= 33) {
          colorClass = "badge-danger";
        } else if (values.gred <= 66) {
          colorClass = "badge-warning";
        }

        return `
          <li
              class="list-group-item border-start-0 border-end-0 d-flex justify-content-between align-items-center list-group-item-action pointer-cursor"
              data-id=${values.id}
            >
              <span>${values.name}</span>
              <span class="badge ${colorClass} rounded-pill ms-3 gred">${parseFloat(
          values.gred
        ).toFixed(0)}</span>
          </li>
          `;
      },
    });

    const selectedVendors: Set<string> = new Set();
    const vendorListElm = document.querySelector("#vendor-list .list");

    assert(
      vendorListElm instanceof HTMLElement,
      "Vendor list undefined or invalid type"
    );

    const reviewModal = new Modal("#review-modal");
    const reviewList = document.getElementById("review-list");
    const reviewTemplate = document.getElementById("review-template");

    assert(
      reviewList instanceof HTMLElement &&
        reviewTemplate instanceof HTMLTemplateElement,
      "Review list or template undefined or not HTMLElement/HTMLTemplateElement"
    );

    vendorListElm.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const vendor = target.closest("li");

      if (vendor) {
        const vendorId = vendor.getAttribute("data-id");

        if (target.classList.contains("badge")) {
          const d = (vendorList.get("id", vendorId).at(0) as any)._values;
          showReviews(d, reviewTemplate, reviewList);
          reviewModal.show();
          return;
        }

        if (vendorId) {
          if (selectedVendors.has(vendorId)) {
            selectedVendors.delete(vendorId);
            vendor.classList.remove("active");
          } else {
            selectedVendors.add(vendorId);
            vendor.classList.add("active");
          }

          console.log("Selected Items:", Array.from(selectedVendors));
        }
      }
    });

    const suggestionBtn = document.querySelector("#suggestion-btn");

    assert(
      suggestionBtn instanceof HTMLButtonElement,
      "Suggestion btn undefined or invalid type"
    );

    const checkSameCategory = (selectedRows: any[], category: string) => {
      if (selectedRows.length === 1) {
        return true;
      }

      const allSameCategory = selectedRows.every(
        (row) => row.category_id === category
      );

      if (!allSameCategory) {
        vendorList.clear();
        document
          .querySelector("#vendor-default-content")
          ?.classList.remove("d-none");
        mapToElement([
          {
            selector: "#vendor-default-content",
            value: "Category of items mismatched",
          },
        ]);

        return false;
      }
      return true;
    };

    procurementTable.on("select", async function (e, dt, type, indexes) {
      if (type === "row") {
        await handleSelectedRows();
      }
    });

    procurementTable.on("deselect", async function (e, dt, type, indexes) {
      console.log("deselect");
      if (type === "row") {
        console.log("deselect");
        await handleSelectedRows();
      }
    });

    const handleSelectedRows = async () => {
      await withBlock("#vendor-list", {
        opacity: 0.5,
        primary: true,
      })(async () => {
        const selectedRows = procurementTable
          .rows({ selected: true })
          .data()
          .toArray();

        if (selectedRows.length === 0) {
          return;
        }

        const category_id = selectedRows[0].category_id;
        if (!checkSameCategory(selectedRows, category_id)) return;

        const apiRequestCallback = TableAction.createApiRequestCallback({
          url: `/get_suggestion_vendors/${category_id}`,
          token: (await getCurrentUserToken())!,
          method: "GET",
          silent: true,
        });

        const data = (await apiRequestCallback()).data;
        if (data.length > 0) {
          document
            .querySelector("#vendor-default-content")
            ?.classList.add("d-none");
        }

        vendorList.clear();
        vendorList.add(data);
      })();
    };

    const rfqBtn = document.querySelector("#rfq-btn");

    assert(
      rfqBtn instanceof HTMLButtonElement,
      "Suggestion btn undefined or invalid type"
    );

    const onRFQBtnClick = async () => {
      await withBlock("procurement-content", {
        opacity: 0.5,
        primary: true,
        type: "bar",
      })(async () => {
        const selectedRows = procurementTable
          .rows({ selected: true })
          .data()
          .toArray();

        if (selectedRows.length === 0) {
          alert("Must select at least one item");
          return;
        }

        const category_id = selectedRows[0].category_id;
        if (!checkSameCategory(selectedRows, category_id)) {
          alert("Items must be of same category");
          return;
        }

        if (!selectedVendors.size) {
          alert("Must select at least one vendor");
          return;
        }

        const apiRequestCallback = TableAction.createApiRequestCallback({
          url: "/add_rfq",
          token: (await getCurrentUserToken())!,
          body: JSON.stringify({
            id: procurementId!,
            items: selectedRows.map((item) => item.item_id),
            vendors: Array.from(selectedVendors),
          }),
        });

        await apiRequestCallback();
      })();
    };

    rfqBtn.addEventListener("click", onRFQBtnClick);

    return new Promise((resolve) => {
      resolve(() => {
        // suggestionBtn.removeEventListener("click", onSuggestionBtnClick);
        // loginButton.removeEventListener("click", onLoginClick);
        // form.removeEventListener("submit", onFormSubmit);
        // console.log("Register disposed");
      });
    });
  })();
}
