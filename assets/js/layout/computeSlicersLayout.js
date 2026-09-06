import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { computeSlicerRowWidths } from "./computeSlicerRowWidths.js";
import {
    computeSlicerColumnHeights,
    slicerColumnOverflows
} from "./computeSlicerColumnHeights.js";

const SECOND_ROW_LIMIT_WARNING = "Druhý řádek slicerů překračuje vybraný limit.";
const MAX_PER_ROW_INFO = "Dosaženo maximálního počtu slicerů na řádek. Další slicery budou umístěny na další řádek.";
const HARD_LIMIT_ERROR = "Bylo dosaženo maximálního počtu slicerů.";
const SECOND_ROW_OVERFLOW_ERROR = "Slicery na druhém řádku se nevejdou – uprav šířky nebo odeber slicer.";
const COLUMN_OVERFLOW_ERROR = "Slicery se nevejdou do sloupce – snižte zamčené výšky nebo odeberte slicer.";

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
    if (state.isVerticalSlicers()) return computeSlicerColumn(v);

    syncWarning(false, COLUMN_OVERFLOW_ERROR, "error");
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

// Vertical mode: a single fixed-width column of slicers down the left side,
// top-aligned below the title. Heights come from computeSlicerColumnHeights
// (see that file for the fill/shrink rules) and the width is the column's,
// shared by every slicer in it. There is deliberately no second column —
// slicer count is capped by what fits the one column instead.
function computeSlicerColumn(v) {
    // None of the horizontal row conditions can hold in this mode; clear any
    // that were raised before the switch so they don't linger in the panel.
    syncWarning(false, MAX_PER_ROW_INFO, "info");
    syncWarning(false, HARD_LIMIT_ERROR, "error");
    syncWarning(false, SECOND_ROW_LIMIT_WARNING, "warning");
    syncWarning(false, SECOND_ROW_OVERFLOW_ERROR, "error");

    if (state.slicers.length === 0) {
        syncWarning(false, COLUMN_OVERFLOW_ERROR, "error");
        return [];
    }

    // Overflow is only reachable by locking slicers to heights that together
    // exceed the column (adding one is blocked before it can overflow) — the
    // heights are clamped to stay on-canvas either way, so this warns rather
    // than invalidating the whole layout the way a row overflow does.
    syncWarning(
        slicerColumnOverflows(state.slicers, v.slicerColumnHeight),
        COLUMN_OVERFLOW_ERROR,
        "error"
    );

    const heights = computeSlicerColumnHeights(state.slicers, v.slicerColumnHeight);

    let y = v.slicerColumnTop;
    return [state.slicers.map((s, i) => {
        const item = {
            type: "slicer",
            globalIndex: i + 1,
            x: v.slicerColumnLeft,
            y,
            width: v.slicerColumnWidth,
            height: heights[i],
            stateRef: s
        };
        y += heights[i] + state.GAP_SMALL;
        return item;
    })];
}
