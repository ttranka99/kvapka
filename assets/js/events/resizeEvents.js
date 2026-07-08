import * as state from "../state/state.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings, addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { canAddChart } from "../layout/canAddChart.js";
import { setSelected, getPendingWidth, getPendingHeight } from "../ui/selection.js";
import { initState } from "../state/initState.js";
import { refreshSelectedChartAfterResize } from "./chartEvents.js";
import { refreshSelectedSlicerAfterEdit } from "./slicerEvents.js";
import { refreshSelectedKpiAfterEdit } from "./kpiEvents.js";

const resetBtn = document.getElementById("reset-layout");
const applySelectionBtn = document.getElementById("apply-selection");

function isWidthEditable(kind) {
  return kind === "slicer" || kind === "kpi" || kind === "chartRow";
}

function isHeightEditable(kind) {
  return kind === "chartRow";
}

// Applies a new width for the given selected element. Same validation/commit
// rules as before, just parameterized on `info`/`val` instead of reading
// state.selectedElement/inputWidth.value directly, so the single Apply
// button can drive it.
function applyWidthValue(info, val) {
  if (isNaN(val) || val < 50) {
    addWarning("Minimální šířka je 50px.", "error");
    renderWarnings();
    return;
  }

  if (info.kind === "slicer") {
    const s = info.stateRef;
    s.width = val;
    s.locked = true;
    renderLayout();
    return;
  }

  if (info.kind === "kpi") {
    const k = info.stateRef;
    k.width = val;
    k.locked = true;
    renderLayout();
    return;
  }

  if (info.kind === "chartRow") {
    if (val < state.MIN_CHART_WIDTH) {
      addWarning(`Minimální šířka grafu je ${state.MIN_CHART_WIDTH}px.`, "error");
      renderWarnings();
      return;
    }

    const match = /^chart-(\d+)-(\d+)$/.exec(info.domId);
    if (!match) return;
    const rowIndex = Number(match[1]);
    const itemIndex = Number(match[2]);

    const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
    const row = rowsCopy[rowIndex];
    const otherItems = row.items.filter((_, i) => i !== itemIndex);

    if (otherItems.length > 0 && !otherItems.some(item => !item.locked)) {
      addWarning("Nelze upravit šířku grafu — nejprve odemkněte alespoň jeden další graf v řadě.", "error");
      renderWarnings();
      return;
    }

    row.items = row.items.map((item, i) => {
      if (i === itemIndex) return { ...item, width: val, locked: true };
      return item.locked ? item : { ...item, width: null, locked: false };
    });

    const vLayout = computeVerticalLayout();
    if (!canAddChart(rowsCopy, vLayout)) {
      addWarning("Zadaná šířka se nevejde — uprav hodnotu.", "error");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    state.setWarnings([]);
    renderLayout();
  }
}

// Applies a new height for the given selected element. Same validation/commit
// rules as before, parameterized on `info`/`val`.
function applyHeightValue(info, val) {
  if (info.kind === "kpi") {
    if (isNaN(val) || val < state.KPI_MIN_HEIGHT) {
      addWarning(`Minimální výška KPI je ${state.KPI_MIN_HEIGHT}px.`, "error");
      renderWarnings();
      return;
    }

    const k = info.stateRef;
    k.height = val;
    k.locked = true;

    renderLayout();
    return;
  }

  if (info.kind === "chartRow") {
    if (isNaN(val) || val < state.MIN_CHART_ROW_HEIGHT) {
      addWarning(`Minimální výška řady grafů je ${state.MIN_CHART_ROW_HEIGHT}px.`, "error");
      renderWarnings();
      return;
    }

    const otherRows = state.chartRows.filter((_, i) => i !== info.rowIndex);

    if (otherRows.length === 0) {
      addWarning("Nelze upravit výšku — jediná řada grafů vždy vyplňuje celý dostupný prostor.", "error");
      renderWarnings();
      return;
    }

    if (!otherRows.some(r => !r.locked)) {
      addWarning("Nelze upravit výšku řady — nejprve odemkněte alespoň jednu další řadu grafů.", "error");
      renderWarnings();
      return;
    }

    const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
    const row = rowsCopy[info.rowIndex];
    const originalHeight = row.height;
    const originalLocked = row.locked;

    row.height = val;
    row.locked = true;

    const v = computeVerticalLayout();
    state.setWarnings([]);
    const heights = computeChartRowHeights(v);

    const n = rowsCopy.length;
    const totalGaps = (n - 1) * state.GAP_SMALL;
    const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

    const overflow =
      heights.some(h => h < state.MIN_CHART_ROW_HEIGHT) ||
      totalHeight > v.chartsHeight;

    if (overflow) {
      row.height = originalHeight;
      row.locked = originalLocked;
      addWarning("Zadaná výška se nevejde — uprav hodnotu.", "error");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    renderLayout();
  }
}

// Resyncs the selection panel to the element's fresh geometry after an
// Apply attempt, preserving any field that's still pending (e.g. one that
// failed validation) instead of resetting it like a fresh selection would.
function refreshSelectedElementPreservingPending() {
  const info = state.selectedElement;
  if (!info) return;

  if (info.kind === "chartRow") {
    refreshSelectedChartAfterResize(true);
  } else if (info.kind === "slicer") {
    refreshSelectedSlicerAfterEdit(true);
  } else if (info.kind === "kpi") {
    refreshSelectedKpiAfterEdit(true);
  }
}

// Apply — single button, drives whichever of width/height are dirty for the
// current selection.
export function handleApplySelection() {
  const info = state.selectedElement;
  if (!info) return;

  const widthDirty = isWidthEditable(info.kind) && getPendingWidth() !== info.width;
  const heightDirty = isHeightEditable(info.kind) && getPendingHeight() !== info.height;

  if (!widthDirty && !heightDirty) return;

  if (widthDirty) applyWidthValue(info, getPendingWidth());
  if (heightDirty) applyHeightValue(info, getPendingHeight());

  refreshSelectedElementPreservingPending();
}

// Reset layout
export function handleResetLayout() {
  state.setWarnings([]);
  renderWarnings();
  initState();
  renderLayout();
  setSelected(null);
}

// Attach listeners
export function initResizeEvents() {
  applySelectionBtn.addEventListener("click", handleApplySelection);
  resetBtn.addEventListener("click", handleResetLayout);
}
