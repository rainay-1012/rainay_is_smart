import { navigate, routes } from ".";

export async function initUserManual() {
const returnButton = document.getElementById("return");

if (returnButton) {
    returnButton.addEventListener("click", async () => {
    await navigate(routes.vendor, {});
  });
}
}

/* // Define the printPage function
  function printPage() {
    console.log("Print button clicked"); // Debugging line
    // Expand all <details> elements
    const detailsElements = document.querySelectorAll("details");
    detailsElements.forEach((details) => {
      details.open = true; // Open all dropdowns
      details.setAttribute("aria-expanded", "true"); // Improve accessibility
    });
    // Trigger the print dialog
    window.print();
  }

  // Attach the event listener after the DOM is loaded
  document.addEventListener("DOMContentLoaded", () => {
    const printButton = document.getElementById("print");
    if (printButton) {
      printButton.addEventListener("click", printPage);
    }
  }); */
