import "../style/auth.scss";
import { logout, signup } from "./authentication.js";
import { blockElement, navigate, routes, unblockElement } from "./index.js";

export async function initRegister() {
  await logout();

  const loginButton = document.querySelector("#login");
  const form = document.querySelector("form");
  const emailField = document.getElementById("email");
  const passwordField = document.getElementById("password");
  const confirmPasswordField = document.getElementById("confirmPassword");
  const tokenField = document.getElementById("token");
  const fields = form.querySelectorAll("input");
  const submitBtn = form.querySelector("button[type=submit]");

  const onLoginClick = async () => {
    await navigate(routes.login, {
      blockParams: {
        grow: true,
      },
    });
  };

  const onFormSubmit = async function (evt) {
    evt.preventDefault();
    evt.stopPropagation();
    fields.forEach((field) => {
      field.setCustomValidity("");
    });

    if (passwordField.value !== confirmPasswordField.value) {
      confirmPasswordField.nextElementSibling.nextElementSibling.innerHTML =
        "Passwords do not match.";
      confirmPasswordField.setCustomValidity("Passwords do not match.");
      return;
    }

    if (form.checkValidity()) {
      const data = new FormData(form);
      const email = data.get("email");
      const password = data.get("password");
      const token = data.get("token");
      blockElement(submitBtn, {
        small: true,
        opacity: 0,
        primary: false,
      });

      await signup({ email, password, token })
        .then(async () => {
          await logout();
          await navigate(routes.login, {
            blockParams: {
              grow: true,
            },
            alert:
              "A verification email has been sent. Please check your inbox.",
          });
        })
        .catch((error) => {
          const errorCode = error.code;
          switch (errorCode) {
            case "auth/invalid-email":
              emailField.nextElementSibling.nextElementSibling.innerHTML =
                "Invalid email address.";
              emailField.setCustomValidity("Invalid email address.");
              break;
            case "auth/invalid-password":
              passwordField.nextElementSibling.nextElementSibling.innerHTML =
                "Password must be at least 6 characters long and must not be empty.";
              passwordField.setCustomValidity(
                "Password must be at least 6 characters long and must not be empty."
              );
              break;
            case "auth/invalid-token":
              tokenField.nextElementSibling.nextElementSibling.innerHTML =
                error.message;
              tokenField.setCustomValidity(error.message);
              break;
            default:
              alert(`${errorCode} : ${error.message}`);
          }
        })
        .finally(() => {
          unblockElement(submitBtn);
        });
    } else {
      const invalidFields = form.querySelectorAll(":invalid");

      invalidFields.forEach((field) => {
        console.log(`Error in field ${field.name}: ${field.validationMessage}`);
        field.nextElementSibling.nextElementSibling.textContent =
          field.validationMessage;
      });
    }

    form.classList.add("was-validated");
    return false;
  };

  loginButton.addEventListener("click", onLoginClick);
  form.addEventListener("submit", onFormSubmit);

  return new Promise((resolve) => {
    resolve(() => {
      loginButton.removeEventListener("click", onLoginClick);
      form.removeEventListener("submit", onFormSubmit);
      console.log("Register disposed");
    });
  });
}
