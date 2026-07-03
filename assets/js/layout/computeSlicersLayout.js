import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { computeSlicerRowWidths } from "./computeSlicerRowWidths.js";

export function computeSlicersLayout(v) {
    const secondRowLimitWarning = "Druhý řádek slicerů překračuje vybraný limit.";
    if (state.slicers.length === state.MAX_SLICERS) {
        addWarning("Dosaženo maximálního počtu slicerů na řádek. Další slicery budou umístěny na další řádek.");
    }

    const row1 = state.slicers.slice(0, state.MAX_SLICERS);
    const row2 = state.slicers.slice(
        state.MAX_SLICERS,
        state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS
    );

    state.setWarnings(state.warnings.filter(w => w !== secondRowLimitWarning));
    if (row2.length > state.MAX_SLICERS) {
        addWarning(secondRowLimitWarning);
    }

    if (state.slicers.length > state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS) {
        addWarning("Bylo dosaženo maximálního počtu slicerů.");
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
