import * as state from "./state.js";

export function initState() {
    //
    // Default slicers
    //
    const initialSlicers = [
        // width = null → width will be computed automatically
        { width: null, locked: false },
        { width: null, locked: false },
        { width: null, locked: false }
    ];

    //
    // Default KPIs
    //
    const initialKpis = [];

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
    state.setKpis(initialKpis);
    state.setChartRows(initialChartRows);
    state.setWarnings(initialWarnings);
}

