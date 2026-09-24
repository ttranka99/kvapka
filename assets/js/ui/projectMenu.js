// assets/js/ui/projectMenu.js
//
// The "Project" menu in the top bar: save the whole page list as a
// .kvapka.json file, or open one. What goes into the file and what is
// accepted back is state/projectFile.js; this is only the menu and the file
// handling around it.
//
// Both halves stay on the device and work under a locked-down browser: saving
// is a plain download link (no File System Access API, which policies often
// disable), opening is a file picker read in memory. No request is made.

import { buildProjectJson, projectFileName, openProjectText, MAX_PROJECT_BYTES } from "../state/projectFile.js";
import { downloadJson } from "../theme/themeStore.js";
import { renderTabBar } from "./tabs.js";
import { addWarning } from "./warnings.js";
import { t } from "../i18n/i18n.js";

// Only the file's name is ever shown back, and only this much of it.
const MAX_SHOWN_NAME = 80;

let button;
let menu;
let saveItem;
let openItem;
let fileInput;
let refreshUI;

export function initProjectMenu(options) {
  refreshUI = options.refreshUI;
  button = document.getElementById("project-menu-btn");
  menu = document.getElementById("project-menu");
  saveItem = document.getElementById("project-save");
  openItem = document.getElementById("project-open");
  fileInput = document.getElementById("project-file");
  if (!button || !menu || !saveItem || !openItem || !fileInput) return;

  button.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.classList.contains("open")) close();
    else open();
  });

  saveItem.addEventListener("click", () => {
    close(true);
    downloadJson(projectFileName(), buildProjectJson());
  });

  openItem.addEventListener("click", () => {
    close(true);
    fileInput.click();
  });

  fileInput.addEventListener("change", handleFile);

  menu.addEventListener("keydown", onMenuKeydown);
  document.addEventListener("click", e => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !button.contains(e.target)) close();
  });
}

const enabledItems = () => [saveItem, openItem].filter(item => !item.disabled);

function open() {
  // A page can't be swapped out from under the template editor: its draft
  // belongs to the page that is live now.
  const editorOpen = document.body.classList.contains("theme-editor-open");
  openItem.disabled = editorOpen;
  openItem.title = editorOpen ? t("project.openDisabled") : "";

  menu.classList.add("open");
  button.classList.add("menu-open");
  button.setAttribute("aria-expanded", "true");
  enabledItems()[0]?.focus();
}

function close(returnFocus = false) {
  if (!menu.classList.contains("open")) return;
  menu.classList.remove("open");
  button.classList.remove("menu-open");
  button.setAttribute("aria-expanded", "false");
  if (returnFocus) button.focus();
}

function onMenuKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    close(true);
    return;
  }
  // Tabbing away closes the menu like a click elsewhere does. Done on the key
  // rather than on focusout: Safari doesn't focus a clicked button, so a
  // focusout close would hide the menu before the click on an item landed.
  if (e.key === "Tab") {
    close();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
  e.preventDefault();
  const items = enabledItems();
  const index = items.indexOf(document.activeElement);
  let next;
  if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  else next = (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

async function handleFile() {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = "";              // so picking the same file again still fires
  if (!file) return;

  // Checked before reading, so an oversized file is never loaded at all.
  if (file.size > MAX_PROJECT_BYTES) {
    addWarning(t("project.tooLarge"), "error");
    return;
  }

  let text;
  try {
    text = await file.text();
  } catch {
    addWarning(t("project.readFailed"), "error");
    return;
  }

  const result = openProjectText(text);
  if (!result.ok) {
    addWarning(result.error, "error");
    return;
  }

  // The new pages are in place; the rest of the app follows as it does on a
  // page switch, and the render autosaves them.
  renderTabBar();
  refreshUI();
  addWarning(t("project.opened", { name: file.name.slice(0, MAX_SHOWN_NAME) }), "info");
}
