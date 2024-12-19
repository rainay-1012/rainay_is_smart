import { FirebaseError } from "@firebase/app";
import { AlertType, assert, showAlert, withBlock } from ".";
import { changePassword, getCurrentUserToken } from "./auth";

export async function fetchUserInfo() {
  try {
    const response = await fetch("/get_user_info", {
      headers: {
        Authorization: `Bearer ${await getCurrentUserToken()}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.trace(error);
  }
}

export async function initProfile() {
  document.querySelector("#content-title")!.innerHTML = "Profile";
  const idElement = document.querySelector("#id");
  const nameElement = document.querySelector("#name");
  const usernameElement = document.querySelector("#username");
  const phoneNoElement = document.querySelector("#phoneNo");
  const emailElement = document.querySelector("#email");
  const photoElement = document.querySelector("#photo");
  const dateElement = document.querySelector("#date");
  const positionElement = document.querySelector("#position");
  const companyElement = document.querySelector("#company");

  async function updateUserInfo() {
    const data = await fetchUserInfo();

    assert(
      idElement instanceof HTMLElement &&
        nameElement instanceof HTMLInputElement &&
        usernameElement instanceof HTMLInputElement &&
        phoneNoElement instanceof HTMLInputElement &&
        emailElement instanceof HTMLElement &&
        photoElement instanceof HTMLImageElement &&
        dateElement instanceof HTMLElement &&
        positionElement instanceof HTMLElement &&
        companyElement instanceof HTMLElement,
      "One or more elements are missing or of incorrect type"
    );

    if (data.user) {
      idElement.textContent = data.user.id;
      if (nameElement) nameElement.value = data.user.name;
      if (usernameElement) usernameElement.value = data.user.username;
      if (phoneNoElement) phoneNoElement.value = data.user.phoneNo;
      if (emailElement) emailElement.textContent = data.user.email;

      const rawDate = data.user.date;
      const formattedDate = new Date(rawDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (photoElement)
        photoElement.src = data.user.photo ?? "https://placehold.co/300x300";
      if (dateElement) dateElement.textContent = formattedDate;
      if (positionElement) positionElement.textContent = data.user.position;
      if (companyElement) companyElement.textContent = data.user.company;
    } else {
      alert("No user information found.");
    }
  }

  await updateUserInfo();

  const profileForm = document.getElementById("profile-form");

  assert(
    profileForm instanceof HTMLFormElement,
    "Profile form undefined or not HTMLFormElement"
  );

  async function handleFormSubmit(event: SubmitEvent) {
    event.preventDefault();

    const formData = new FormData(profileForm as HTMLFormElement);

    try {
      const response = await fetch("/update_user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getCurrentUserToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      alert("User information updated successfully!");
      console.log(data);
    } catch (error) {
      console.error("Error updating user information:", error);
      alert("Failed to update user information. Please try again later.");
    }
  }

  const onImageChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/update_user", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await getCurrentUserToken()}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          alert("Profile picture is updated successfully!");
          (photoElement as HTMLImageElement).src =
            data.photo ?? "https://placehold.co/300x300";
        } else {
          alert("Failed to update profile picture");
        }
      } catch (error) {
        console.error("Error uploading profile picture:", error);
      }
    }
  };

  const imageInput = document.querySelector("#image");

  assert(
    imageInput instanceof HTMLInputElement,
    "Image input undefined or not HTMLInputElement"
  );

  imageInput.addEventListener("change", onImageChange);

  const privacyForm = document.querySelector("#privacy-form");

  assert(
    privacyForm instanceof HTMLFormElement,
    "Privacy form undefined or not HTMLFormElement"
  );

  privacyForm.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();

    assert(event.submitter, "Event submitter undefined");

    await withBlock(event.submitter, {
      small: true,
      opacity: 0,
      primary: false,
    })(async () => {
      try {
        const data = new FormData(privacyForm);
        const oldPassword = data.get("old-password")?.toString();
        const newPassword = data.get("new-password")?.toString();
        const confirmPassword = data.get("confirm-password")?.toString();

        assert(
          oldPassword && newPassword && confirmPassword,
          "Missing value of oldpassword/newpassword/confirmpassword"
        );

        if (newPassword !== confirmPassword) {
          showAlert("Passwords do not match!", {
            type: AlertType.DANGER,
            element: "#content-container",
          });
          return;
        }

        await changePassword({
          oldPassword: oldPassword,
          newPassword: newPassword,
        });

        showAlert("Password successfully updated.", {
          element: "#content-container",
          type: AlertType.SUCCESS,
        });
      } catch (error) {
        if (error instanceof FirebaseError) {
          showAlert("Invalid credential. Please try again.", {
            type: AlertType.DANGER,
            element: "#content-container",
          });
          console.trace(error);
        } else {
          showAlert("Unexpected error occured. Please try again.", {
            type: AlertType.DANGER,
            element: "#content-container",
          });
        }
      } finally {
        privacyForm.reset();
      }
    })();

    return false;
  });

  profileForm.addEventListener("submit", handleFormSubmit);

  return new Promise((resolve) => {
    profileForm.removeEventListener("submit", handleFormSubmit);
  });
}
