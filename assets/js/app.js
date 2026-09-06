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
import { canAddSlicer, slicerLimitMessage } from "./events/slicerEvents.js";
import { handleAppendKpi } from "./events/kpiEvents.js";
import { initThemePicker, renderThemeSelector, syncRowLimitOptions, defaultThemeLabel } from "./ui/themePicker.js";

const addKpiBtn = document.getElementById("add-kpi");
const addKpiBandsContainer = document.getElementById("add-kpi-bands");
const addSlicerBtn = document.getElementById("add-slicer");
const addChartSplitBtn = document.getElementById("add-chart-split");
const orientationButtons = document.querySelectorAll(".template-option[data-orientation]");
const canvasSizeLabel = document.getElementById("canvas-size-label");
const scopeNote = document.getElementById("theme-scope-note");
const slicersPerRowSelect = document.getElementById("slicers-per-row");
const slicersPerRowField = document.getElementById("slicers-per-row-field");
const kpisPerRowSelect = document.getElementById("kpis-per-row");

// Appends a new slicer at the end of the list (used by the sidebar "Slicer" button).
// Per-item insertion at an arbitrary index is handled separately by handleAddSlicer
// in events/slicerEvents.js, used by the "+" controls on the canvas.
function addSlicer() {
  if (!canAddSlicer()) {
    addWarning(slicerLimitMessage(), "error");
    return;
  }

  state.setSlicers([...state.slicers, { width: null, height: null, locked: false }]);
  renderLayout();
}

addKpiBtn.addEventListener("click", () => handleAppendKpi(state.kpiBandIds()[0]));
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
  renderThemeSelector();
  canvasSizeLabel.textContent = `Power BI plátno ${state.CANVAS_WIDTH} × ${state.CANVAS_HEIGHT}`;
  // Spelling out both halves of the split: what this page uses, and what a
  // brand-new page would start on.
  scopeNote.textContent =
    `Tato stránka: ${state.activeTheme.label} · nové stránky: ${defaultThemeLabel()}`;
}

function syncOrientationControls() {
  orientationButtons.forEach(button => {
    // "Nahoře" carries no data-side and so matches regardless of it; "Vlevo"
    // and "Vpravo" both claim data-orientation="vertical", so telling them
    // apart needs the side too.
    const matchesOrientation = button.dataset.orientation === state.slicerOrientation;
    const matchesSide = !button.dataset.side || button.dataset.side === state.SLICER_SIDE;
    button.classList.toggle("active", matchesOrientation && matchesSide);
  });

  // The vertical column is always a single column, so a per-row limit has
  // nothing to control there — the row animates away via .collapsible rather
  // than popping out of the panel.
  const vertical = state.isVerticalSlicers();
  slicersPerRowField.classList.toggle("expanded", !vertical);
  // A collapsed .collapsible is 0px tall but only overflow-hidden, so its
  // contents stay in the tab order — disabling the select keeps keyboard
  // focus from landing on a control nobody can see.
  slicersPerRowSelect.disabled = vertical;
}

// One "add KPI" button per band beyond the first — the header band's own
// button is the static #add-kpi above. Rebuilt from scratch on every sync
// since the number of bands can change (a theme switch, or a page's own
// section reorder in a later stage), unlike the fixed set of controls
// elsewhere in the sidebar. The first generated button keeps the id
// "add-kpi-band2" so the existing two-band case stays addressable by it.
function syncKpiBandControls() {
  const extraIds = state.kpiBandIds().slice(1);
  addKpiBandsContainer.innerHTML = "";

  extraIds.forEach((id, i) => {
    const btn = document.createElement("button");
    btn.className = "full-btn band2-btn";
    if (i === 0) btn.id = "add-kpi-band2";
    btn.textContent = extraIds.length > 1 ? `KPI – pás ${i + 2}` : "KPI – prostřední pás";
    btn.addEventListener("click", () => handleAppendKpi(id));
    addKpiBandsContainer.appendChild(btn);
  });
}

function syncRowLimitControls() {
  syncRowLimitOptions();
}

function initOrientationControls() {
  orientationButtons.forEach(button => {
    button.addEventListener("click", () => {
      const orientation = button.dataset.orientation;
      // Setting a side implies vertical, but "Nahoře" carries no side of its
      // own — leave whatever side is already set untouched for it, since it
      // only matters again once the user goes back to a vertical column.
      const side = button.dataset.side || state.SLICER_SIDE;
      if (orientation === state.slicerOrientation && side === state.SLICER_SIDE) return;

      state.setSlicerOrientation(orientation);
      state.setSlicerSide(side);
      // Switching orientation or side changes both the width available to
      // the KPIs and charts and the height available to the slicers, so —
      // as with a template switch — every locked size could now be invalid.
      state.resetSizingLocks();
      state.setWarnings([]);
      setSelected(null);
      syncOrientationControls();
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
  syncOrientationControls();
  syncKpiBandControls();
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
  initThemePicker({ refreshUI: refreshUIFromState });
  initOrientationControls();
  initRowLimitControls();
  syncTemplateControls();
  syncOrientationControls();
  syncKpiBandControls();
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
