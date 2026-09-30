// assets/js/ui/projectMenu.js
//
// The "Project" menu in the top bar: start a new project, save all pages as a
// .kvapka.json file, or open one. The file format is in state/projectFile.js;
// this is only the menu and the file handling.
//
// New and Open replace every page, so with unsaved work they ask about
// saving first.
//
// Everything stays on the device and works in a locked-down browser: saving
// is a plain download link (no File System Access API, which policies often
// disable) and opening reads a picked file in memory. No request is made.

import {
  buildProjectJson,
  projectFileName,
  openProjectText,
  markSaved,
  forgetSaved,
  hasUnsavedChanges,
  MAX_PROJECT_BYTES
} from "../state/projectFile.js";
import { getTabs, resetTabs } from "../state/tabs.js";
import { replaceElementStyles } from "../elements/elementStyles.js";
import { downloadJson } from "../theme/themeStore.js";
import { renderTabBar } from "./tabs.js";
import { addWarning } from "./warnings.js";
import { confirmDialog, choiceDialog } from "./dialog.js";
import { t } from "../i18n/i18n.js";

// Only the file's name is shown back, cut to this length.
const MAX_SHOWN_NAME = 80;

let button;
let menu;
let newItem;
let saveItem;
let openItem;
let fileInput;
let refreshUI;

export function initProjectMenu(options) {
  refreshUI = options.refreshUI;
  button = document.getElementById("project-menu-btn");
  menu = document.getElementById("project-menu");
  newItem = document.getElementById("project-new");
  saveItem = document.getElementById("project-save");
  openItem = document.getElementById("project-open");
  fileInput = document.getElementById("project-file");
  if (!button || !menu || !newItem || !saveItem || !openItem || !fileInput) return;

  button.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.classList.contains("open")) close();
    else open();
  });

  newItem.addEventListener("click", () => {
    close(true);
    newProject();
  });

  saveItem.addEventListener("click", () => {
    close(true);
    saveProject();
  });

  openItem.addEventListener("click", async () => {
    close(true);
    if (!(await readyToReplace("open"))) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", handleFile);

  menu.addEventListener("keydown", onMenuKeydown);
  document.addEventListener("click", e => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !button.contains(e.target)) close();
  });
}

/** Downloads every page as a .kvapka.json file (the menu's Save, and Ctrl+S). */
export function saveProject() {
  downloadJson(projectFileName(), buildProjectJson());
  markSaved();
}

/**
 * Before New or Open replaces every page: asks to save unsaved work first
 * (Save / Don't save / Cancel). New with nothing to lose still confirms,
 * since the pages go either way. Resolves whether to go ahead.
 */
async function readyToReplace(kind) {
  if (!hasUnsavedChanges()) {
    if (kind === "open") return true;       // the picker itself can still be cancelled
    return confirmDialog({
      title: t("project.newBlankTitle"),
      message: t("project.newBlankMessage"),
      confirmLabel: t("project.new")
    });
  }

  const pages = getTabs().length;
  const answer = await choiceDialog({
    title: t(kind === "new" ? "project.newTitle" : "project.openTitle"),
    message: t(pages === 1 ? "project.replaceMessageOne" : "project.replaceMessage", { n: pages }),
    choices: [
      { label: t("project.discard"), value: "discard", danger: true },
      { label: t(kind === "new" ? "project.saveAndNew" : "project.saveAndOpen"), value: "save", primary: true }
    ]
  });
  if (answer === "save") saveProject();
  return answer !== null;
}

/** Replaces every page with one fresh page (the menu's New project). */
async function newProject() {
  if (!(await readyToReplace("new"))) return;
  resetTabs();
  // Element styles belong to the project, so they reset too.
  replaceElementStyles(null);
  // The blank project becomes the saved baseline.
  forgetSaved();
  // The rest of the app follows as on a page switch. The render autosaves
  // the blank project over the old session.
  renderTabBar();
  refreshUI();
  addWarning(t("project.started"), "info");
  button.focus();
}

const enabledItems = () => [newItem, saveItem, openItem].filter(item => !item.disabled);

function open() {
  // No page swap while the template editor is open: its draft belongs to
  // the live page.
  const editorOpen = document.body.classList.contains("theme-editor-open");
  for (const item of [newItem, openItem]) {
    item.disabled = editorOpen;
    item.title = editorOpen ? t("project.replaceDisabled") : "";
  }

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
  // Tabbing away closes the menu like a click elsewhere. Done on the key, not
  // focusout: Safari doesn't focus a clicked button, so focusout would hide
  // the menu before the click on an item landed.
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

  // Checked before reading, so an oversized file is never loaded.
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

  // The rest of the app follows as on a page switch. The render autosaves.
  renderTabBar();
  refreshUI();
  addWarning(t("project.opened", { name: file.name.slice(0, MAX_SHOWN_NAME) }), "info");
}
