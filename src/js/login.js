import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/Login Widget.svg";
import "../assets/logo only.svg";
import "../style/auth.scss";

(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        // if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        // }

        form.classList.add("was-validated");
      },
      false
    );
  });
})();

const signin = document.querySelector("#signin");
const role = document.querySelector("#role");

signin.addEventListener("click", (event) => {
  switch (role.value) {
    case "1":
      window.location.replace("dev_dashboard.html");
      break;
    case "2":
      window.location.replace("mgr_dashboard.html");

      break;
    case "3":
      window.location.replace("exec_dashboard.html");
      break;
    default:
    // code block
  }
});
