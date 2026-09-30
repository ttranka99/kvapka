import * as state from "../state/state.js";
import { addWarning, renderWarnings } from "./warnings.js";
import { icon } from "./icon.js";
import { t, onLocaleChange } from "../i18n/i18n.js";

// Unsaved width/height edits typed into the panel, not yet applied to app
// state. Seeded from the selected element's values on each fresh selection
// (see setSelected); only inline editing changes it after that. The spans
// always render from `pending`, so what you typed and what is shown agree.
let pending = { width: null, height: null };

function isWidthEditable(kind) {
  if (kind === "slicer") return !state.isVerticalSlicers();
  return kind === "kpi" || kind === "chartRow";
}

// Slicer height: its own in a vertical column, the band's shared one in a
// horizontal row. KPI height: always its band's (see applyHeightValue in
// resizeEvents.js).
function isHeightEditable(kind) {
  return kind === "slicer" || kind === "kpi" || kind === "chartRow" || kind === "stackChart";
}

export function getPendingWidth() {
  return pending.width;
}

export function getPendingHeight() {
  return pending.height;
}

// Enables/disables the single Apply button. Dirty (enabled, red; see
// button:disabled in style.css) means at least one editable field of the
// current kind differs from its last-applied value.
function updateApplyButtonState() {
  const applyBtn = document.getElementById("apply-selection");
  const info = state.selectedElement;

  if (!info) {
    applyBtn.classList.add("hidden");
    applyBtn.disabled = true;
    return;
  }

  const widthEditable = isWidthEditable(info.kind);
  const heightEditable = isHeightEditable(info.kind);

  if (!widthEditable && !heightEditable) {
    applyBtn.classList.add("hidden");
    applyBtn.disabled = true;
    return;
  }

  applyBtn.classList.remove("hidden");

  const dirty =
    (widthEditable && pending.width !== info.width) ||
    (heightEditable && pending.height !== info.height);

  applyBtn.disabled = !dirty;
}

// A successful copy swaps a check mark (icon("check")) into the button. That
// is the only confirmation, so no notification is raised.
const COPY_SUCCESS_MS = 1200;

// Wires the copy buttons next to the X/Y/width/height rows. The panel is
// never rebuilt (unlike #canvas), so this runs once at startup.
export function initSelectionCopyButtons() {
  document.querySelectorAll(".copy-btn[data-copy-target]").forEach(btn => {
    const originalHTML = btn.innerHTML;
    let revertTimer = null;

    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.copyTarget);
      if (!target) return;

      // The value spans only ever hold the bare number (the "px" suffix is
      // separate literal text in the markup), so textContent is already
      // exactly what should land on the clipboard.
      const value = target.textContent.trim();
      try {
        await navigator.clipboard.writeText(value);
        clearTimeout(revertTimer);
        btn.innerHTML = icon("check");
        btn.classList.add("copy-btn-success");
        revertTimer = setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove("copy-btn-success");
        }, COPY_SUCCESS_MS);
      } catch {
        addWarning(t("warnings.copyFailed"), "error");
        renderWarnings();
      }
    });
  });
}

// Wires editing for the width/height rows: a double-click on the number, or
// a click on its pencil, swaps it for a focused number input. Blur or Enter
// commits into `pending` (nothing is written to app state here), Escape
// cancels. Invalid input raises a toast.
export function initSelectionInlineEditing() {
  const fields = [
    { key: "width", wrapperId: "edit-width-wrapper", pencilId: "edit-width-pencil", spanId: "sel-width", inputId: "input-width", isEditable: isWidthEditable },
    { key: "height", wrapperId: "edit-height-wrapper", pencilId: "edit-height-pencil", spanId: "sel-height", inputId: "input-height", isEditable: isHeightEditable }
  ];

  fields.forEach(({ key, wrapperId, pencilId, spanId, inputId, isEditable }) => {
    const wrapper = document.getElementById(wrapperId);
    const pencil = document.getElementById(pencilId);
    const span = document.getElementById(spanId);
    const input = document.getElementById(inputId);

    function beginEdit() {
      const info = state.selectedElement;
      if (!info || !isEditable(info.kind)) return;

      input.value = pending[key];
      // .editable-value sets `display` with a specificity/order that beats
      // .hidden, so hide it with an inline style. The pencil uses visibility,
      // not display, to keep its box and .push-right margin, or the copy
      // button would jump left (see .edit-pencil-btn in style.css).
      wrapper.style.display = "none";
      pencil.style.visibility = "hidden";
      input.classList.remove("hidden");
      input.focus();
      input.select();
    }

    wrapper.addEventListener("dblclick", beginEdit);
    pencil.addEventListener("click", beginEdit);

    function commit() {
      if (input.classList.contains("hidden")) return;

      const raw = input.value.trim();
      const val = parseInt(raw, 10);

      if (raw === "" || isNaN(val)) {
        addWarning(t("warnings.size.invalidNumber"), "error");
        renderWarnings();
        // Revert only this field to the last-applied size, not the other
        // field's pending edit.
        const info = state.selectedElement;
        if (info) pending[key] = info[key];
      } else {
        pending[key] = val;
      }

      span.textContent = pending[key];
      input.classList.add("hidden");
      wrapper.style.display = "";
      // The field may have become non-editable mid-edit (a click on a
      // read-only element), so don't just un-hide the pencil.
      pencil.style.visibility = isEditable(state.selectedElement?.kind) ? "" : "hidden";
      updateApplyButtonState();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        input.blur();
      } else if (e.key === "Escape") {
        input.value = pending[key];
        input.blur();
      }
    });
  });
}

// Shows the sidebar "Graf" split button only for an unstacked, unlocked chart
// cell. Mirrors canSplitChart in stackEvents.js without importing it, to
// avoid a circular import (that module imports setSelected from here).
function updateSplitChartButtonVisibility(info) {
  const btn = document.getElementById("add-chart-split");
  if (!btn) return;

  let show = false;
  if (info?.kind === "chartRow" && info.domId) {
    const match = /^chart-(\d+)-(\d+)$/.exec(info.domId);
    if (match) {
      const item = state.chartRows[Number(match[1])]?.items?.[Number(match[2])];
      show = !!item && !item.stack && !item.locked;
    }
  }

  btn.classList.toggle("hidden", !show);
}

// opts.preservePending: refresh the panel's geometry (after a drag tick or an
// Apply attempt) without resetting `pending`, so a field that failed
// validation keeps the attempted value. A new selection (the default) resets
// `pending` to the element's confirmed values.
export function setSelected(info, opts = {}) {
  const { preservePending = false } = opts;

  const noSelectionEl = document.getElementById("no-selection");
  const selectionDetailsEl = document.getElementById("selection-details");
  const selTypeEl = document.getElementById("sel-type");
  const selIndexEl = document.getElementById("sel-index");
  const selXEl = document.getElementById("sel-x");
  const selYEl = document.getElementById("sel-y");
  const selWidthEl = document.getElementById("sel-width");
  const selHeightEl = document.getElementById("sel-height");
  const editWidthWrapperEl = document.getElementById("edit-width-wrapper");
  const editHeightWrapperEl = document.getElementById("edit-height-wrapper");
  const editWidthPencilEl = document.getElementById("edit-width-pencil");
  const editHeightPencilEl = document.getElementById("edit-height-pencil");
  const inputWidthEl = document.getElementById("input-width");
  const inputHeightEl = document.getElementById("input-height");

  state.setSelectedElement(info);

  if (!info) {
    pending = { width: null, height: null };
    noSelectionEl.classList.add("expanded");
    selectionDetailsEl.classList.remove("expanded");
    document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
    updateApplyButtonState();
    updateSplitChartButtonVisibility(null);
    return;
  }

  noSelectionEl.classList.remove("expanded");
  selectionDetailsEl.classList.add("expanded");

  selTypeEl.textContent = info.labelType;
  selIndexEl.textContent = info.labelIndex ?? "-";
  selXEl.textContent = info.x;
  selYEl.textContent = info.y;

  if (!preservePending) {
    pending.width = info.width;
    pending.height = info.height;
  }

  const widthEditable = isWidthEditable(info.kind);
  const heightEditable = isHeightEditable(info.kind);

  editWidthWrapperEl.classList.toggle("is-editable", widthEditable);
  editHeightWrapperEl.classList.toggle("is-editable", heightEditable);
  editWidthPencilEl.classList.toggle("is-editable", widthEditable);
  editHeightPencilEl.classList.toggle("is-editable", heightEditable);
  // Clear inline overrides left by a mid-edit hide, so the class toggle
  // above alone drives the pencil.
  editWidthPencilEl.style.visibility = "";
  editHeightPencilEl.style.visibility = "";
  editWidthWrapperEl.style.display = "";
  editHeightWrapperEl.style.display = "";
  inputWidthEl.classList.add("hidden");
  inputHeightEl.classList.add("hidden");

  selWidthEl.textContent = pending.width;
  selHeightEl.textContent = pending.height;

  document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
  if (info.domId) {
    const el = document.getElementById(info.domId);
    if (el) el.classList.add("selected");
  }

  updateApplyButtonState();
  updateSplitChartButtonVisibility(info);
  syncSelectionLockState();
}

// A language switch keeps the selection. Only its type label (stored as
// finished text) needs converting.
onLocaleChange(convert => {
  const info = state.selectedElement;
  if (!info) return;
  info.labelType = convert(info.labelType);
  document.getElementById("sel-type").textContent = info.labelType;
});

/* Marks the inspector's width/height rows with the selected card's lock. The
   card is the source of truth (renderLayout's markLocked writes data-lock),
   so this also runs after every render: a lock toggled from the card's own
   button doesn't re-select. */
export function syncSelectionLockState() {
  const info = state.selectedElement;
  const lock = info && info.domId ? document.getElementById(info.domId)?.dataset.lock : undefined;
  document.getElementById("sel-row-width")?.classList.toggle("is-locked", lock === "width" || lock === "both");
  document.getElementById("sel-row-height")?.classList.toggle("is-locked", lock === "height" || lock === "both");
}
