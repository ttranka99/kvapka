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

// Whether one more slicer can be added. In vertical mode the cap isn't a
// count at all — it's whether the column still has room for every slicer at
// its minimum height, after the unlocked ones shrink back down to make way.
// Shared with app.js's sidebar "Slicer" button so both entry points agree.
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
    ? "Další slicer se do sloupce nevejde – odemkněte výšky nebo odeberte slicer."
    : "Bylo dosaženo maximálního počtu slicerů.";
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

// Vertical mode only: freezes (or releases) one slicer's height, so the
// fill/shrink rules redistribute around it instead of resizing it. Locking
// captures the height the solver is currently showing — same freeze-on-lock
// behaviour as a chart row, so the element doesn't jump the moment it's
// locked.
export function handleToggleSlicerLock(globalIndex) {
  const s = state.slicers[globalIndex - 1];
  if (!s) return;

  if (s.locked) {
    s.locked = false;
    s.height = null;
  } else {
    const v = computeVerticalLayout();
    const heights = computeSlicerColumnHeights(state.slicers, v.slicerColumnHeight);
    s.height = heights[globalIndex - 1] ?? state.SLICER_HEIGHT;
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
    state.setWarnings(state.warnings.filter(w => !w.includes("slicer")));
  }

  state.setSlicers(newSlicers);
  renderLayout();
}

// Handle clicking a slicer (selecting it)
export function handleSelectSlicer(item, domId, opts = {}) {
  setSelected({
    kind: "slicer",
    labelType: "Slicer",
    labelIndex: item.globalIndex,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    domId,
    stateRef: item.stateRef
  }, opts);
}

// Re-syncs the selection panel to a slicer's current geometry after an edit
// (e.g. after the Apply button changes its width and neighboring slicers
// redistribute). Mirrors refreshSelectedChartAfterResize in chartEvents.js:
// finds the freshly computed layout item for the currently-selected slicer
// by stateRef (its position in the row can't have shifted, since applying a
// width never adds/removes slicers) and re-selects it.
export function refreshSelectedSlicerAfterEdit(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "slicer" || !selected.domId) return;

  const v = computeVerticalLayout();
  const rows = computeSlicersLayout(v);
  const item = rows.flat().find(i => i.stateRef === selected.stateRef);
  if (!item) return;

  handleSelectSlicer(item, selected.domId, { preservePending });
}