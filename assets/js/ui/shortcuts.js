// assets/js/ui/shortcuts.js
//
// The keyboard shortcuts beyond undo / redo (those stay in state/history.js):
//
//   Ctrl+S            save the project (.kvapka.json)
//   Ctrl+E            export for Power BI
//   Delete/Backspace  remove the selected element
//   Escape            clear the selection
//   Arrow keys        select the nearest element in that direction
//   ?                 open Help
//
// Every action goes through the same function as its button (or, for Delete,
// the card's own ×), so locks, warnings, autosave and undo behave the same
// whichever way it was triggered. SHORTCUTS below is what the Help modal
// lists, kept next to the handler so the two can't drift apart.
//
// Modals answer their own keys (ui/dialog.js stops propagation), so nothing
// here fires while one is open.

import * as state from "../state/state.js";
import { isGestureActive } from "../state/history.js";
import { setSelected } from "./selection.js";
import { saveProject } from "./projectMenu.js";
import { exportPowerBILayout } from "../export/exportPowerBI.js";
import { handleRemoveSlicer } from "../events/slicerEvents.js";
import { handleRemoveKpi } from "../events/kpiEvents.js";
import { handleRemoveChart } from "../events/chartEvents.js";
import { handleRemoveStackChart } from "../events/stackEvents.js";
import { isTextField, letterOf, MOD_LABEL } from "./keys.js";

/** Rows of the Help modal's shortcut table: key combos and what they do. */
export const SHORTCUTS = [
  { keys: [[MOD_LABEL, "S"]], text: "help.keys.save" },
  { keys: [[MOD_LABEL, "E"]], text: "help.keys.export" },
  { keys: [[MOD_LABEL, "Z"]], text: "help.keys.undo" },
  { keys: [[MOD_LABEL, "Y"], [MOD_LABEL, "Shift", "Z"]], text: "help.keys.redo" },
  { keys: [["Delete"], ["Backspace"]], text: "help.keys.delete" },
  { keys: [["Esc"]], text: "help.keys.deselect" },
  { keys: [["←"], ["↑"], ["→"], ["↓"]], text: "help.keys.arrows" },
  { keys: [["F2"]], text: "help.keys.rename" },
  { keys: [["?"]], text: "help.keys.help" },
];

// The cards on the canvas, without the fading copies motion.js leaves behind
// for a removed one.
const CARDS = "#canvas .canvas-element:not(.is-ghost)";

const ARROWS = {
  ArrowLeft: { axis: "x", sign: -1 },
  ArrowRight: { axis: "x", sign: 1 },
  ArrowUp: { axis: "y", sign: -1 },
  ArrowDown: { axis: "y", sign: 1 },
};

let openHelp = () => {};

export function initShortcuts(options) {
  openHelp = options.openHelp;
  document.addEventListener("keydown", onKeydown);
}

// The canvas is on screen: not behind the template editor or the rail's
// placeholder section.
const canvasShown = () =>
  !document.body.classList.contains("theme-editor-open") && !document.body.classList.contains("section-prvky");

function onKeydown(e) {
  if (e.defaultPrevented || e.isComposing || isGestureActive()) return;
  // AltGr is Ctrl+Alt on Windows; on Czech and other European layouts it
  // types characters, and must never trigger anything.
  if (e.altKey) return;

  if (e.ctrlKey || e.metaKey) {
    onModifiedKey(e);
    return;
  }

  const active = document.activeElement;
  const typing = isTextField(e.target) || isTextField(active);

  if (e.key === "?" && !typing) {
    e.preventDefault();
    openHelp();
    return;
  }

  if (typing || e.shiftKey || !canvasShown()) return;
  // A focused page tab owns its keys (arrows switch pages, F2 renames).
  if (active && active.closest?.('[role="tablist"]')) return;

  if (e.key === "Delete" || e.key === "Backspace") {
    if (!state.selectedElement) return;
    e.preventDefault();
    removeSelected();
  } else if (e.key === "Escape") {
    if (!state.selectedElement) return;
    e.preventDefault();
    setSelected(null);
  } else if (ARROWS[e.key]) {
    // Only while nothing else holds the focus: a focused button group or
    // menu may use the arrows itself.
    const canvas = document.getElementById("canvas");
    if (active && active !== document.body && active !== document.documentElement && !canvas?.contains(active)) return;
    if (selectNeighbour(ARROWS[e.key])) e.preventDefault();
  }
}

function onModifiedKey(e) {
  if (e.shiftKey) return;
  const letter = letterOf(e);
  if (letter !== "s" && letter !== "e") return;
  e.preventDefault();
  // A field being edited (a page rename, a size typed into the inspector)
  // commits on blur, so what is saved is what is on screen.
  const active = document.activeElement;
  if (isTextField(active)) active.blur();
  if (letter === "s") saveProject();
  else exportPowerBILayout();
}

// Removes the selected element through the handler its × button calls. The
// selection is cleared only if something was actually removed: a refusal
// (the rest of the row is locked) keeps it, next to the handler's own toast.
function removeSelected() {
  const domId = state.selectedElement?.domId || "";
  const el = document.getElementById(domId);
  const count = () => document.querySelectorAll(CARDS).length;
  const before = count();

  let m;
  if ((m = /^slicer-(\d+)$/.exec(domId))) {
    handleRemoveSlicer(Number(m[1]));
  } else if (/^kpi-/.test(domId) && el?.dataset.kpi) {
    const split = el.dataset.kpi.lastIndexOf(":");
    handleRemoveKpi(Number(el.dataset.kpi.slice(split + 1)), el.dataset.kpi.slice(0, split));
  } else if ((m = /^chart-(\d+)-(\d+)-(\d+)$/.exec(domId))) {
    handleRemoveStackChart(Number(m[1]), Number(m[2]), Number(m[3]));
  } else if ((m = /^chart-(\d+)-(\d+)$/.exec(domId))) {
    handleRemoveChart(Number(m[1]), Number(m[2]));
  } else {
    return;                       // the header can't be removed
  }

  if (count() < before) setSelected(null);
}

// Moves the selection to the nearest card in the pressed direction. Only
// cards wholly past the current one's edge count (so the full-width header
// is never "to the right" of a slicer). Cards in the same row (or column)
// come first; among them the smallest gap wins, then the one best lined up.
// With nothing selected the arrows are left to the page, so they still scroll
// it. Selecting goes through the card's own click handler.
function selectNeighbour({ axis, sign }) {
  const cards = [...document.querySelectorAll(CARDS)];
  const current = document.getElementById(state.selectedElement?.domId || "");
  if (!current || !cards.includes(current)) return false;

  const TOLERANCE = 2;
  const from = current.getBoundingClientRect();
  const [start, end] = axis === "x" ? ["left", "right"] : ["top", "bottom"];
  const [crossStart, crossEnd] = axis === "x" ? ["top", "bottom"] : ["left", "right"];
  const mid = (r, a, b) => (r[a] + r[b]) / 2;

  let best = null;
  let bestScore = Infinity;
  for (const card of cards) {
    if (card === current) continue;
    const to = card.getBoundingClientRect();
    const gap = sign > 0 ? to[start] - from[end] : from[start] - to[end];
    if (gap < -TOLERANCE) continue;
    const inLine = to[crossStart] < from[crossEnd] && to[crossEnd] > from[crossStart];
    const offset = Math.abs(mid(to, crossStart, crossEnd) - mid(from, crossStart, crossEnd));
    const score = (inLine ? 0 : 1e6) + Math.max(0, gap) * 4 + offset;
    if (score < bestScore) {
      bestScore = score;
      best = card;
    }
  }
  if (!best) return false;
  best.click();
  return true;
}
