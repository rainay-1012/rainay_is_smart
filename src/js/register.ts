import { Carousel, Tooltip } from "bootstrap";
import {
  assert,
  GeneralResponse,
  getRouteFromPath,
  navigate,
  routes,
  withBlock,
} from ".";
import "../style/auth.scss";
import {
  getCurrentUserToken,
  logout,
  signUpWithGoogle,
  validateToken,
} from "./auth";

export async function initRegister() {
  const loginButton = document.querySelector("#login");

  const onLoginClick = async () => {
    await navigate(routes.login, {
      blockParams: {
        grow: true,
      },
    });
  };

  assert(
    loginButton instanceof HTMLElement,
    "Login button undefined or not HTMLElement"
  );

  // const form = document.querySelector("form");

  // assert(
  //   form instanceof HTMLFormElement,
  //   "Form undefined or not HTMLFormElement"
  // );

  // const emailField = form.querySelector("#email");
  // const passwordField = form.querySelector("#password");
  // const confirmPasswordField = form.querySelector("#confirmPassword");
  // const tokenField = form.querySelector("#token");

  // assert(
  //   emailField instanceof HTMLInputElement &&
  //     passwordField instanceof HTMLInputElement &&
  //     confirmPasswordField instanceof HTMLInputElement &&
  //     tokenField instanceof HTMLInputElement,
  //   "One or more of the form fields undefined or not HTMLInputElement"
  // );

  // const emailFieldFeedback =
  //   emailField?.parentElement?.querySelector(".invalid-feedback");
  // const passwordFieldFeedback =
  //   passwordField?.parentElement?.querySelector(".invalid-feedback");
  // const confirmPasswordFieldFeedback =
  //   confirmPasswordField?.parentElement?.querySelector(".invalid-feedback");
  // const tokenFieldFeedback =
  //   tokenField?.parentElement?.querySelector(".invalid-feedback");

  // assert(
  //   emailFieldFeedback instanceof HTMLElement &&
  //     passwordFieldFeedback instanceof HTMLElement &&
  //     confirmPasswordFieldFeedback instanceof HTMLElement &&
  //     tokenFieldFeedback instanceof HTMLElement,
  //   "One or more of the form feedback fields undefined or not HTMLElement"
  // );

  // const fields = form.querySelectorAll("input");

  // const onFormSubmit = async function (evt: SubmitEvent) {
  // evt.preventDefault();
  // evt.stopPropagation();
  // fields.forEach((field) => {
  //   field.setCustomValidity("");
  // });

  // if (passwordField.value !== confirmPasswordField.value) {
  //   confirmPasswordFieldFeedback.innerHTML = "Passwords do not match.";
  //   confirmPasswordField.setCustomValidity("Passwords do not match.");
  //   return;
  // }

  // if (form.checkValidity()) {
  //   const data = new FormData(form);
  //   const email = data.get("email");
  //   const password = data.get("password");
  //   const token = data.get("token");

  //   assert(
  //     typeof email === "string" &&
  //       typeof password === "string" &&
  //       typeof token === "string",
  //     "Missing required fields (email or password) or not string"
  //   );

  //   assert(
  //     evt.submitter instanceof HTMLElement,
  //     "Submit button undefined or not HTMLElement"
  //   );

  //   await withBlock(evt.submitter, {
  //     small: true,
  //     opacity: 0,
  //     primary: false,
  //   })(async () => {
  //     await signup({ email, password, token })
  //       .then(async () => {
  //         await logout();
  //         await navigate(routes.login, {
  //           blockParams: {
  //             grow: true,
  //           },
  //           alert:
  //             "A verification email has been sent. Please check your inbox.",
  //         });
  //       })
  //       .catch((error) => {
  //         if (error instanceof FirebaseError) {
  //           const errorCode = error.code;
  //           switch (errorCode) {
  //             case "auth/invalid-email":
  //               emailFieldFeedback.innerHTML = "Invalid email address.";
  //               emailField.setCustomValidity("Invalid email address.");
  //               break;
  //             case "auth/invalid-password":
  //               passwordFieldFeedback.innerHTML =
  //                 "Password must be at least 6 characters long and must not be empty.";
  //               passwordField.setCustomValidity(
  //                 "Password must be at least 6 characters long and must not be empty."
  //               );
  //               break;
  //             case "auth/invalid-token":
  //               tokenFieldFeedback.innerHTML = error.message;
  //               tokenField.setCustomValidity(error.message);
  //               break;
  //             default:
  //               showAlert(`${error.name} : ${error.message}`, {
  //                 type: AlertType.DANGER,
  //                 position: "fixed-top",
  //               });
  //           }
  //         } else {
  //           const err = error as ContentResponse;
  //           showAlert(`${err.name} : ${err.message}`, {
  //             type: AlertType.DANGER,
  //             position: "fixed-top",
  //           });
  //         }
  //       });
  //   })();
  // } else {
  //   const invalidFields = form.querySelectorAll(":invalid");

  //   assert(
  //     invalidFields instanceof NodeList &&
  //       [...invalidFields].every(
  //         (field) => field instanceof HTMLInputElement
  //       ),
  //     "Invalid fields undefined or not list of HTMLInputElement"
  //   );
  //   invalidFields.forEach((field) => {
  //     const inputField = field as HTMLInputElement;
  //     const feedback =
  //       inputField.parentElement?.querySelector(".invalid-feedback");
  //     if (feedback) {
  //       feedback.textContent = inputField.validationMessage;
  //     }
  //   });
  // }

  // form.classList.add("was-validated");
  // return false;
  // };

  loginButton.addEventListener("click", onLoginClick);
  // form.addEventListener("submit", onFormSubmit);

  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  const tooltipList = [...tooltipTriggerList].map(
    (tooltipTriggerEl) =>
      new Tooltip(tooltipTriggerEl, {
        boundary: document.querySelector(
          "#token-form .form-floating"
        ) as Element,
      })
  );

  const formCarouselElm = document.querySelector("#form-carousel");

  assert(
    formCarouselElm instanceof HTMLElement,
    "Form carousel undefined or not instance of HTMLElement"
  );

  const formCarousel = new Carousel(formCarouselElm);

  const tokenForm = document.querySelector("#token-form");

  assert(
    tokenForm instanceof HTMLFormElement,
    "Token form undefined or not instance of HTMLFormElement"
  );

  const tokenField = tokenForm.querySelector("#token");
  const tokenFieldFeedBack =
    tokenField?.parentElement?.querySelector(".invalid-feedback");

  assert(
    tokenField instanceof HTMLInputElement &&
      tokenFieldFeedBack instanceof HTMLElement,
    "Token field/feedback undefined or not HTMLInputElement/HTMLElement"
  );

  const onTokenFormSubmit = async (evt: SubmitEvent) => {
    evt.preventDefault();

    evt.preventDefault();
    evt.stopPropagation();
    tokenField.setCustomValidity("");

    if (tokenForm.checkValidity()) {
      const data = new FormData(tokenForm);
      const token = data.get("token");

      assert(typeof token === "string", "Missing token value or not string");

      assert(
        evt.submitter instanceof HTMLElement,
        "Submit button undefined or not HTMLElement"
      );

      await withBlock("#card", {
        opacity: 0.5,
        type: "bar",
        primary: false,
      })(async () => {
        const response = await fetch("/verify_token", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const message = ((await response.json()) as GeneralResponse).message;
          tokenField.setCustomValidity(message);
          tokenFieldFeedBack.textContent = message;
          return;
        }

        formCarousel.next();
      })();
    } else {
      const invalidFields = tokenForm.querySelectorAll(":invalid");

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

    tokenForm.classList.add("was-validated");
    return false;
  };

  const googleSignin = document.querySelector("#google-signin");

  assert(
    googleSignin instanceof HTMLElement,
    "Google signin elm undefined or not HTMLElement"
  );

  const onGoogleSigninClick = async () => {
    await withBlock("#card", {
      opacity: 0.5,
      type: "bar",
      primary: false,
    })(async () => {
      try {
        await signUpWithGoogle(tokenField.value);
        const token = await getCurrentUserToken();

        assert(token, "Current user token missing");

        const data = await validateToken(token);
        await navigate(getRouteFromPath(data.redirect));
      } catch (e) {
        await logout(false);
        alert(e);
      }
    })();
  };

  googleSignin.addEventListener("click", onGoogleSigninClick);

  tokenForm.addEventListener("submit", onTokenFormSubmit);

  return new Promise((resolve) => {
    resolve(() => {
      loginButton.removeEventListener("click", onLoginClick);
      // form.removeEventListener("submit", onFormSubmit);
      tooltipList.map((tooltip) => {
        tooltip.dispose();
      });
      tokenForm.removeEventListener("submit", onTokenFormSubmit);
      googleSignin.removeEventListener("click", onGoogleSigninClick);
      console.warn("Register disposed");
    });
  });
}
