import { navigate, routes } from ".";

export async function initUserManual() {
  const returnButton = document.getElementById("return");

  if (returnButton) {
    returnButton.addEventListener("click", async () => {
      await navigate(routes.vendor, {});
    });
  }

  document.getElementById("printBtn").addEventListener("click", function () {
    // Store the original body content
    var originalContent = document.body.innerHTML;

    // Open all <details> elements
    var detailsElements = document.querySelectorAll("details");
    detailsElements.forEach(function (details) {
      details.open = true; // Force open the dropdown
    });

    // Get the content of the printArea
    var printContent = document.getElementById("printArea").innerHTML;

    // Create a new HTML structure with margins for printing
    var printDocument = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @media print {
            @page {
              margin: 20mm; /* Apply 20mm margin to all pages */
            }
            body {
              margin: 0; /* Reset body margin for consistency */
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
    </html>
  `;
    // Replace the body content with the printDocument content
    document.body.innerHTML = printDocument;

    // Trigger the print dialog
    window.print();

    // Restore the original body content
    document.body.innerHTML = originalContent;

    // Reload the page to restore functionality (optional)
    window.location.reload();
  });
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
