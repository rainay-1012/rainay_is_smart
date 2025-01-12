import { User } from "@firebase/auth";
import Joi from "joi";
import { Modal } from "mdb-ui-kit";
import { getCurrentRoute, getRouteFromPath, navigate, routes } from ".";
import "../style/dashboard.scss";
import { authStateChangedListener, logout } from "./auth";
import { SocketDataManager } from "./socket";
import { getUserPhotoURL } from "./users";
import {
  assert,
  FormValidator,
  mapToElement,
  MessageType,
  showMessage,
  withBlock,
} from "./utils";

async function initProfile(user: User) {
  const setProfile = async () => {
    const claims = (await user.getIdTokenResult(true)).claims;
    const headerUsername = document.querySelector("#header-username");
    const headerAvatar = document.querySelector("#header-avatar");

    assert(
      headerUsername instanceof HTMLElement &&
        headerAvatar instanceof HTMLImageElement,
      "One of the header user field is not defined"
    );

    const data = {
      id: user!.uid,
      email: user!.email ?? "N/A",
      role: claims.role! as string,
      phoneNo: user!.phoneNumber || "",
      fullname: (claims.fullname || "") as string,
      username: user!.displayName || "Unknown",
      photo: user!.photoURL
        ? user.photoURL +
          `?access_token=${localStorage.getItem("profileUrlToken")}`
        : null,
    };

    headerUsername.textContent = user.displayName;

    const userPhotoURL = await getUserPhotoURL({
      uid: data.id,
      photoURL: data.photo,
    });

    headerAvatar.src = userPhotoURL;

    headerAvatar.onerror = function (e) {
      console.error(e);
      headerAvatar.src = userPhotoURL;
    };

    mapToElement([
      { selector: "#profile-id", value: data.id },
      { selector: "#profile-uid", value: data.id },
      {
        selector: "#profile-fullname",
        value: data.fullname,
      },
      {
        selector: "#profile-username",
        value: data.username,
      },
      {
        selector: "#profile-phoneNo",
        value: data.phoneNo,
      },
      {
        selector: "#profile-email",
        value: data.email,
      },
      {
        selector: "#profile-role",
        value: data.role,
      },
      {
        selector: "#profile-photo",
        attribute: { src: userPhotoURL },
      },
      {
        selector: "#profile-uid",
        value: data.id,
      },
    ]);
  };

  await setProfile();

  const imageInput = document.getElementById("image") as HTMLInputElement;
  const profilePhoto = document.getElementById(
    "profile-photo"
  ) as HTMLImageElement;

  imageInput.addEventListener("change", (event) => {
    const file = imageInput.files?.[0];

    if (file) {
      const imageUrl = URL.createObjectURL(file);
      profilePhoto.src = imageUrl;
    } else {
      profilePhoto.src =
        "https://t4.ftcdn.net/jpg/02/15/84/43/360_F_215844325_ttX9YiIIyeaR7Ne6EaLLjMAmy4GvPC69.jpg";
    }
  });

  const profileForm = document.querySelector("#profile-form");

  assert(
    profileForm instanceof HTMLFormElement,
    "Profile form undefined or invalid type"
  );

  const profileFormModal = new Modal(profileForm);

  const profileFormValidator = new FormValidator(
    Joi.object({
      uid: Joi.string().required(),
      image: Joi.any().optional(),
      name: Joi.string().allow("").optional().messages({
        "string.empty": "Fullname is required.",
        "any.required": "Fullname cannot be empty.",
      }),
      username: Joi.string().required().messages({
        "string.empty": "Username is required.",
        "any.required": "Username cannot be empty.",
      }),
      phoneNo: Joi.string()
        .allow("")
        .pattern(/^\+[1-9]\d{1,14}$/)
        .optional()
        .messages({
          "string.pattern.base":
            "Phone number must be in a valid international format (e.g., +1234567890).",
          "string.empty": "Phone number is required.",
          "any.required": "Phone number cannot be empty.",
        }),
    }),
    profileForm
  );

  profileFormValidator.attachValidation();

  const onProfileFormHide = async () => {
    profileFormValidator.resetForm();
    await setProfile();
  };

  profileForm.addEventListener("hide.mdb.modal", onProfileFormHide);

  const onProfileFormSubmit = async (evt: SubmitEvent) => {
    evt.preventDefault();

    const data = profileFormValidator.validateForm();
    if (!data) return;

    const formData = new FormData();

    for (const key in data) {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    }

    await withBlock("#profile-form .modal-content", {
      opacity: 0.5,
      type: "border",
      primary: true,
    })(async () => {
      try {
        const response = await fetch("/update_user", {
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
          },
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw await response.json();
        }

        sessionStorage.removeItem(`photoData-${user.uid}`);

        await user.reload();
        showMessage("Your profile information has been updated.", {
          mode: "toast",
          type: MessageType.SUCCESS,
        });
      } catch (e: any) {
        showMessage(e.message, {
          mode: "toast",
          type: MessageType.DANGER,
        });
      } finally {
        profileFormModal.hide();
      }
    })();
  };

  profileForm.addEventListener("submit", onProfileFormSubmit);

  return new Promise((resolve) => {
    resolve(() => {
      profileForm.removeEventListener("hide.mdb.modal", onProfileFormHide);
      profileFormValidator.dispose();
      profileForm.removeEventListener("submit", onProfileFormSubmit);
    });
  });
}

export async function initDashboard() {
  authStateChangedListener(async (user) => {
    if (!user) {
      console.log("User is not authenticated");
      alert(
        "User is not authenticated or has been modified. Please login again."
      );
      window.location.replace("/");
      return;
    }

    const userManualButton = document.getElementById("user-manual");

    if (userManualButton) {
      userManualButton.addEventListener("click", async () => {
        await navigate(routes.user_manual, {});
      });
    }

    const claims = (await user.getIdTokenResult()).claims;
    const role = claims.role;

    const profileDisposer = await initProfile(user);

    const signoutBtn = document.querySelector("#signout-btn");

    const sidebarToggler = document.querySelector("#sidebar-toggler");
    const sidebar = document.querySelector("#sidebar");
    const header = document.querySelector("#header");
    const contentContainer = document.querySelector("#content-container");

    assert(signoutBtn, "signoutBtn is not found in the DOM");
    assert(sidebarToggler, "sidebarToggler is not found in the DOM");
    assert(sidebar, "sidebar is not found in the DOM");
    assert(header, "header is not found in the DOM");
    assert(contentContainer, "contentContainer is not found in the DOM");

    const onSignoutClick = async () => {
      await logout();
    };

    signoutBtn.addEventListener("click", onSignoutClick);

    let isOpen = false;

    function toggleChat() {
      isOpen = !isOpen;
      sidebar!.classList.toggle("open");
      header!.classList.toggle("open");
      sidebarToggler!.classList.toggle("bx-menu");
      sidebarToggler!.classList.toggle("bx-chevrons-left");
      contentContainer!.classList.toggle("shrink");
    }

    sidebarToggler.addEventListener("click", toggleChat);
    const mediaQuery = window.matchMedia("(min-width: 992px)");

    function handleMediaQueryChange(
      this: MediaQueryList,
      evt: MediaQueryListEvent
    ): void {
      if (evt.matches && !isOpen) {
        sidebar!.classList.add("open");
        header!.classList.add("open");
        sidebarToggler!.classList.remove("bx-menu");
        sidebarToggler!.classList.add("bx-chevrons-left");
        contentContainer!.classList.add("shrink");
      } else {
        sidebar!.classList.remove("open");
        header!.classList.remove("open");
        sidebarToggler!.classList.add("bx-menu");
        sidebarToggler!.classList.remove("bx-chevrons-left");
        contentContainer!.classList.remove("shrink");
      }
    }

    mediaQuery.addEventListener("change", handleMediaQueryChange);
    handleMediaQueryChange.call(mediaQuery, {
      matches: mediaQuery.matches,
      media: mediaQuery.media,
    } as MediaQueryListEvent);

    const barLinks = document.querySelectorAll(".bar-link");
    const contentTitle = document.querySelector("#content-title");

    assert(
      contentTitle instanceof HTMLElement,
      "Content title undefined or not HTMLElement"
    );

    const navigateLink = async (evt: Event) => {
      evt.preventDefault();

      barLinks.forEach((link) => {
        link.classList.remove("active");
      });

      const target = evt.currentTarget as HTMLAnchorElement;

      target.classList.add("active");

      await navigate(getRouteFromPath(target.pathname), {});

      target.dataset.contentTitle &&
        (contentTitle.innerHTML = target.dataset.contentTitle);
    };

    barLinks.forEach((link) => {
      link.addEventListener("click", navigateLink);
    });

    enum Role {
      Executive = 1,
      Manager = 2,
      Admin = 3,
    }

    const getRoleValue = (roleString: string): Role => {
      switch (roleString.toLowerCase()) {
        case "admin":
          return Role.Admin;
        case "manager":
          return Role.Manager;
        case "executive":
          return Role.Executive;
        default:
          throw new Error("Unknown role");
      }
    };

    const userRoleValue = getRoleValue(role as string);

    const mutationCallback = (mutationsList: MutationRecord[]) => {
      mutationsList.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          const elements = document.querySelectorAll("[data-role]");
          elements.forEach((element) => {
            const elementRoleString = element.getAttribute("data-role");
            if (elementRoleString) {
              try {
                const elementRoleValue = getRoleValue(elementRoleString);
                if (elementRoleValue > userRoleValue) {
                  element.remove();
                }
              } catch (e) {
                console.error(`Invalid role attribute: ${elementRoleString}`);
              }
            }
          });

          // Adjust chat initialization based on user role
          if (userRoleValue >= Role.Manager) {
          }
        }
      });
    };

    const observerConfig = {
      childList: true,
      attributes: true,
      subtree: true,
    };

    const observer = new MutationObserver(mutationCallback);
    observer.observe(document.body, observerConfig);

    if (getCurrentRoute() === routes.dashboard) {
      await navigate(routes.report, {
        replace: true,
      });
    }

    barLinks.forEach((link) => {
      const path = link as HTMLAnchorElement;

      if (getCurrentRoute().path === path.pathname) {
        path.dataset.contentTitle &&
          (contentTitle.innerHTML = path.dataset.contentTitle);
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    return new Promise<() => void>((resolve) => {
      resolve(async () => {
        sidebarToggler?.removeEventListener("click", toggleChat);
        mediaQuery.removeEventListener("change", handleMediaQueryChange);
        signoutBtn.removeEventListener("click", onSignoutClick);
        SocketDataManager.getInstance()?.disconnect();
        observer.disconnect();
        console.log("Dashboard disposed");
        await (profileDisposer as () => Promise<void>)();
      });
    });
  });

  return null;
}
