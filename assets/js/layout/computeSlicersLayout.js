import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { computeSlicerRowWidths } from "./computeSlicerRowWidths.js";

const SECOND_ROW_LIMIT_WARNING = "Druhý řádek slicerů překračuje vybraný limit.";
const MAX_PER_ROW_INFO = "Dosaženo maximálního počtu slicerů na řádek. Další slicery budou umístěny na další řádek.";
const HARD_LIMIT_ERROR = "Bylo dosaženo maximálního počtu slicerů.";
const SECOND_ROW_OVERFLOW_ERROR = "Slicery na druhém řádku se nevejdou – uprav šířky nebo odeber slicer.";

// Tracks which conditions this module has already surfaced a notification
// for, independent of whether that notification has since timed out into the
// bell's panel. See the identical comment in computeKpiLayout.js: without
// this, a still-true condition whose toast already timed out to the panel
// would get re-added (and its toast popped back up) on every unrelated
// re-render, since state.warnings alone can't distinguish "just recurred"
// from "never stopped being true, panel-timeout just happened on its own
// schedule". A message is only (re-)added at the actual false→true transition.
const activeConditions = new Set();

function syncWarning(condition, msg, type) {
  const trackedActive = activeConditions.has(msg) && state.warnings.includes(msg);

  if (condition && !trackedActive) {
    addWarning(msg, type);
    activeConditions.add(msg);
  } else if (!condition) {
    if (state.warnings.includes(msg)) {
      state.setWarnings(state.warnings.filter(w => w !== msg));
    }
    activeConditions.delete(msg);
  }
}

export function computeSlicersLayout(v) {
    syncWarning(state.slicers.length === state.MAX_SLICERS, MAX_PER_ROW_INFO, "info");
    syncWarning(
        state.slicers.length > state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS,
        HARD_LIMIT_ERROR,
        "error"
    );

    const row1 = state.slicers.slice(0, state.MAX_SLICERS);
    const row2 = state.slicers.slice(
        state.MAX_SLICERS,
        state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS
    );

    syncWarning(row2.length > state.MAX_SLICERS, SECOND_ROW_LIMIT_WARNING, "warning");

    const row1Widths = computeSlicerRowWidths(row1);

    let row2Widths = [];
    let row2Overflows = false;
    if (row2.length > 0) {
        row2Widths = computeSlicerRowWidths(row2);

        const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;
        const totalWidth2 = row2Widths.reduce((s, w) => s + w, 0) + totalGaps2;
        row2Overflows = totalWidth2 > state.USABLE_WIDTH;
    }

    syncWarning(row2Overflows, SECOND_ROW_OVERFLOW_ERROR, "error");
    if (row2Overflows) return [];

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