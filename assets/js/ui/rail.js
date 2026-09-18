// assets/js/ui/rail.js
//
// The left rail: three sections, exactly one lit at a time.
//
//   sablona — the template panel + canvas (the app as it always was)
//   layout  — the theme editor, shown as a section rather than a dialog
//   prvky   — a placeholder for custom elements
//
// The rail only switches what is on screen; it owns no layout state. The
// editor's own exits (Uložit, Zrušit, Escape, delete, import) report back
// through its onClose hook (see themePicker.js), which is what keeps the rail
// truthful when the editor closes itself.

import { closeThemeEditor } from "../theme/themeEditor.js";
import { renderLayout } from "./renderLayout.js";

let buttons;
let openEditor;

export function initRail(options) {
  openEditor = options.openEditor;
  buttons = document.querySelectorAll(".rail-btn[data-section]");
  buttons.forEach(button => {
    button.addEventListener("click", () => selectSection(button.dataset.section));
  });
  lightSection("sablona");        // app.js renders the canvas itself on start
}

function selectSection(section) {
  if (section === "layout") {
    openEditor();                 // lights the rail itself via openEditorFor
    return;
  }
  closeThemeEditor();             // no-op when it isn't open
  setActiveSection(section);
}

/** Lights one rail item and shows/hides the placeholder section. */
export function setActiveSection(section) {
  if (!buttons) return;
  lightSection(section);

  // .main is display:none while another section is up, so any window resize
  // that happened meanwhile measured nothing and left the canvas at a stale
  // scale. Now that the template section is visible again, fit it for real.
  if (section === "sablona") renderLayout();
}

function lightSection(section) {
  buttons.forEach(button => {
    const active = button.dataset.section === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.body.classList.toggle("section-prvky", section === "prvky");
}
