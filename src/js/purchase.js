import { Modal } from "bootstrap";
import { getCurrentUserToken } from "./auth";

export async function initPurchasePage() {
  document.querySelector("#content-title").innerHTML = "Purchase";

  console.log(await getCurrentUserToken());

  const addNewPurchaseModalElm = document.querySelector(
    "#add-new-purchase-modal"
  );
  if (!addNewPurchaseModalElm) {
    console.log(`Add new procurement modal: ${addNewPurchaseModalElm}`);
    return;
  }
  const addNewPurchaseModal = new Modal(addNewPurchaseModalElm);
  const purchaseModalBody = addNewPurchaseModalElm.querySelector(".modal-body");

  const purchaseTableElm = document.querySelector("#purchase-table");
  $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";
  if (!purchaseTableElm) {
    console.log(`Purchase table elm: ${purchaseTableElm}`);
    return;
  }

  const purchaseTable = new DataTable(purchaseTableElm, {
    ajax: {
      dataSrc: "",
      url: "/",
      headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
    },
    rowId: "id",
    layout: {
      topStart: {
        buttons: [
          {
            extend: "collection",
            text: `<i class="bi bi-arrow-bar-up fw-bold me-2"></i>Export`,
            className: "btn-dark",
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
            text: `<i class="bi bi-receipt-cutoff fw-bold me-2"></i>Purchase`,
            className: "btn btn-outline-primary me-1",
            action: function (e, dt, node, config) {
              const data = purchaseTable.rows(".selected").data().toArray();
              purchaseModalBody.innerHTML = "";
              data.forEach((row) => {
                console.log(row);
                const rfqId = row.id;
                const rowElement = document.createElement("tr");
                rowElement.innerHTML = `
                  <td>
                    <input
                      name="id[]"
                      type="text"
                      value="${rfqId}"
                      hidden
                    />
                  </td>
                `;
                purchaseModalBody.appendChild(rowElement);
              });
              addNewPurchaseModal.show(); // Use the correct modal instance
            },
          },
        ],
      },
    },
  });

  return new Promise((resolve) => {
    resolve();
  });
}
