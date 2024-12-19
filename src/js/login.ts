import { FirebaseError } from "@firebase/app";
import { Modal } from "bootstrap";
import {
  AlertType,
  assert,
  getRouteFromPath,
  navigate,
  routes,
  showAlert,
  withBlock,
} from ".";
import "../style/auth.scss";
import { handleForgotPassword, login } from "./auth";

export async function initLogin() {
  const registerButton = document.querySelector("#register");
  assert(
    registerButton instanceof HTMLElement,
    "Register button is undefined or not HTMLElement"
  );

  const registerClickHandler = async () => {
    await navigate(routes.register, {
      blockParams: {
        grow: true,
      },
    });
  };

  const loginForm = document.querySelector("#login-form");

  assert(
    loginForm instanceof HTMLFormElement,
    "Login form is undefined or not HTMFormElement"
  );

  const emailField = loginForm.querySelector("#email");
  const passwordField = loginForm.querySelector("#password");
  const emailFieldFeedback =
    emailField?.parentElement?.querySelector(".invalid-feedback");
  const passwordFieldFeedback =
    passwordField?.parentElement?.querySelector(".invalid-feedback");

  assert(
    emailField instanceof HTMLInputElement &&
      passwordField instanceof HTMLInputElement &&
      emailFieldFeedback instanceof HTMLElement &&
      passwordFieldFeedback instanceof HTMLElement,
    "Undefine fields email/password (or their associate label) or none valid types of HTMLInputElement/HTMLElement."
  );

  const loginSubmitHandler = async (evt: SubmitEvent) => {
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
      assert(
        typeof email === "string" && typeof password === "string",
        "Missing required fields (email or password) or not string"
      );

      assert(
        evt.submitter instanceof HTMLElement,
        "Submit button undefined or not HTMLElement"
      );

      const remember = data.has("remember");

      console.log("hi");

      await withBlock(evt.submitter, {
        small: true,
        opacity: 0,
        primary: false,
      })(async () => {
        try {
          const response = await login({ email, password, remember });
          navigate(getRouteFromPath(response.redirect), {
            replace: true,
            blockParams: {
              grow: true,
            },
          });
        } catch (error) {
          if (error instanceof FirebaseError) {
            const errorCode = error.code;
            switch (errorCode) {
              case "auth/invalid-credential":
                emailFieldFeedback.innerHTML = "Invalid login credential.";
                passwordFieldFeedback.innerHTML = "";
                emailField.setCustomValidity("Invalid login credential.");
                passwordField.setCustomValidity("Invalid login credential.");
                break;
              default:
                showAlert(`${error.name} : ${error.message}`, {
                  type: AlertType.DANGER,
                  position: "fixed-top",
                });
            }
          }
        }
      })();
    } else {
      const invalidFields = loginForm.querySelectorAll(":invalid");

      assert(
        invalidFields instanceof NodeList &&
          [...invalidFields].every(
            (field) => field instanceof HTMLInputElement
          ),
        "Invalid fields undefined or not list of HTMLInputElement"
      );
      invalidFields.forEach((field) => {
        const inputField = field as HTMLInputElement;
        const feedback =
          inputField.parentElement?.querySelector(".invalid-feedback");
        if (feedback) {
          feedback.textContent = inputField.validationMessage;
        }
      });
    }

    loginForm.classList.add("was-validated");
    return false;
  };

  registerButton.addEventListener("click", registerClickHandler);

  loginForm.addEventListener("submit", loginSubmitHandler);

  const forgotPasswordModalElm = document.getElementById(
    "forgot-password-modal"
  );

  assert(
    forgotPasswordModalElm instanceof HTMLFormElement,
    "Forgot password form undefined or not HTMLFormElement"
  );

  const forgotPasswordModal = new Modal(forgotPasswordModalElm);

  const onForgotPasswordSubmit = async (event: SubmitEvent) => {
    event.preventDefault();

    const emailInput = document.getElementById(
      "forgot-email"
    ) as HTMLInputElement;

    if (!emailInput) {
      console.error("Email input field not found.");
      return;
    }

    const email = emailInput.value.trim();

    if (!email) {
      emailInput.setCustomValidity("Please provide an email address.");
      emailInput.reportValidity();
      return;
    }

    emailInput.setCustomValidity("");

    await handleForgotPassword(email);

    forgotPasswordModal.hide();
  };

  forgotPasswordModalElm.addEventListener("submit", onForgotPasswordSubmit);

  return new Promise((resolve) => {
    resolve(() => {
      registerButton.removeEventListener("click", registerClickHandler);
      loginForm.removeEventListener("submit", loginSubmitHandler);
      forgotPasswordModalElm.removeEventListener(
        "submit",
        onForgotPasswordSubmit
      );

      console.warn("Login disposed");
    });
  });
}
