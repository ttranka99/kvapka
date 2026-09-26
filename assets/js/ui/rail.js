// assets/js/ui/rail.js
//
// The left rail: three sections, exactly one lit at a time.
//
//   studio  — the Template panel + canvas (the app as it always was)
//   layout  — the theme editor, shown as a section rather than a dialog
//   prvky   — Customize Elements: the styles of slicers, KPI cards and
//             charts (elements/elementsSection.js)
//
// The rail only switches what is on screen; it owns no layout state. The
// editor's own exits (Uložit, Zrušit, Escape, delete, import) report back
// through its onClose hook (see themePicker.js), which is what keeps the rail
// truthful when the editor closes itself.

import { closeThemeEditor } from "../theme/themeEditor.js";
import { renderLayout } from "./renderLayout.js";
import { openElementsSection, confirmLeaveElements } from "../elements/elementsSection.js";
import { syncHistoryButtons } from "../state/history.js";

let buttons;
let openEditor;

export function initRail(options) {
  openEditor = options.openEditor;
  buttons = document.querySelectorAll(".rail-btn[data-section]");
  buttons.forEach(button => {
    button.addEventListener("click", () => selectSection(button.dataset.section));
  });
  lightSection("studio");        // app.js renders the canvas itself on start
}

async function selectSection(section) {
  // Customize Elements edits a draft; leaving with one unsaved asks first
  // (Save / Discard / Stay).
  const inElements = document.body.classList.contains("section-prvky");
  if (inElements && section !== "prvky" && !(await confirmLeaveElements())) return;
  if (section === "layout") {
    openEditor();                 // lights the rail itself via openEditorFor
    return;
  }
  closeThemeEditor();             // no-op when it isn't open
  setActiveSection(section);
}

/** Lights one rail item and shows/hides the Customize Elements section. */
export function setActiveSection(section) {
  if (!buttons) return;
  lightSection(section);

  // .main is display:none while another section is up, so any window resize
  // that happened meanwhile measured nothing and left the canvas at a stale
  // scale. Now that the Studio section is visible again, fit it for real.
  if (section === "studio") renderLayout();
}

function lightSection(section) {
  buttons.forEach(button => {
    const active = button.dataset.section === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.body.classList.toggle("section-prvky", section === "prvky");
  // Built (and fitted) once it is visible, so it can measure itself.
  if (section === "prvky") openElementsSection();
  // Undo / redo follow the section: the element styles have their own history.
  syncHistoryButtons();
}

/** Marks a rail item with a dot, e.g. Customize Elements with unsaved edits. */
export function setRailDot(section, on) {
  document.querySelector(`.rail-btn[data-section="${section}"]`)?.classList.toggle("has-dot", on);
}
