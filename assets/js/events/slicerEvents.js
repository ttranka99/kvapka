import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";



// Handle adding a slicer at a specific index
export function handleAddSlicer(globalIndex) {
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
export function handleSelectSlicer(item, domId) {
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
  });
}
