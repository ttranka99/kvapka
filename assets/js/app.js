// assets/js/app.js
import { setSelected, initSelectionCopyButtons, initSelectionInlineEditing } from "./ui/selection.js";
import { addWarning, renderWarnings } from "./ui/warnings.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import { handleSplitChart } from "./events/stackEvents.js";
import { initExportEvents } from "./export/exportPowerBI.js";
import { renderLayout } from "./ui/renderLayout.js";
import { initTabs } from "./state/tabs.js";
import { initTabsUI } from "./ui/tabs.js";
import * as state from "./state/state.js";

const addKpiBtn = document.getElementById("add-kpi");
const addSlicerBtn = document.getElementById("add-slicer");
const addChartSplitBtn = document.getElementById("add-chart-split");
const templateButtons = document.querySelectorAll(".template-option");
const canvasSizeLabel = document.getElementById("canvas-size-label");
const slicersPerRowSelect = document.getElementById("slicers-per-row");
const kpisPerRowSelect = document.getElementById("kpis-per-row");

// Appends a new slicer at the end of the list (used by the sidebar "Slicer" button).
// Per-item insertion at an arbitrary index is handled separately by handleAddSlicer
// in events/slicerEvents.js, used by the "+" controls on the canvas.
function addSlicer() {
  if (state.slicers.length >= state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.", "error");
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
    addWarning("Bylo dosaženo maximálního počtu KPI.", "error");
    return;
  }

  state.setKpis([...state.kpis, { height: null, locked: false }]);
  renderLayout();
}

addKpiBtn.addEventListener("click", addKPI);
addSlicerBtn.addEventListener("click", addSlicer);

// Splits the currently selected top-level chart into a vertical stack of
// two charts. The button itself is only shown/hidden by setSelected() (see
// updateSplitChartButtonVisibility in ui/selection.js) whenever the
// selection is an unstacked, unlocked chart — so a click here can assume
// state.selectedElement is exactly that.
addChartSplitBtn.addEventListener("click", () => {
  const match = /^chart-(\d+)-(\d+)$/.exec(state.selectedElement?.domId || "");
  if (!match) return;
  handleSplitChart(Number(match[1]), Number(match[2]));
});

// Hovering the split button previews its effect by tinting the chart it
// would act on — the same light-red tint used for the reset/export buttons
// (.split-target-highlight, see style.css) — so the user knows exactly
// which chart is about to be split before clicking. Toggled directly on the
// live DOM node rather than through a re-render, since hovering a sidebar
// button doesn't itself change any state.
addChartSplitBtn.addEventListener("mouseenter", () => {
  const domId = state.selectedElement?.domId;
  const el = domId && document.getElementById(domId);
  if (el) el.classList.add("split-target-highlight");
});
addChartSplitBtn.addEventListener("mouseleave", () => {
  const domId = state.selectedElement?.domId;
  const el = domId && document.getElementById(domId);
  if (el) el.classList.remove("split-target-highlight");
});

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
    // Only slicer widths and chart row heights can actually be invalidated
    // by a slicers-per-row change (it can shift how much vertical space the
    // slicer area takes, and therefore chartsHeight) — chart widths are
    // unaffected since USABLE_WIDTH doesn't change, so their locks are left
    // alone here.
    state.resetSlicerSizingLocks();
    state.resetChartRowHeightLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });

  kpisPerRowSelect.addEventListener("change", () => {
    state.setMaxKpis(kpisPerRowSelect.value);
    // Same reasoning as above, for KPIs.
    state.resetKpiSizingLocks();
    state.resetChartRowHeightLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });
}

function refreshUIFromState() {
  setSelected(null);
  syncTemplateControls();
  syncRowLimitControls();
  renderLayout();
  renderWarnings();
}

function debounce(fn, waitMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function start() {
  initTabs();
  initTabsUI({ refreshUI: refreshUIFromState });
  initTemplateControls();
  initRowLimitControls();
  syncTemplateControls();
  syncRowLimitControls();
  renderLayout();
  initResizeEvents();
  initExportEvents();
  initSelectionCopyButtons();
  initSelectionInlineEditing();
  setSelected(null);
  window.addEventListener("resize", debounce(renderLayout, 150));
}

window.addEventListener("DOMContentLoaded", start);