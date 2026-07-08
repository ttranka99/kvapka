import * as state from "../state/state.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings, addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { canAddChart } from "../layout/canAddChart.js";
import { setSelected } from "../ui/selection.js";
import { initState } from "../state/initState.js";
import { refreshSelectedChartAfterResize } from "./chartEvents.js";

// DOM references
const inputWidth = document.getElementById("input-width");
const inputHeight = document.getElementById("input-height");
const applyWidthBtn = document.getElementById("apply-width");
const applyHeightBtn = document.getElementById("apply-height");
const resetBtn = document.getElementById("reset-layout");

// Apply width
export function handleApplyWidth() {
  if (!state.selectedElement) return;

  const val = parseInt(inputWidth.value, 10);
  if (isNaN(val) || val < 50) {
    addWarning("Minimální šířka je 50px.", "error");
    renderWarnings();
    return;
  }

  if (state.selectedElement.kind === "slicer") {
    const s = state.selectedElement.stateRef;
    s.width = val;
    s.locked = true;
    renderLayout();
    return;
  }

  if (state.selectedElement.kind === "kpi") {
    const k = state.selectedElement.stateRef;
    k.width = val;
    k.locked = true;
    renderLayout();
    return;
  }

  if (state.selectedElement.kind === "chartRow") {
    if (val < state.MIN_CHART_WIDTH) {
      addWarning(`Minimální šířka grafu je ${state.MIN_CHART_WIDTH}px.`, "error");
      renderWarnings();
      return;
    }

    const match = /^chart-(\d+)-(\d+)$/.exec(state.selectedElement.domId);
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
    refreshSelectedChartAfterResize();
    return;
  }
}

// Apply height
export function handleApplyHeight() {
  if (!state.selectedElement) return;

  if (state.selectedElement.kind === "kpi") {
    const val = parseInt(inputHeight.value, 10);
    if (isNaN(val) || val < state.KPI_MIN_HEIGHT) {
      addWarning(`Minimální výška KPI je ${state.KPI_MIN_HEIGHT}px.`, "error");
      renderWarnings();
      return;
    }

    const k = state.selectedElement.stateRef;
    k.height = val;
    k.locked = true;

    renderLayout();
    return;
  }

  if (state.selectedElement.kind === "chartRow") {
    const val = parseInt(inputHeight.value, 10);
    if (isNaN(val) || val < state.MIN_CHART_ROW_HEIGHT) {
      addWarning(`Minimální výška řady grafů je ${state.MIN_CHART_ROW_HEIGHT}px.`, "error");
      renderWarnings();
      return;
    }

    const otherRows = state.chartRows.filter((_, i) => i !== state.selectedElement.rowIndex);

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
    const row = rowsCopy[state.selectedElement.rowIndex];
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
  applyWidthBtn.addEventListener("click", handleApplyWidth);
  applyHeightBtn.addEventListener("click", handleApplyHeight);
  resetBtn.addEventListener("click", handleResetLayout);
}