import { FirebaseError } from "@firebase/util";
import Joi from "joi";
import { Carousel } from "mdb-ui-kit";
import {
  getRouteFromPath,
  initInput,
  navigate,
  Response,
  simulateAsyncRequest,
} from ".";
import "../style/auth.scss";
import {
  getCurrentUser,
  getCurrentUserToken,
  login,
  logout,
  sendResetPassword,
  signup,
  SignupRequest,
  signUpWithSocialLogin,
  SocialLogin,
  validateToken,
} from "./auth";
import {
  assert,
  FormValidator,
  MessageType,
  PasswordToggle,
  showMessage,
  withBlock,
} from "./utils";

export async function initAccount() {
  await withBlock("main", {
    type: "grow",
    primary: true,
    minTime: 250,
  })(async () => {
    initInput();

    const googleSignin = document.querySelector("#google-signin");

    assert(
      googleSignin instanceof HTMLElement,
      "Google signin elm undefined or not HTMLElement"
    );

    const facebookSignin = document.querySelector("#facebook-signin");

    assert(
      facebookSignin instanceof HTMLElement,
      "Google signin elm undefined or not HTMLElement"
    );

    const twitterSignin = document.querySelector("#twitter-signin");

    assert(
      twitterSignin instanceof HTMLElement,
      "Google signin elm undefined or not HTMLElement"
    );

    const onGoogleSigninClick = async () => {
      await onSocialSigninClick(SocialLogin.Google);
    };

    const onFacebookSigninClick = async () => {
      await onSocialSigninClick(SocialLogin.Facebook);
    };

    const onTwitterSigninClick = async () => {
      await onSocialSigninClick(SocialLogin.Twitter);
    };

    const onSocialSigninClick = async (login: SocialLogin) => {
      await withBlock("#card", {
        opacity: 0.5,
        type: "bar",
        primary: false,
      })(async () => {
        try {
          await signUpWithSocialLogin(login);
          await getCurrentUser()?.reload();
          const token = await getCurrentUserToken();

          assert(token, "Current user token missing");

          const data = await validateToken(token);
          await navigate(getRouteFromPath(data.redirect));
        } catch (e) {
          await logout(false);
          console.error(e);
        }
      })();
    };

    const createAccountButton = document.querySelector("#create-account");

    assert(
      createAccountButton instanceof HTMLElement,
      "Login button undefined or not HTMLElement"
    );

    const onCreateAccountClick = async () => {
      formCarousel.to(2);
    };

    createAccountButton.addEventListener("click", onCreateAccountClick);

    const formCarouselElm = document.querySelector("#form-carousel");

    assert(
      formCarouselElm instanceof HTMLElement,
      "Form carousel undefined or not instance of HTMLElement"
    );

    const formCarousel: Carousel = new Carousel(formCarouselElm);

    const emailForm = document.querySelector("#email-form");

    assert(
      emailForm instanceof HTMLFormElement,
      "Token form undefined or not instance of HTMLFormElement"
    );

    const emailScheme = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
          "string.empty": "Email is required and cannot be empty.",
          "string.email": "Please provide a valid email address.",
          "any.required": "Email is required.",
        }),
    });

    const emailFormValidator = new FormValidator(emailScheme, emailForm);

    const emailField = emailForm.querySelector("#email");
    const emailFieldFeedback =
      emailField?.parentElement?.querySelector(".invalid-feedback");

    assert(
      emailField instanceof HTMLInputElement &&
        emailFieldFeedback instanceof HTMLElement,
      "Token field/feedback undefined or not HTMLInputElement/HTMLElement"
    );

    emailFormValidator.attachValidation();

    const onEmailFormSubmit = async (evt: SubmitEvent) => {
      evt.preventDefault();
      evt.stopPropagation();
      emailField.setCustomValidity("");
      const data = emailFormValidator.validateForm();

      if (!data) {
        return;
      }

      const { email } = data;

      await withBlock("#card", {
        opacity: 0.5,
        type: "bar",
        primary: false,
      })(async () => {
        const response = await fetch(`/is_email_verified/${email}`, {
          method: "GET",
        });

        if (!response.ok) {
          const message = ((await response.json()) as Response).message;
          emailField.setCustomValidity(message);
          emailFieldFeedback.textContent = message;
          return;
        }

        formCarousel.to(1);
        (hiddenEmail as HTMLInputElement).value = email;
        passwordToggler.updatePosition();
      })();

      emailForm.classList.add("was-validated");
      return false;
    };

    const passwordForm = document.querySelector("#password-form");

    assert(
      passwordForm instanceof HTMLFormElement,
      "Password form undefined or not HTMLFormElement"
    );

    const hiddenEmail = passwordForm.querySelector("#hidden-email");
    const passwordField = passwordForm.querySelector("#password");
    const passwordFieldFeedback =
      passwordField?.parentElement?.querySelector(".invalid-feedback");

    assert(
      hiddenEmail instanceof HTMLInputElement &&
        passwordField instanceof HTMLInputElement &&
        passwordFieldFeedback instanceof HTMLElement,
      "Hidden email/password/feedback undefined or not HTMLInputElement/HTMLElement"
    );

    const passwordToggler = new PasswordToggle(passwordField);

    const passwordFormValidator = new FormValidator(
      Joi.object({
        password: Joi.string().required().messages({
          "string.base": "Password must be a string.",
          "string.empty": "Password cannot be empty.",
          "any.required": "Password is required.",
        }),
        remember: Joi.optional(),
        "hidden-email": Joi.string()
          .email({ tlds: { allow: false } })
          .required()
          .messages({
            "string.empty": "Email is required and cannot be empty.",
            "string.email": "Please provide a valid email address.",
            "any.required": "Email is required.",
          }),
      }),
      passwordForm
    );

    passwordFormValidator.attachValidation();

    const onPasswordSubmit = async (evt: SubmitEvent) => {
      evt.preventDefault();
      evt.stopPropagation();
      passwordField.setCustomValidity("");
      const data = passwordFormValidator.validateForm();
      console.log(data);

      if (!data) {
        return;
      }

      const { ["hidden-email"]: email, password, remember } = data;

      await withBlock("#card", {
        opacity: 0.5,
        type: "bar",
        primary: false,
      })(async () => {
        try {
          const response = await login({
            email: email,
            password,
            remember,
          });
          navigate(getRouteFromPath(response.redirect), {
            replace: true,
          });
        } catch (error) {
          if (error instanceof FirebaseError) {
            switch (error.code) {
              case "auth/invalid-credential":
                passwordField.setCustomValidity(error.message);
                passwordFieldFeedback.textContent =
                  "The email address or password you entered is incorrect. Please double-check and try again.";
                return;
              default:
                break;
            }
            error = error.message;
          }
          showMessage(`Error: ${error}`, {
            type: MessageType.DANGER,
            mode: "toast",
          });
        }
      })();

      passwordForm.classList.add("was-validated");
      return false;
    };

    const forgotPassword = document.querySelector("#forgot-password");

    assert(
      forgotPassword instanceof HTMLElement,
      "Forgot password undefined or not HTMLElement"
    );

    const onForgotPassword = async () => {
      try {
        withBlock("#card", {
          opacity: 0.5,
          type: "bar",
          primary: false,
        })(async () => {
          await sendResetPassword(hiddenEmail.value);
          showMessage(
            "A reset password email has been sent. Please check your inbox.",
            {
              mode: "toast",
            }
          );
        })();
      } catch (e: any) {
        switch (e.code) {
          case "auth/invalid-email":
            showMessage("Invalid email address. Please try again.", {
              type: MessageType.DANGER,
              mode: "toast",
            });
            break;
          case "auth/user-not-found":
            showMessage("No user found with this email address.", {
              type: MessageType.DANGER,
              mode: "toast",
            });
            break;
          default:
            showMessage(`Error: ${e.message}`, {
              type: MessageType.DANGER,
              mode: "toast",
            });
        }
      }
    };

    const infoForm = document.querySelector("#info-form");

    interface UserInfo {
      fullname: string;
      username: string;
      phone: string;
    }

    let info: UserInfo | undefined;

    assert(
      infoForm instanceof HTMLFormElement,
      "Info form undefined or not HTMLFormElement"
    );

    const infoFormValidator = new FormValidator(
      Joi.object({
        fullname: Joi.string().required().messages({
          "string.empty": "Fullname is required.",
          "any.required": "Fullname cannot be empty.",
        }),
        username: Joi.string().required().messages({
          "string.empty": "Username is required.",
          "any.required": "Username cannot be empty.",
        }),
        phone: Joi.string()
          .pattern(/^\+[1-9]\d{1,14}$/)
          .required()
          .messages({
            "string.pattern.base":
              "Phone number must be in a valid international format (e.g., +1234567890).",
            "string.empty": "Phone number is required.",
            "any.required": "Phone number cannot be empty.",
          }),
      }),
      infoForm
    );

    infoFormValidator.attachValidation();

    const registerPassword = document.querySelector("#register-password");
    const confirmPassword = document.querySelector("#confirm-password");

    assert(
      registerPassword instanceof HTMLInputElement &&
        confirmPassword instanceof HTMLInputElement,
      "Register/confirm password undefined or not HTMLInputELement"
    );

    const registerPasswordToggler = new PasswordToggle(registerPassword);
    const confirmPasswordToggler = new PasswordToggle(confirmPassword);

    const onInfoFormSubmit = (evt: SubmitEvent) => {
      evt.preventDefault();

      const data = infoFormValidator.validateForm();

      if (!data) return;

      info = data;
      formCarousel.to(3);
      registerPasswordToggler.updatePosition();
      confirmPasswordToggler.updatePosition();
    };

    const registerForm = document.querySelector("#register-form");

    assert(
      registerForm instanceof HTMLFormElement,
      "Register form undefined or not HTMLFormElement"
    );

    const registerFormValidator = new FormValidator(
      Joi.object({
        password: Joi.string()
          .min(8)
          .max(32)
          .pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
          )
          .required()
          .messages({
            "string.empty": "Password is required.",
            "string.min": "Password must be at least 8 characters long.",
            "string.max": "Password cannot exceed 32 characters.",
            "string.pattern.base": "Password must match the requirements.",
            "any.required": "Password cannot be empty.",
          }),
        "confirm-password": Joi.string()
          .valid(Joi.ref("password"))
          .required()
          .messages({
            "any.only": "Confirm password must match the password.",
            "string.empty": "Confirm password is required.",
            "any.required": "Confirm password cannot be empty.",
          }),
        "register-email": Joi.string()
          .email({ tlds: { allow: false } })
          .required()
          .messages({
            "string.empty": "Email is required and cannot be empty.",
            "string.email": "Please provide a valid email address.",
            "any.required": "Email is required.",
          }),
      }),
      registerForm
    );

    registerFormValidator.attachValidation();

    const onRegisterFormSubmit = (evt: SubmitEvent) => {
      evt.preventDefault();

      const data = registerFormValidator.validateForm();

      if (!data) return;

      if (!info) {
        formCarousel.to(2);
        showMessage("Invalid user information. Please try again.", {
          mode: "toast",
          type: MessageType.DANGER,
        });
        return;
      }

      const { "register-email": email, password } = data;

      withBlock("#card", {
        opacity: 0.5,
        type: "bar",
        primary: false,
      })(async () => {
        try {
          await withBlock("#card", {
            opacity: 0.5,
            type: "bar",
            primary: false,
          })(async () => {
            await signup({
              email: email,
              password: password,
              ...info,
            } as SignupRequest);
          })();

          formCarousel.to(0);

          showMessage(
            "A verification email has been sent. Please check your inbox.",
            {
              mode: "toast",
              type: MessageType.SUCCESS,
            }
          );
        } catch (e: any) {
          showMessage(e.message, {
            mode: "toast",
            type: MessageType.DANGER,
          });
        }
      })();
    };

    interface CarouselSlideEvent extends CustomEvent {
      direction: "left" | "right";
      relatedTarget: HTMLElement;
      from: number;
      to: number;
    }

    const title = document.querySelector("#title");
    const subtitle = document.querySelector("#subtitle");

    assert(
      title instanceof HTMLElement && subtitle instanceof HTMLElement,
      "Title/subtitle undefined or not HTMLElement"
    );

    formCarouselElm.addEventListener("slide.mdb.carousel", (event: Event) => {
      withBlock("#card", {
        opacity: 0.5,
        type: "none",
        primary: false,
      })(async () => {
        const carouselEvent = event as CarouselSlideEvent;
        const titleContent = carouselEvent.relatedTarget.dataset.title;
        const subtitleContent = carouselEvent.relatedTarget.dataset.subtitle;
        titleContent && (title.innerHTML = titleContent);
        subtitleContent && (subtitle.innerHTML = subtitleContent);

        cleanForms(carouselEvent.relatedTarget);
        await simulateAsyncRequest(500);
      })();
    });

    function cleanForms(activeForm: HTMLElement): void {
      [
        emailFormValidator,
        passwordFormValidator,
        infoFormValidator,
        registerFormValidator,
      ].forEach((form) => {
        if (form.getElement() !== activeForm) {
          form
            .getElement()
            .querySelectorAll<HTMLInputElement>("input, select, textarea")
            .forEach((field) => {
              field.disabled = form.getElement() !== activeForm;
            });
        } else {
          form.resetForm();

          form
            .getElement()
            .querySelectorAll<HTMLInputElement>("input, select, textarea")
            .forEach((field) => {
              field.disabled = form.getElement() !== activeForm;
            });
        }
      });
    }

    googleSignin.addEventListener("click", onGoogleSigninClick);
    facebookSignin.addEventListener("click", onFacebookSigninClick);
    twitterSignin.addEventListener("click", onTwitterSigninClick);

    emailForm.addEventListener("submit", onEmailFormSubmit);
    passwordForm.addEventListener("submit", onPasswordSubmit);
    infoForm.addEventListener("submit", onInfoFormSubmit);
    registerForm.addEventListener("submit", onRegisterFormSubmit);
    forgotPassword.addEventListener("click", onForgotPassword);

    return new Promise((resolve) => {
      resolve(() => {
        createAccountButton.removeEventListener("click", onCreateAccountClick);
        emailForm.removeEventListener("submit", onEmailFormSubmit);
        passwordToggler.dispose();
        passwordForm.removeEventListener("submit", onPasswordSubmit);
        infoForm.removeEventListener("submit", onInfoFormSubmit);
        registerForm.removeEventListener("submit", onRegisterFormSubmit);
        googleSignin.removeEventListener("click", onGoogleSigninClick);
        facebookSignin.removeEventListener("click", onFacebookSigninClick);
        twitterSignin.removeEventListener("click", onTwitterSigninClick);
        forgotPassword.removeEventListener("click", onForgotPassword);
        registerPasswordToggler.dispose();
        confirmPasswordToggler.dispose();

        console.warn("Register disposed");
      });
    });
  })();
}
