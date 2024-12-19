import { currentRoute, getRouteFromPath, navigate } from ".";

export async function initSidebar(parentRoute, defaultRoute) {
  const sidebarToggler = document.querySelector("#sidebar-toggler");
  const sidebar = document.querySelector("#sidebar");
  const header = document.querySelector("#header");
  const contentContainer = document.querySelector("#content-container");
  let isOpen = false;

  function toggleChat() {
    isOpen = !isOpen;
    sidebar.classList.toggle("open");
    header.classList.toggle("open");
    sidebarToggler.classList.toggle("bx-menu");
    sidebarToggler.classList.toggle("bx-chevrons-left");
    contentContainer.classList.toggle("shrink");
  }

  sidebarToggler.addEventListener("click", toggleChat);
  const mediaQuery = window.matchMedia("(min-width: 1000px)");
  // const mediaQuery = window.matchMedia("(min-width: 768px)");

  function handleMediaQueryChange(e) {
    if (e.matches && !isOpen) {
      sidebar.classList.add("open");
      header.classList.add("open");
      sidebarToggler.classList.remove("bx-menu");
      sidebarToggler.classList.add("bx-chevrons-left");
      contentContainer.classList.add("shrink");
    } else {
      sidebar.classList.remove("open");
      header.classList.remove("open");
      sidebarToggler.classList.add("bx-menu");
      sidebarToggler.classList.remove("bx-chevrons-left");
      contentContainer.classList.remove("shrink");
    }
  }

  mediaQuery.addEventListener("change", handleMediaQueryChange);
  handleMediaQueryChange(mediaQuery);

  const barLinks = document.querySelectorAll(".bar-link");

  const navigateLink = async (evt) => {
    evt.preventDefault();

    barLinks.forEach((link) => {
      link.classList.remove("active");
    });
    evt.currentTarget.classList.add("active");

    await navigate(getRouteFromPath(evt.currentTarget.pathname), {
      blockParams: {
        zIndex: 10,
      },
    });
  };

  barLinks.forEach((link) => {
    link.addEventListener("click", navigateLink);
  });

  if (currentRoute === parentRoute) {
    await navigate(defaultRoute, {
      replace: true,
      blockParams: { zIndex: 10 },
    });
  }

  barLinks.forEach((link) => {
    if (currentRoute.path === link.pathname) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  return new Promise((resolve) => {
    resolve(() => {
      sidebarToggler?.removeEventListener("click", toggleChat);
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    });
  });
}
