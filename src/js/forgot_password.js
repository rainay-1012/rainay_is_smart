document.addEventListener("DOMContentLoaded", () => {
    const forgotPasswordForm = document.querySelector("#forgot-password-form");
  
    forgotPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailInput = document.querySelector("#forgot-email");
      const email = emailInput.value;
  
      if (!email) {
        alert("Please enter a valid email address.");
        return;
      }
  
      try {
        const response = await fetch("/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          alert(result.message);
        } else {
          alert(result.message || "Something went wrong. Please try again.");
        }
      } catch (error) {
        console.error("Error:", error);
        alert("Failed to send request. Please try again.");
      }
    });
  });
  