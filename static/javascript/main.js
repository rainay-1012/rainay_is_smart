document.addEventListener("DOMContentLoaded", function (event) {
  document.querySelectorAll(".nav_link").forEach((elm) => {
    elm.addEventListener("click", (evt) => {
      console.log(elm.attributes.getNamedItem("href"));
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    });
  });

  const chatContainer = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  document
    .querySelectorAll("#chatClose, #chatOpen, #overlay")
    .forEach((elm) => {
      elm.addEventListener("click", () => {
        toggleSidebar();
      });
    });

  function toggleSidebar() {
    chatContainer.classList.toggle("open");

    if (overlay) {
      overlay.classList.toggle("open");
    }
  }
});
