// assets/js/app.js
import { computeSlicersLayout } from "./layout/computeSlicersLayout.js";
import { computeVerticalLayout } from "./layout/computeVerticalLayout.js";
import { renderWarnings } from "./ui/warnings.js";
import { computeKpiLayout } from "./layout/computeKpiLayout.js";
import { computeChartRowHeights } from "./layout/computeChartRowHeights.js";
import { computeChartsLayout } from "./layout/computeChartsLayout.js";
import { setSelected } from "./ui/selection.js";
import { initState } from "./state/initState.js";
import { handleAddSlicer, handleRemoveSlicer, handleSelectSlicer } from "./events/slicerEvents.js";
import { handleAddKpi, handleRemoveKpi, handleSelectKpi } from "./events/kpiEvents.js";
import {
  handleAddChartLeft,
  handleAddChartRight,
  handleAddChartRow,
  handleRemoveChart,
  handleSelectChart
} from "./events/chartEvents.js";
import { canAddChart } from "./layout/canAddChart.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import { renderLayout } from "./ui/renderLayout.js";
import * as state from "./state/state.js";

const warningsEl = document.getElementById("warnings");
const noSelectionEl = document.getElementById("no-selection");
const selectionDetailsEl = document.getElementById("selection-details");
const selTypeEl = document.getElementById("sel-type");
const selIndexEl = document.getElementById("sel-index");
const selXEl = document.getElementById("sel-x");
const selYEl = document.getElementById("sel-y");
const selWidthEl = document.getElementById("sel-width");
const selHeightEl = document.getElementById("sel-height");
const editWidthEl = document.getElementById("edit-width");
const editHeightEl = document.getElementById("edit-height");
const inputWidth = document.getElementById("input-width");
const inputHeight = document.getElementById("input-height");
const applyWidthBtn = document.getElementById("apply-width");
const applyHeightBtn = document.getElementById("apply-height");
const resetBtn = document.getElementById("reset-layout");
const addKpiBtn = document.getElementById("add-kpi");
const addSlicerBtn = document.getElementById("add-slicer");

function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
  }
}

function addSlicer() {
  if (state.slicers.length >= state.MAX_SLICERS * 2) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    renderWarnings();
    return;
  }

  state.setSlicers([...state.slicers, { width: null, locked: false }]);
  renderLayout();
  renderWarnings();
}

function addKPI() {
  state.setKpis([...state.kpis, { height: null, locked: false }]);
  renderLayout();
  renderWarnings();
}

addKpiBtn.addEventListener("click", addKPI);
addSlicerBtn.addEventListener("click", addSlicer);

function start() {
  initState();
  renderLayout();
  initResizeEvents();
  setSelected(null);
}

window.addEventListener("DOMContentLoaded", start);