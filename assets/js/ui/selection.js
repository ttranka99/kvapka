import * as state from "../state/state.js";
import { addWarning, renderWarnings } from "./warnings.js";

// Unsaved width/height edits, typed into the panel but not yet applied to
// app state. Seeded from the selected element's confirmed values on every
// fresh selection (see setSelected below); only inline editing changes it
// after that. The displayed spans always render from `pending`, not from
// the confirmed value directly, so "what you typed" and "what's shown" never
// diverge.
let pending = { width: null, height: null };

function isWidthEditable(kind) {
  return kind === "slicer" || kind === "kpi" || kind === "chartRow";
}

function isHeightEditable(kind) {
  return kind === "chartRow" || kind === "stackChart";
}

export function getPendingWidth() {
  return pending.width;
}

export function getPendingHeight() {
  return pending.height;
}

// Shows/hides and enables/disables the single Apply button. Dirty (enabled,
// red — see button:disabled in style.css for the gray/red split) means the
// shown value differs from the last-applied one for at least one editable
// field of the current kind.
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

// Swapped into a copy button briefly after a successful copy: the check mark
// is the only confirmation the user gets, so no notification is raised.
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const COPY_SUCCESS_MS = 1200;

// Wires the copy-to-clipboard buttons next to the X/Y/width/height rows.
// These DOM nodes are static (unlike #canvas, the selection panel is never
// torn down and rebuilt), so this only needs to run once at startup rather
// than after every setSelected() call.
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
        btn.innerHTML = CHECK_ICON;
        btn.classList.add("copy-btn-success");
        revertTimer = setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove("copy-btn-success");
        }, COPY_SUCCESS_MS);
      } catch {
        addWarning("Kopírování se nezdařilo.", "error");
        renderWarnings();
      }
    });
  });
}

// Wires editing for the width/height rows: double-clicking the number, or a
// single click on its pencil button, swaps the number for a small inline
// number input and focuses it so the user can type immediately. Blur or
// Enter commits the typed value back into `pending` (still unsaved —
// nothing is written to app state here), Escape cancels. Invalid input
// surfaces the same toast-based error pattern used everywhere else in the
// panel rather than silently discarding or accepting garbage.
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
      // .editable-value sets `display` with specificity/order that would
      // beat a plain .hidden class, so it's hidden via inline style instead.
      // The pencil uses visibility (not display) so it keeps its layout box
      // and .push-right margin while hidden — otherwise the copy button next
      // to it would jump left for the duration of the edit (see the
      // .edit-pencil-btn comment in style.css for why that margin matters).
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
        addWarning("Zadejte platné číslo.", "error");
        renderWarnings();
        // Revert just this one field back to the element's actual current
        // (last-applied) size — not the whole selection/panel, and not
        // whatever unrelated unsaved edit might still be pending on the
        // *other* field.
        const info = state.selectedElement;
        if (info) pending[key] = info[key];
      } else {
        pending[key] = val;
      }

      span.textContent = pending[key];
      input.classList.add("hidden");
      wrapper.style.display = "";
      // Re-apply pencil visibility in case the field became non-editable
      // while being edited (e.g. the user clicked away to a different,
      // read-only element mid-edit) — don't just blindly un-hide it.
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

// Shows the sidebar "Graf" split button only while the current selection is
// an unstacked, unlocked top-level chart cell — the only kind of selection
// splitting is actually valid for (see canSplitChart in stackEvents.js,
// which this mirrors without importing it, to avoid a circular import: that
// module imports setSelected from here).
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

// opts.preservePending: when true, refreshes the panel's geometry (e.g.
// after a drag tick or an Apply attempt) without resetting `pending`. Used
// after an Apply attempt so a field that failed validation keeps showing
// the user's attempted value instead of reverting silently; a field that
// succeeded already matches its new confirmed value, so it's a no-op for
// that field either way. A genuine new selection (the default) always
// resets `pending` to the freshly selected element's confirmed values.
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
  // Clear any leftover inline override from a previous mid-edit hide, so a
  // fresh selection's pencil visibility is driven purely by the class
  // toggle above.
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
}
