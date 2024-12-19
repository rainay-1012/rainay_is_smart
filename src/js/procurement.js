import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.bootstrap5.css";
import { fetchItemData } from "./item";

export async function initProcurement() {
  document.querySelector("#content-title").innerHTML = "Procurement";
  let items = await fetchItemData();

  const itemSelect = new TomSelect("#item-list", {
    create: true,
    placeholder: "Select an item",
    sortField: {
      field: "id",
      direction: "asc",
    },
    maxItems: 1,
    valueField: "id",
    labelField: "name",
    searchField: "name",
    options: items,
    render: {
      option: function (data) {
        const div = document.createElement("div");
        div.className = "d-flex align-items-center";

        const span = document.createElement("span");
        span.className = "flex-grow-1";
        span.innerText = data.name; // Use 'data.name' instead of 'data.text'
        div.append(span);

        const a = document.createElement("div");
        a.innerText = data.id;
        a.className = "bg-light py-1 px-2 rounded";
        div.append(a);

        return div;
      },
    },
  });

  const addItemForm = document.querySelector("#item-form");
  let newItems = [];

  const procurementTableBody = document.querySelector(
    "#procurement-table tbody"
  );
  const itemRowTemplate = document.querySelector("#item-row");
  let isItemEmpty = true;

  function insertItemRow(data) {
    if (isItemEmpty) procurementTableBody.innerHTML = "";
    isItemEmpty = false;
    let itemRow = itemRowTemplate.content.cloneNode(true);
    itemRow.querySelector(".iid").innerHTML = data.id;
    itemRow.querySelector(".iname").innerHTML = data.name;
    itemRow.querySelector(".icount").innerHTML = data.count;
    itemRow.querySelector(".iprice").innerHTML = data.price;
    const idelete = itemRow.querySelector(".idelete");
    procurementTableBody.appendChild(itemRow);
    itemRow = procurementTableBody?.lastElementChild;

    idelete.addEventListener("click", () => {
      itemRow.remove();
      newItems = newItems.filter((item) => item.id !== data.id);
      if (newItems.length === 0) {
        isItemEmpty = true;
        procurementTableBody.innerHTML =
          "<tr><td colspan='6' class='text-center'>No items added yet.</td></tr>";
      }
    });
  }

  const onFormSubmit = async (evt) => {
    evt.preventDefault();
    const formData = new FormData(evt.target);

    const id = formData.get("id");

    const newItem = {
      id: id,
      name: items.find((item) => item.id === id).name,
      count: formData.get("count"),
      price: formData.get("price"),
    };
    itemSelect.clear();
    newItems.push(newItem);
    insertItemRow(newItem);
    addItemForm.reset();
  };

  //rainay
  // Insert into the current tab
  insertItemIntoTab(newItem, currentTabIndex);

  // Move to the next tab
  currentTabIndex = (currentTabIndex % 4) + 1; // Rotate tabs (1-4)

  function insertItemIntoTab(item, tabIndex) {
    const tabPane = tabsContainer.querySelector(`#tab${tabIndex}`);

    if (tabPane) {
      const itemRow = document.createElement("div");
      itemRow.className = "border p-2 mb-2";
      itemRow.innerHTML = `
    <div><strong>ID:</strong> ${item.id}</div>
    <div><strong>Name:</strong> ${item.name}</div>
    <div><strong>Count:</strong> ${item.count}</div>
    <div><strong>Price:</strong> ${item.price}</div>
  `;
      tabPane.appendChild(itemRow);
    }
  }
  //...

  const resetItemForm = () => addItemForm.reset();

  addItemForm.addEventListener("submit", onFormSubmit);

  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  //tabs.forEach(tab => {
  //tab.addEventListener('click', () => {
  // Remove active class from all tabs and contents
  //tabs.forEach(t => t.classList.remove('active'));
  //contents.forEach(c => c.classList.remove('active'));

  // Add active class to clicked tab and corresponding content
  //tab.classList.add('active');
  //document.getElementById(tab.dataset.target).classList.add('active');
  //});
  //});

  // Fetch => item data => store variable

  return new Promise((resolve) => {
    resolve(() => {
      // loginButton.removeEventListener("click", onLoginClick);
      // form.removeEventListener("submit", onFormSubmit);
      // console.log("Register disposed");
    });
  });
}
