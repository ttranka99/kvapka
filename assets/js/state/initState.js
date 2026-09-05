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
    // The middle band starts with the count the theme suggests, so enabling
    // it in the editor shows something on the canvas straight away rather
    // than an invisible reserved strip.
    state.setKpis2(
        state.hasKpiBand2()
            ? Array.from({ length: state.KPI_BAND_2.defaultCount }, () => ({ height: null, locked: false }))
            : []
    );
    state.setChartRows(initialChartRows);
    state.setWarnings(initialWarnings);
}

