import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { flash } from "../ui/motion.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import {
  computeSlicerColumnHeights,
  slicerColumnFits
} from "../layout/computeSlicerColumnHeights.js";
import { t, isFrom } from "../i18n/i18n.js";

// Whether one more slicer can be added. In vertical mode there is no count
// cap: the column must have room for every slicer at its minimum height.
// Shared with app.js's sidebar "Slicer" button.
export function canAddSlicer() {
  if (state.isVerticalSlicers()) {
    const v = computeVerticalLayout();
    return slicerColumnFits(
      [...state.slicers, { width: null, height: null, locked: false }],
      v.slicerColumnHeight
    );
  }
  return state.slicers.length < state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS;
}

export function slicerLimitMessage() {
  return state.isVerticalSlicers()
    ? t("warnings.slicer.columnFull")
    : t("warnings.slicer.limit");
}

// Handle adding a slicer at a specific index
export function handleAddSlicer(globalIndex) {
  if (!canAddSlicer()) {
    addWarning(slicerLimitMessage(), "error");
    renderLayout();
    return;
  }

  const newSlicers = [...state.slicers];
  newSlicers.splice(globalIndex, 0, { width: null, height: null, locked: false });
  state.setSlicers(newSlicers);
  renderLayout();
}

// Freezes (or releases) the one dimension a slicer owns: height in a
// vertical column, width in a horizontal row. Locking captures the solver's
// current value, so the slicer doesn't jump.
export function handleToggleSlicerLock(globalIndex) {
  const s = state.slicers[globalIndex - 1];
  if (!s) return;
  const vertical = state.isVerticalSlicers();

  if (s.locked) {
    s.locked = false;
    if (vertical) s.height = null; else s.width = null;
  } else {
    const v = computeVerticalLayout();
    if (vertical) {
      const heights = computeSlicerColumnHeights(state.slicers, v.slicerColumnHeight);
      s.height = heights[globalIndex - 1] ?? state.SLICER_HEIGHT;
    } else {
      const item = computeSlicersLayout(v).flat().find(i => i.globalIndex === globalIndex);
      s.width = item ? item.width : s.width;
    }
    s.locked = true;
  }

  renderLayout();
  if (s.locked) flash(`slicer-${globalIndex}`);   // locking only; unlocking is quiet
}

// Handle removing a slicer at a specific index
export function handleRemoveSlicer(globalIndex) {
  const newSlicers = [...state.slicers];
  newSlicers.splice(globalIndex - 1, 1);

  if (newSlicers.length < state.MAX_SLICERS) {
    state.setWarnings(state.warnings.filter(w => !isFrom(w, "warnings.slicer.")));
  }

  state.setSlicers(newSlicers);
  renderLayout();
}

// Handle clicking a slicer (selecting it)
export function handleSelectSlicer(item, domId, opts = {}) {
  setSelected({
    kind: "slicer",
    labelType: t("selection.kind.slicer"),
    labelIndex: item.globalIndex,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    domId,
    stateRef: item.stateRef
  }, opts);
}

// Re-syncs the selection panel to the selected slicer after an edit (e.g.
// Apply changes its width and neighbors redistribute). Mirrors
// refreshSelectedChartAfterResize in chartEvents.js. Finds the slicer by
// stateRef, since an edit never adds or removes slicers.
export function refreshSelectedSlicerAfterEdit(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "slicer" || !selected.domId) return;

  const v = computeVerticalLayout();
  const rows = computeSlicersLayout(v);
  const item = rows.flat().find(i => i.stateRef === selected.stateRef);
  if (!item) return;

  handleSelectSlicer(item, selected.domId, { preservePending });
}