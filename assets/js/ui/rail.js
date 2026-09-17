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

let buttons;
let openEditor;

export function initRail(options) {
  openEditor = options.openEditor;
  buttons = document.querySelectorAll(".rail-btn[data-section]");
  buttons.forEach(button => {
    button.addEventListener("click", () => selectSection(button.dataset.section));
  });
  setActiveSection("sablona");
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
  buttons.forEach(button => {
    const active = button.dataset.section === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.body.classList.toggle("section-prvky", section === "prvky");
}
