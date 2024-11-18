document.addEventListener("DOMContentLoaded", async function (event) {
  AOS.init();

  const mainContainer = document.querySelector("#main-container");
  const navLinks = document.querySelectorAll(".nav_link");

  await fetchMainContent(
    navLinks.item(0).attributes.getNamedItem("href").textContent
  );

  navLinks.forEach((elm) => {
    elm.addEventListener("click", async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const href = elm.attributes.getNamedItem("href");
      await fetchMainContent(href.textContent);
      return false;
    });
  });

  async function fetchMainContent(link) {
    const response = await fetch(link);
    if (response.ok) {
      const content = await response.text();
      mainContainer.innerHTML = content;
      $(mainContainer).hide().fadeIn("slow");

      const stylesheets = mainContainer.querySelectorAll(
        "link[rel='stylesheet']"
      );
      stylesheets.forEach((link) => {
        document.head.appendChild(link.cloneNode(true));
        link.remove();
      });

      const scripts = mainContainer.querySelectorAll("script");
      scripts.forEach((script) => {
        if (script.innerText) {
          eval(script.innerText);
        } else {
          fetch(script.src).then(function (data) {
            data.text().then(function (r) {
              eval(r);
            });
          });
        }
        script.parentNode.removeChild(script);
      });
    }
  }

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
