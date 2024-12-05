import "../style/mgr_dashboard.scss";
import { logout } from "./authentication.js";

export function initExecutiveDashboard() {
  const procurementTable = document
    .querySelector("#procurementTable")
    .getElementsByTagName(["tbody"])[0];
  let isTableEmpty = true;

  for (let i = 0; i < 3; i++) {
    insertProcement("No data", "...");
  }

  function insertProcement(name, count) {
    const newRow = procurementTable.insertRow();

    const cell1 = newRow.insertCell(0);
    const cell2 = newRow.insertCell(1);

    // Add content to the cells
    cell1.textContent = name;
    cell2.textContent = count;
    cell1.classList.add("border-end");
    cell2.classList.add("ps-3");
  }

  document
    .querySelector("#procurementForm")
    .addEventListener("submit", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const data = new FormData(evt.target);
      if (isTableEmpty) {
        procurementTable.innerHTML = "";
      }
      isTableEmpty = false;
      const d = data.values();
      console.log(d);
      insertProcement(data.get("name"), data.get("count"));
    });

  document
    .querySelector("#signoutBtn")
    .addEventListener("click", async (evt) => {
      await logout();
    });
}
