import "marked";
import { marked } from "marked";
import { currentRoute, getRouteFromPath, navigate, routes } from ".";
import "../style/mgr_dashboard.scss";
import { getCurrentUserToken } from "./authentication";

export async function initManager() {
  // document
  //   .querySelector("#signoutBtn")
  //   .addEventListener("click", async (evt) => {
  //     await logout();
  //   });

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

  const mediaQuery = window.matchMedia("(min-width: 768px)");

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

  const chatInput = document.querySelector("#chat-input");
  chatInput.style.height = `${chatInput.scrollHeight}px`;

  const chatOnInput = (event) => {
    const target = event.target;
    target.style.height = "auto";

    if (target.scrollHeight > parseInt(getComputedStyle(target).maxHeight)) {
      target.style.overflowY = "scroll";
      target.style.height = `${parseInt(getComputedStyle(target).maxHeight)}px`;
      target.scrollTop = target.scrollHeight;
    } else {
      target.style.overflowY = "hidden";
      target.style.height = `${target.scrollHeight}px`;
    }
  };

  chatInput.addEventListener("input", chatOnInput);

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

  const chatInputContainer = document.querySelector("#chat-input-container");
  const chatContent = document.querySelector("#chat-content");
  const defaultChatContent = document.querySelector("#chat-content-template");
  const userMessageTemplate = document.querySelector("#user-message-template");
  const userReplyTemplate = document.querySelector("#user-reply-template");

  let reset = false;

  function insertDefaultContent() {
    reset = false;
    chatContent.innerHTML = "";
    chatContent.appendChild(defaultChatContent.content.cloneNode(true));
  }

  insertDefaultContent();

  async function onChatInput(evt) {
    evt.preventDefault();
    if (!reset) {
      chatContent.innerHTML = "";
      reset = true;
    }
    const data = new FormData(chatInputContainer);
    chatInputContainer.reset();
    const userMessage = userMessageTemplate.content.cloneNode(true);
    userMessage.querySelector(".user-message").innerHTML =
      data.get("chat-input");
    chatContent.appendChild(userMessage);

    const response = await fetch("/consult", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getCurrentUserToken()}`,
      },
      body: data,
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const userReply = userReplyTemplate.content.cloneNode(true);
    const userReplyContent = userReply.querySelector(".user-reply");
    userReplyContent.innerHTML = "";
    let reply = "";
    chatContent.appendChild(userReplyContent);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      reply += chunk;
      userReplyContent.innerHTML = marked(reply);
    }
  }

  chatInputContainer.addEventListener("submit", onChatInput);

  barLinks.forEach((link) => {
    link.addEventListener("click", navigateLink);
  });

  if (currentRoute === routes.manager) {
    await navigate(routes.vendor, {
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
      sidebarToggler.removeEventListener("click", toggleChat);
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
      chatInput.removeEventListener("input", chatInput);
      chatInputContainer.removeEventListener("submit", onChatInput);
      console.log("Manager dashboard disposed");
    });
  });
}
