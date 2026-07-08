import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";

// Handle adding a slicer at a specific index
export function handleAddSlicer(globalIndex) {
  if (state.slicers.length >= state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.", "error");
    renderLayout();
    return;
  }

  const newSlicers = [...state.slicers];
  newSlicers.splice(globalIndex, 0, { width: null, locked: false });
  state.setSlicers(newSlicers);
  renderLayout();
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