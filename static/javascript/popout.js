document.addEventListener("DOMContentLoaded", function () {
    // Toggle profile pop-out box
    function toggleProfilePopout() {
      const popout = document.getElementById("profilePopout");
      if (popout) {
        popout.style.display =
          popout.style.display === "block" ? "none" : "block";
      } else {
        console.error("Element #profilePopout not found!");
      }
    }
  
    // Redirect to login.html
    function redirectToSignOut() {
      console.log("Redirecting to login.html");
      window.location.href = "./login.html"; // Update path if necessary
    }
  
    // Close pop-out box when clicking outside
    window.addEventListener("click", function (e) {
      const popout = document.getElementById("profilePopout");
      const profileIcon = document.querySelector(".profile-icon");
      if (popout && popout.style.display === "block") {
        if (!profileIcon.contains(e.target) && !popout.contains(e.target)) {
          popout.style.display = "none";
          console.log("Profile pop-out closed");
        }
      }
    });
  
    // Expose functions to global scope if needed
    window.toggleProfilePopout = toggleProfilePopout;
    window.redirectToSignOut = redirectToSignOut;
  });
  