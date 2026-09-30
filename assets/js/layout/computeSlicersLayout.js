import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { computeSlicerRowWidths } from "./computeSlicerRowWidths.js";
import {
    computeSlicerColumnHeights,
    slicerColumnOverflows
} from "./computeSlicerColumnHeights.js";
import { t } from "../i18n/i18n.js";

const SECOND_ROW_LIMIT_WARNING = () => t("warnings.slicer.secondRowLimit");
const MAX_PER_ROW_INFO = () => t("warnings.slicer.maxPerRow");
const HARD_LIMIT_ERROR = () => t("warnings.slicer.limit");
const SECOND_ROW_OVERFLOW_ERROR = () => t("warnings.slicer.secondRowOverflow");
const COLUMN_OVERFLOW_ERROR = () => t("warnings.slicer.columnOverflow");

// Conditions already reported, tracked apart from the toast timing out into
// the bell's panel. A message is only added when the condition goes from
// false to true. See computeKpiLayout.js for why.
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

    syncWarning(false, COLUMN_OVERFLOW_ERROR(), "error");
    syncWarning(state.slicers.length === state.MAX_SLICERS, MAX_PER_ROW_INFO(), "info");
    syncWarning(
        state.slicers.length > state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS,
        HARD_LIMIT_ERROR(),
        "error"
    );

    const row1 = state.slicers.slice(0, state.MAX_SLICERS);
    const row2 = state.slicers.slice(
        state.MAX_SLICERS,
        state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS
    );

    syncWarning(row2.length > state.MAX_SLICERS, SECOND_ROW_LIMIT_WARNING(), "warning");

    const row1Widths = computeSlicerRowWidths(row1);

    let row2Widths = [];
    let row2Overflows = false;
    if (row2.length > 0) {
        row2Widths = computeSlicerRowWidths(row2);

        const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;
        const totalWidth2 = row2Widths.reduce((s, w) => s + w, 0) + totalGaps2;
        row2Overflows = totalWidth2 > state.USABLE_WIDTH;
    }

    syncWarning(row2Overflows, SECOND_ROW_OVERFLOW_ERROR(), "error");
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
                height: state.SLICER_ROW_HEIGHT,
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
                y: v.slicersTop + state.SLICER_ROW_HEIGHT + state.GAP_SMALL,
                width: w,
                height: state.SLICER_ROW_HEIGHT,
                stateRef: s
            };
            x += w + state.GAP_SMALL;
            return item;
        });
        rows.push(items);
    }

    return rows;
}

// Vertical mode: one fixed-width column of slicers down the left side, below
// the title. Heights come from computeSlicerColumnHeights; every slicer uses
// the column's width. There is deliberately no second column: the slicer
// count is capped by what fits.
function computeSlicerColumn(v) {
    // Row conditions can't apply here. Clear any raised before the switch.
    syncWarning(false, MAX_PER_ROW_INFO(), "info");
    syncWarning(false, HARD_LIMIT_ERROR(), "error");
    syncWarning(false, SECOND_ROW_LIMIT_WARNING(), "warning");
    syncWarning(false, SECOND_ROW_OVERFLOW_ERROR(), "error");

    if (state.slicers.length === 0) {
        syncWarning(false, COLUMN_OVERFLOW_ERROR(), "error");
        return [];
    }

    // Overflow only happens when locked heights exceed the column (adding a
    // slicer is blocked first). Heights are clamped on-canvas, so this only
    // warns instead of dropping the layout like a row overflow does.
    syncWarning(
        slicerColumnOverflows(state.slicers, v.slicerColumnHeight),
        COLUMN_OVERFLOW_ERROR(),
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
