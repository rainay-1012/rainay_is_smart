import $ from "jquery";

export function resolvePath(relativePath) {
  const currentPath = window.location.pathname;
  const baseDir = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
  return new URL(relativePath, window.location.origin + baseDir).pathname;
}

export async function fetchMainContent(link, mainContainer, push = true) {
  console.log(link);
  link = resolvePath(link);
  const response = await fetch(link);
  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  const content = await response.text();

  mainContainer.innerHTML = content;
  $(mainContainer).hide().fadeIn("slow");

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content; // Temporarily hold the content to extract scripts
  const scripts = tempDiv.querySelectorAll("script");

  scripts.forEach((script) => {
    const newScript = document.createElement("script");
    newScript.textContent = script.textContent; // Inline scripts
    if (script.src) newScript.src = script.src; // External scripts
    document.body.appendChild(newScript);
  });

  // if (push) {
  //   history.replaceState({ link: link }, "", link);
  // }
}
