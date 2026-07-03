// assets/js/app.js
import { setSelected } from "./ui/selection.js";
import { addWarning, renderWarnings } from "./ui/warnings.js";
import { initState } from "./state/initState.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import { renderLayout } from "./ui/renderLayout.js";
import * as state from "./state/state.js";

const addKpiBtn = document.getElementById("add-kpi");
const addSlicerBtn = document.getElementById("add-slicer");
const templateButtons = document.querySelectorAll(".template-option");
const canvasSizeLabel = document.getElementById("canvas-size-label");
const slicersPerRowSelect = document.getElementById("slicers-per-row");
const kpisPerRowSelect = document.getElementById("kpis-per-row");

// Appends a new slicer at the end of the list (used by the sidebar "Slicer" button).
// Per-item insertion at an arbitrary index is handled separately by handleAddSlicer
// in events/slicerEvents.js, used by the "+" controls on the canvas.
function addSlicer() {
  if (state.slicers.length >= state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    return;
  }

  state.setSlicers([...state.slicers, { width: null, locked: false }]);
  renderLayout();
}

// Appends a new KPI at the end of the list (used by the sidebar "KPI" button).
// Per-item insertion at an arbitrary index is handled separately by handleAddKpi
// in events/kpiEvents.js, used by the "+" controls on the canvas.
function addKPI() {
  if (state.kpis.length >= state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS) {
    addWarning("Bylo dosaženo maximálního počtu KPI.");
    return;
  }

  state.setKpis([...state.kpis, { height: null, locked: false }]);
  renderLayout();
}

addKpiBtn.addEventListener("click", addKPI);
addSlicerBtn.addEventListener("click", addSlicer);

function syncTemplateControls() {
  templateButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.template === state.activeTemplate);
  });

  canvasSizeLabel.textContent = `Power BI plátno ${state.CANVAS_WIDTH} × ${state.CANVAS_HEIGHT}`;
}

function syncRowLimitControls() {
  slicersPerRowSelect.value = String(state.MAX_SLICERS);
  kpisPerRowSelect.value = String(state.MAX_KPIS);
}

function initTemplateControls() {
  templateButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.template === state.activeTemplate) return;

      state.setLayoutTemplate(button.dataset.template);
      state.resetSizingLocks();
      state.setWarnings([]);
      setSelected(null);
      syncTemplateControls();
      renderLayout();
      renderWarnings();
    });
  });
}

function initRowLimitControls() {
  slicersPerRowSelect.addEventListener("change", () => {
    state.setMaxSlicers(slicersPerRowSelect.value);
    state.resetSizingLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });

  kpisPerRowSelect.addEventListener("change", () => {
    state.setMaxKpis(kpisPerRowSelect.value);
    state.resetSizingLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });
}

function debounce(fn, waitMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function start() {
  initState();
  initTemplateControls();
  initRowLimitControls();
  syncTemplateControls();
  syncRowLimitControls();
  renderLayout();
  initResizeEvents();
  setSelected(null);
  window.addEventListener("resize", debounce(renderLayout, 150));
}

window.addEventListener("DOMContentLoaded", start);