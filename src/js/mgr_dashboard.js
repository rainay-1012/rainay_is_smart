import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "boxicons/css/boxicons.min.css";
import "../assets/logo only.svg";
import "../style/mgr_dashboard.scss";
import { fetchMainContent } from "./content_switcher.js";

document.addEventListener("DOMContentLoaded", async function (event) {
  history.replaceState(
    { link: "mgr_dashboard.html" },
    "",
    "mgr_dashboard.html"
  );
  const mainContainer = document.querySelector("#main-container");
  const navLinks = document.querySelectorAll(".nav_link");

  await fetchMainContent(
    navLinks.item(0).attributes.getNamedItem("href").textContent,
    mainContainer
  );

  navLinks.forEach((elm) => {
    elm.addEventListener("click", async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const href = elm.attributes.getNamedItem("href");
      await fetchMainContent(href.textContent, mainContainer);
      return false;
    });
  });

  window.onpopstate = async function (event) {
    if (event.state.link == "mgr_dashboard.html") {
      window.location.replace(mgr_dashboard.html);
    }
    if (event.state && event.state.link) {
      await fetchMainContent(event.state.link, mainContainer, false);
    }
  };

  const showNavbar = (toggleId, navId, bodyId, headerId) => {
    const toggle = document.getElementById(toggleId),
      nav = document.getElementById(navId),
      bodypd = document.getElementById(bodyId),
      headerpd = document.getElementById(headerId);

    // Validate that all variables exist
    if (toggle && nav && bodypd && headerpd) {
      toggle.addEventListener("click", () => {
        // show navbar
        nav.classList.toggle("show-sidebar");
        // change icon
        toggle.classList.toggle("bx-x");
        // add padding to body
        bodypd.classList.toggle("body-pd");
        // add padding to header
        headerpd.classList.toggle("body-pd");
      });
    }
  };

  showNavbar("header-toggle", "nav-bar", "body-pd", "header");

  /*===== LINK ACTIVE =====*/
  const linkColor = document.querySelectorAll(".nav_link");

  function colorLink() {
    if (linkColor) {
      linkColor.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");
    }
  }
  linkColor.forEach((l) => l.addEventListener("click", colorLink));

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
