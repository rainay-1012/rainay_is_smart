import DataTable from "datatables.net-bs5";
import "datatables.net-rowgroup";
import { initInput } from ".";
import "../style/dashboard.scss";
import { getCurrentUser } from "./auth";
import { SocketDataManager } from "./socket";
import { assert, showMessage, TableAction, withBlock } from "./utils";

interface Vendor {
  id: string;
  name: string;
  address: string;
  email: string;
  category: string[];
}

export async function initQuotation() {
  return new Promise<() => void>(async (resolve, reject) => {
    await withBlock("#content", {
      type: "border",
      small: false,
    })(async () => {
      initInput();

      const dataManager = await SocketDataManager.getOrCreateInstance({
        rfq: "/get_rfq_data",
      });
      let initialData = [];

      initialData = dataManager.getDataCache("rfq");

      dataManager?.subscribe();

      dataManager?.setEventCallback(
        "rfq",
        "add",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          rfqTable.row.add(data).draw();
        }
      );

      dataManager?.setEventCallback(
        "rfq",
        "delete",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          rfqTable.row(`#${data.id}`).remove().draw();
        }
      );

      dataManager?.setEventCallback(
        "rfq",
        "modify",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          let d = rfqTable.row(`#${data.id}`).data();
          Object.assign(d, data);
          rfqTable.row(`#${data.id}`).invalidate().draw();
        }
      );

      dataManager?.setEventCallback(
        "rfq",
        "change",
        (
          uid: string,
          data: any,
          dataset: any,
          dataType: string,
          eventType: string
        ) => {
          rfqTable.responsive.recalc();
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
          rfqTable.clear();
          rfqTable.rows.add(dataset.data).draw(true);
          rfqTable.responsive.recalc();
          showMessage(
            `Reconencted to server. Data of type ${dataType} has been refreshed to latest.`,
            {
              mode: "toast",
              position: "bottom-right",
            }
          );
        }
      );

      const rfqTableElm = document.querySelector("#quantation-table");

      assert(
        rfqTableElm instanceof HTMLElement,
        "quantation table undefined or invalid type"
      );

      $.fn.dataTable.Buttons.defaults.dom?.button?.className &&
        ($.fn.dataTable.Buttons.defaults.dom.button.className = "btn");

      const rfqTable = new DataTable(rfqTableElm, {
        rowId: "id",
        layout: {
          topStart: {
            buttons: [
              TableAction.generateExportButtonConfig({ columns: [1, 3, 4, 5] }),
            ],
          },
        },
        scrollCollapse: true,
        order: [[1, "asc"]],
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
        rowGroup: {
          dataSrc: "procurement_id",
          startRender: function (rows: any, group: any) {
            // Customize the group header
            return `<strong>Procurement ID: ${group}</strong> (${rows.count()} RFQs)`;
          },
        },
        columns: [
          {
            data: null,
            orderable: false,
            className: "dtr-control",
            defaultContent: "",
          },
          {
            data: "id",
            title: "ID",
            // @ts-ignore
            render: DataTable.render.ellipsis(10, true),
          },
          {
            data: "date",
            title: "Created Date",
            render: function (data: any) {
              return new Date(data).toLocaleString(); // Format the date
            },
          },
          {
            data: "response_time",
            title: "Response Time",
            render: function (data: any) {
              return data ? new Date(data).toLocaleString() : "N/A"; // Format response time or show "Pending"
            },
          },
          {
            data: "status",
            title: "Status",
            orderable: false,
            render: function (status) {
              let colorClass = "text-secondary"; // Default for disabled
              let iconClass = "bi-circle-fill"; // Default icon

              if (status === "enabled") {
                colorClass = "text-warning"; // Warning for enabled
                iconClass = "bi-exclamation-circle-fill"; // Icon for enabled
              } else if (status === "ordered") {
                colorClass = "text-success"; // Success for ordered
                iconClass = "bi-check-circle-fill"; // Icon for ordered
              }

              return `<i class="bi ${iconClass} ${colorClass}"></i>`;
            },
          },
          {
            data: "vendor_name",
            title: "Vendor Name",
          },
          {
            data: null,
            title: "Action",
            orderable: false,
            render: function (data: any) {
              const viewLink = `/view_rfq?token=${data.token}&internal=true`;
              const viewIcon = `<a href="${viewLink}" target="_blank"><i role="button" class="bi bi-eye-fill view-icon"></i></a>`;

              return `${viewIcon}`;
            },
          },
        ],
        initComplete: (settings, json) => {
          const table = settings.oInstance.api();
          table.rows.add(initialData).draw();
          table.responsive.recalc();

          // TableAction.attachListeners({
          //   selector: "tr .edit-icon",
          //   table: table,
          //   callback(this, event, d) {
          //     console.log(d);
          //     mapToElement([
          //       { selector: "#vendor-modal input[name='id']", value: d.id },
          //       { selector: "#vendor-modal input[name='name']", value: d.name },
          //       {
          //         selector: "#vendor-modal input[name='email']",
          //         value: d.email,
          //       },
          //       {
          //         selector: "#vendor-modal input[name='address']",
          //         value: d.address,
          //       },
          //       {
          //         selector: "#vendor-modal .modal-title",
          //         value: "Edit Vendor",
          //       },
          //     ]);

          //     categorySelect.setValue(
          //       _.map(d.categories, (categoryName) => {
          //         const category = _.find(initialData.categories, {
          //           name: categoryName,
          //         });
          //         return category ? category.id : null;
          //       })
          //     );
          //     vendorForm.show();
          //   },
          // });

          // TableAction.attachListeners({
          //   selector: "tr .approval-icon",
          //   table: table,
          //   callback: async function (this: HTMLElement, event, d) {
          //     const apiRequestCallback = TableAction.createApiRequestCallback({
          //       message: "Are you sure you want to approve this vendor?",
          //       url: `/approve_vendor/${d.id}`,
          //       token: (await getCurrentUserToken())!,
          //     });
          //     await apiRequestCallback();
          //   },
          // });

          // TableAction.attachListeners({
          //   selector: "tr .delete-icon",
          //   table: table,
          //   callback: async function (this: HTMLElement, event, d) {
          //     const apiRequestCallback = TableAction.createApiRequestCallback({
          //       message: "Are you sure you want to delete this vendor?",
          //       url: `/delete_vendor/${d.id}`,
          //       method: "DELETE",
          //       token: (await getCurrentUserToken())!,
          //     });
          //     await apiRequestCallback();
          //   },
          // });

          const searchBox = document.querySelector("#searchbox");
          if (searchBox) {
            searchBox.addEventListener("input", function (evt) {
              const inputElement = evt.target;
              if (inputElement instanceof HTMLInputElement) {
                rfqTable.search(inputElement.value).draw();
              }
            });
          } else {
            console.error("Search box not found in the DOM.");
          }
        },
      });

      resolve(() => {
        // vendorForm.dispose();
        // vendorFormElm.removeEventListener("submit", onVendorFormSubmit);
        // vendorFormElm.removeEventListener("hide.mdb.modal", onVendorFormHide);
        dataManager.unsubscribe();
        // vendormFormValidator.dispose();
        // vendorTable.destroy();
      });
    })();
  });
}
