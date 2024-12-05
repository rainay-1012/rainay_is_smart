import "../style/auth.scss";
import { login, logout } from "./authentication.js";
import {
  blockElement,
  getRouteFromPath,
  navigate,
  routes,
  unblockElement,
} from "./index.js";

export async function initLogin() {
  await logout();

  const registerButton = document.querySelector("#register");
  const loginForm = document.querySelector("#loginForm");
  const emailField = loginForm.querySelector("#email");
  const passwordField = loginForm.querySelector("#password");
  const submitButton = loginForm.querySelector("button[type=submit]");

  const registerClickHandler = async () => {
    await navigate(routes.register, {
      blockParams: {
        grow: true,
      },
    });
  };
  registerButton.addEventListener("click", registerClickHandler);

  const loginSubmitHandler = async (evt) => {
    evt.preventDefault();
    evt.stopPropagation();

    const fields = loginForm.querySelectorAll("input");
    fields.forEach((field) => {
      field.setCustomValidity("");
    });

    if (loginForm.checkValidity()) {
      const data = new FormData(loginForm);
      const email = data.get("email");
      const password = data.get("password");
      const remember = data.has("remember");
      try {
        blockElement(submitButton, {
          small: true,
          opacity: 0,
          primary: false,
        });
        const response = await login({ email, password, remember });
        console.log(`redirect to:`);
        navigate(getRouteFromPath(response.redirect_to), {
          replace: true,
          blockParams: {
            grow: true,
          },
        });
      } catch (error) {
        const errorCode = error.code;
        switch (errorCode) {
          case "auth/invalid-credential":
            emailField.nextElementSibling.nextElementSibling.innerHTML =
              "Invalid login credential.";
            passwordField.nextElementSibling.nextElementSibling.innerHTML = "";
            emailField.setCustomValidity("Invalid login credential.");
            passwordField.setCustomValidity("Invalid login credential.");
            break;
          default:
            alert(`${errorCode} : ${error.message}`);
        }
      } finally {
        unblockElement(submitButton);
      }
    } else {
      const invalidFields = loginForm.querySelectorAll(":invalid");
      invalidFields.forEach((field) => {
        console.log(`Error in field ${field.name}: ${field.validationMessage}`);
        field.nextElementSibling.nextElementSibling.textContent =
          field.validationMessage;
      });
    }

    loginForm.classList.add("was-validated");
    return false;
  };

  loginForm.addEventListener("submit", loginSubmitHandler);

  return new Promise((resolve) => {
    resolve(() => {
      registerButton.removeEventListener("click", registerClickHandler);
      loginForm.removeEventListener("submit", loginSubmitHandler);
      console.log("Login disposed");
    });
  });
}
