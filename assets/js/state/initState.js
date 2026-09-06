import * as state from "./state.js";

export function initState() {
    //
    // Default slicers
    //
    const initialSlicers = [
        // width/height = null → computed automatically (width in the
        // horizontal row, height in the vertical column)
        { width: null, height: null, locked: false },
        { width: null, height: null, locked: false },
        { width: null, height: null, locked: false }
    ];

    //
    // Default chart rows
    //
    const initialChartRows = [
        {
            height: null,          // height computed automatically
            locked: false,
            items: [{}, {}]        // two charts in the first row
        }
    ];

    //
    // Default warnings
    //
    const initialWarnings = [];

    //
    // Default canvas scale (visual preview only)
    //
    const initialScale = 0.5;

    //
    // Initialize state
    //
    state.setSlicers(initialSlicers);
    // KPI bands are seeded by applyTheme() (see reconcileKpiBands in
    // state.js), which loadDefaults() in state/tabs.js always calls right
    // before this — so there's nothing left for initState to do for them.
    state.setChartRows(initialChartRows);
    state.setWarnings(initialWarnings);
}

