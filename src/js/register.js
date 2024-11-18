import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'boxicons/css/boxicons.min.css';
import '../assets/logo only.svg';
import '../style/auth.scss';

document
.querySelector("form")
.addEventListener("submit", function (event) {
  const form = event.target;
  const password = document.getElementById("password").value;
  const confirmPassword =
    document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    document
      .getElementById("confirmPassword")
      .setCustomValidity("Passwords do not match.");
    document.getElementById("confirmPassword").reportValidity();
    event.preventDefault();
  } else {
    document.getElementById("confirmPassword").setCustomValidity("");
  }

  if (!form.checkValidity()) {
    event.preventDefault();
    form.classList.add("was-validated");
  }
});