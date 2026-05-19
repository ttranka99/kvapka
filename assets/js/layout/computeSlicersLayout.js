import * as state from "../state/state.js";

// temporarily moved from app.js – original function
function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
  }
}

// temporarily moved from app.js – original function
function computeSlicerRowWidths(rowSlicers) {
  const n = rowSlicers.length;
  if (n === 0) return [];

  if (n <= 3) return rowSlicers.map(s => s.locked ? s.width : 350);

  const totalGaps = (n - 1) * state.GAP_SMALL;
  const lockedSum = rowSlicers
    .filter(s => s.locked)
    .reduce((sum, s) => sum + (s.width ?? 0), 0);

  let remaining = state.USABLE_WIDTH - totalGaps - lockedSum;

  if (remaining < 0) {
    addWarning("Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku.");
    remaining = 0;
  }

  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;

  if (m === 0) return rowSlicers.map(s => s.width);

  if (remaining < m * state.MIN_SLICER_WIDTH) {
    addWarning("Nedostatek místa – některé slicery mohou být příliš úzké.");
  }

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  return rowSlicers.map(s => {
    if (s.locked) return s.width;
    let w = base;
    if (remainder > 0) { w += 1; remainder--; }
    return w;
  });
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
