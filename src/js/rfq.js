export async function initRFQ() {
  const url = new URL(window.location.href);
  const token = new URLSearchParams(url.search).get("token");

  const date = document.querySelector("#date");
  const rfqID = document.querySelector("#rfq-id");
  const vendorName = document.querySelector("#vendor-name");

  date.innerHTML = "12/12/2029";
  rfqID.innerHTML = "12345";
  vendorName.innerHTML = "Starbucks";

  const tbody = document.querySelector("tbody");
  const trowTemplate = document.querySelector("#item");
  let isChanged = false;
  const changed = document.querySelector("#change");
  const form = document.querySelector("form");
  const totalElm = document.querySelector("#total");
  let rowTotals;

  form.addEventListener("submit", (evt) => {
    evt.preventDefault();

    isChanged = false;
    changed.textContent = "All changes are saved";
  });

  function updateAmount() {
    let total = 0;

    rowTotals.forEach((elm) => {
      const row = elm.parentElement;
      console.log(row.querySelector(".quantity input"));
      const quantity = row.querySelector(".quantity input");
      const price = row.querySelector(".price input");
      const subtotal = quantity.value * price.value;
      elm.innerHTML = Number(subtotal).toFixed(2);
      total += subtotal;
    });

    totalElm.innerHTML = Number(total).toFixed(2);
  }

  let data = [
    {
      id: "A003",
      name: "item C",
      quantity: 3,
      price: 20,
    },
    {
      id: "A003",
      name: "item C",
      quantity: 5,
      price: 40,
    },
  ];

  async function fetchRFQTableData() {
    try {
      const response = await fetch("/get_rfq_data", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        console.log(response.statusText);
        return;
      }
      data = await response.json();
      fetchRFQTableData();
      console.log(data);
    } catch (e) {
      console.log(`Error fetching RFQ data: ${e}`);
    }
  }

  function populateItems(data) {
    data.forEach((item) => {
      const row = trowTemplate.content.cloneNode(true);
      row.querySelector(".id").textContent = item.id;
      row.querySelector(".name").textContent = item.name;
      const quantity = row.querySelector(".quantity input");
      quantity.addEventListener("input", (evt) => {
        isChanged = true;
        changed.textContent = "Unsave changes";
        updateAmount();
      });
      quantity.value = item.quantity;
      const price = row.querySelector(".price input");
      price.value = item.price;
      price.addEventListener("input", (evt) => {
        isChanged = true;
        changed.textContent = "Unsave changes";
        updateAmount();
      });
      row.querySelector(".total").textContent = Number(
        item.quantity * item.price
      ).toFixed(2);
      tbody.appendChild(row);
    });
    rowTotals = document.querySelectorAll(".total");
  }

  populateItems(data);

  const printBtn = document.querySelector("#print-btn");
  printBtn?.addEventListener("click", () => window.print());

  return new Promise((resolve) => {
    resolve(() => {
      // loginButton.removeEventListener("click", onLoginClick);
      // form.removeEventListener("submit", onFormSubmit);
      // console.log("Register disposed");
    });
  });
}
