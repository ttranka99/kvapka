import * as state from "../state/state.js";
import { computeSlicerRowWidths } from "./computeSlicerRowWidths.js";


// temporarily moved from app.js – original function
function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
  }
}

export function computeSlicersLayout(v) {
  if (state.slicers.length === state.MAX_SLICERS) {
    addWarning("Dosaženo maximálního počtu slicerů na řádek. Další slicery budou umístěny na další řádek.");
  }

  const row1 = state.slicers.slice(0, state.MAX_SLICERS);
  const row2 = state.slicers.slice(state.MAX_SLICERS, state.MAX_SLICERS * 2);

  if (state.slicers.length > state.MAX_SLICERS * 2) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    return [];
  }

  const row1Widths = computeSlicerRowWidths(row1);

  let row2Widths = [];
  if (row2.length > 0) {
    row2Widths = computeSlicerRowWidths(row2);

    const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;
    const totalWidth2 = row2Widths.reduce((s, w) => s + w, 0) + totalGaps2;

    if (totalWidth2 > state.USABLE_WIDTH) {
      addWarning("Slicery na druhém řádku se nevejdou – uprav šířky nebo odeber slicer.");
      return [];
    }
  }

  const rows = [];

  if (row1.length) {
    let x = state.MARGIN;
    const items = row1.map((s, i) => {
      const w = row1Widths[i];
      const item = {
        type: "slicer",
        globalIndex: i + 1,
        x,
        y: v.slicersTop,
        width: w,
        height: state.SLICER_HEIGHT,
        stateRef: s
      };
      x += w + state.GAP_SMALL;
      return item;
    });
    rows.push(items);
  }

  if (row2.length) {
    let x = state.MARGIN;
    const items = row2.map((s, i) => {
      const w = row2Widths[i];
      const globalIndex = state.MAX_SLICERS + i + 1;
      const item = {
        type: "slicer",
        globalIndex,
        x,
        y: v.slicersTop + state.SLICER_HEIGHT + state.GAP_SMALL,
        width: w,
        height: state.SLICER_HEIGHT,
        stateRef: s
      };
      x += w + state.GAP_SMALL;
      return item;
    });
    rows.push(items);
  }

  return rows;
}
