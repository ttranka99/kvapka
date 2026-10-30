import * as state from "../state/state.js";
import { renderLayout } from "../ui/renderLayout.js";
import { flash, flashAll } from "../ui/motion.js";
import { renderWarnings, addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { canAddChart, chartRowsFit } from "../layout/canAddChart.js";
import { rowEffectiveMinHeight } from "../layout/computeStackHeights.js";
import { snapToStep } from "../layout/sizeStep.js";
import { slicerColumnFits } from "../layout/computeSlicerColumnHeights.js";
import { rowFitsMin, kpiRowsOf } from "../layout/rowFit.js";
import { setSelected, getPendingWidth, getPendingHeight } from "../ui/selection.js";
import { initState } from "../state/initState.js";
import { refreshSelectedChartAfterResize, lockedChartCardIds } from "./chartEvents.js";
import { refreshSelectedSlicerAfterEdit } from "./slicerEvents.js";
import { refreshSelectedKpiAfterEdit } from "./kpiEvents.js";
import { refreshSelectedStackChartAfterEdit } from "./stackEvents.js";
import { t } from "../i18n/i18n.js";

const resetBtn = document.getElementById("reset-layout");
const applySelectionBtn = document.getElementById("apply-selection");

function isWidthEditable(kind) {
  if (kind === "slicer") return !state.isVerticalSlicers();
  return kind === "kpi" || kind === "chartRow";
}

// A slicer's height is its own in a vertical column and the band's shared
// height in a horizontal row. A KPI's is always its band's.
function isHeightEditable(kind) {
  return kind === "slicer" || kind === "kpi" || kind === "chartRow" || kind === "stackChart";
}

// Validates and applies a new width for the selected element `info`.
function applyWidthValue(info, val) {
  // Typed values land on the same 5px grid the layout solvers use.
  if (!isNaN(val)) val = snapToStep(val);

  // Chart rows check their own MIN_CHART_WIDTH below.
  const minWidth = info.kind === "slicer" ? state.MIN_SLICER_WIDTH
    : info.kind === "kpi" ? state.MIN_KPI_WIDTH
    : 50;
  if (isNaN(val) || val < minWidth) {
    addWarning(t("warnings.size.minWidth", { min: minWidth }), "error");
    renderWarnings();
    return;
  }

  if (info.kind === "slicer") {
    // Vertical slicers share the column width (see isWidthEditable).
    if (state.isVerticalSlicers()) return;

    const s = info.stateRef;
    const originalWidth = s.width;
    const originalLocked = s.locked;
    s.width = val;
    s.locked = true;

    // The rest of the row must still get its minimum width (rows split as in
    // computeSlicersLayout.js).
    const i = state.slicers.indexOf(s);
    const row = i < state.MAX_SLICERS
      ? state.slicers.slice(0, state.MAX_SLICERS)
      : state.slicers.slice(state.MAX_SLICERS, state.MAX_SLICERS + state.SECOND_ROW_MAX_ITEMS);

    if (!rowFitsMin(row, state.MIN_SLICER_WIDTH, state.USABLE_WIDTH)) {
      s.width = originalWidth;
      s.locked = originalLocked;
      addWarning(t("warnings.size.widthNoFit"), "error");
      renderWarnings();
      return;
    }

    renderLayout();
    return;
  }

  if (info.kind === "kpi") {
    const k = info.stateRef;
    const originalWidth = k.width;
    const originalLocked = k.locked;
    k.width = val;
    k.locked = true;

    // A row that doesn't fit renders nothing, so reject the value instead.
    const row = kpiRowsOf(info.bandId).find(r => r.includes(k)) ?? [k];
    if (!rowFitsMin(row, state.MIN_KPI_WIDTH, computeVerticalLayout().contentWidth)) {
      k.width = originalWidth;
      k.locked = originalLocked;
      addWarning(t("warnings.size.widthNoFit"), "error");
      renderWarnings();
      return;
    }

    renderLayout();
    return;
  }

  if (info.kind === "chartRow") {
    if (val < state.MIN_CHART_WIDTH) {
      addWarning(t("warnings.chart.minWidth", { min: state.MIN_CHART_WIDTH }), "error");
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
      addWarning(t("warnings.chart.widthUnlockRow"), "error");
      renderWarnings();
      flashAll(lockedChartCardIds(rowIndex, row.items.map((_, i) => i).filter(i => i !== itemIndex)));
      return;
    }

    row.items = row.items.map((item, i) => {
      if (i === itemIndex) return { ...item, width: val, locked: true };
      return item.locked ? item : { ...item, width: null, locked: false };
    });

    if (!canAddChart(rowsCopy)) {
      addWarning(t("warnings.size.widthNoFit"), "error");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    state.setWarnings([]);
    renderLayout();
  }
}

// Validates and applies a new height for the selected element `info`.
function applyHeightValue(info, val) {
  if (!isNaN(val)) val = snapToStep(val);

  if (info.kind === "slicer") {
    if (isNaN(val) || val < state.SLICER_HEIGHT) {
      addWarning(t("warnings.slicer.minHeight", { min: state.SLICER_HEIGHT }), "error");
      renderWarnings();
      return;
    }

    // Horizontal: every slicer in the band shares the height, and a taller
    // band takes it from the charts below, so they must still fit.
    if (!state.isVerticalSlicers()) {
      const originalRowHeight = state.SLICER_ROW_HEIGHT;
      state.setSlicerRowHeight(val);
      if (val > originalRowHeight && !chartRowsFit()) {
        state.setSlicerRowHeight(originalRowHeight);
        addWarning(t("warnings.slicer.rowHeightNoFit"), "error");
        renderWarnings();
        return;
      }
      renderLayout();
      return;
    }

    // The other slicers share the remaining height, so this only holds if
    // they all still meet their minimum.
    const s = info.stateRef;
    const originalHeight = s.height;
    const originalLocked = s.locked;
    s.height = val;
    s.locked = true;

    const v = computeVerticalLayout();
    if (!slicerColumnFits(state.slicers, v.slicerColumnHeight)) {
      s.height = originalHeight;
      s.locked = originalLocked;
      addWarning(t("warnings.slicer.heightNoFit"), "error");
      renderWarnings();
      return;
    }

    renderLayout();
    return;
  }

  if (info.kind === "kpi") {
    if (isNaN(val) || val < state.KPI_MIN_HEIGHT) {
      addWarning(t("warnings.kpi.minHeight", { min: state.KPI_MIN_HEIGHT }), "error");
      renderWarnings();
      return;
    }

    // Every card in the band shares the height, and a taller band takes it
    // from the charts, so they must still fit (as for the slicer band).
    const originalHeight = state.kpiBandHeight(info.bandId);
    state.setKpiBandHeight(info.bandId, val);
    if (val > originalHeight && !chartRowsFit()) {
      state.setKpiBandHeight(info.bandId, originalHeight);
      addWarning(t("warnings.kpi.bandHeightNoFit"), "error");
      renderWarnings();
      return;
    }

    renderLayout();
    return;
  }

  if (info.kind === "stackChart") {
    if (isNaN(val) || val < state.MIN_CHART_ROW_HEIGHT) {
      addWarning(t("warnings.chart.stackMinHeight", { min: state.MIN_CHART_ROW_HEIGHT }), "error");
      renderWarnings();
      return;
    }

    const { rowIndex, itemIndex, stackIndex } = info;
    const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
    const stack = rowsCopy[rowIndex]?.items?.[itemIndex]?.stack;
    if (!stack) return;

    const otherEntries = stack.filter((_, i) => i !== stackIndex);
    if (!otherEntries.some(s => !s.locked)) {
      addWarning(t("warnings.chart.heightUnlockStack"), "error");
      renderWarnings();
      flashAll(stack.map((_, s) => `chart-${rowIndex}-${itemIndex}-${s}`).filter((_, s) => s !== stackIndex));
      return;
    }

    stack[stackIndex] = { height: val, locked: true };
    stack.forEach((s, i) => {
      if (i !== stackIndex && !s.locked) s.height = null;
    });

    const v = computeVerticalLayout();
    const heights = computeChartRowHeights(v);
    const rowHeight = heights[rowIndex];

    const lockedSum = stack.filter(s => s.locked).reduce((sum, s) => sum + s.height, 0);
    const unlockedCount = stack.filter(s => !s.locked).length;
    const gaps = (stack.length - 1) * state.GAP_SMALL;
    const needed = lockedSum + unlockedCount * state.MIN_CHART_ROW_HEIGHT + gaps;

    if (needed > rowHeight) {
      addWarning(t("warnings.chart.heightNoFitRow"), "error");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    state.setWarnings([]);
    renderLayout();
    return;
  }

  if (info.kind === "chartRow") {
    const rowMin = rowEffectiveMinHeight(state.chartRows[info.rowIndex]);
    if (isNaN(val) || val < rowMin) {
      const msg = rowMin > state.MIN_CHART_ROW_HEIGHT
        ? t("warnings.chart.rowMinHeightStack", { min: rowMin })
        : t("warnings.chart.rowMinHeight", { min: rowMin });
      addWarning(msg, "error");
      renderWarnings();
      return;
    }

    const otherRows = state.chartRows.filter((_, i) => i !== info.rowIndex);

    if (otherRows.length === 0) {
      addWarning(t("warnings.chart.singleRow"), "error");
      renderWarnings();
      return;
    }

    if (!otherRows.some(r => !r.locked)) {
      addWarning(t("warnings.chart.rowUnlockOther"), "error");
      renderWarnings();
      state.chartRows.forEach((r, ri) => {
        if (ri !== info.rowIndex) flashAll(lockedChartCardIds(ri, r.items.map((_, i) => i)));
      });
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
    const totalGaps = (v.chartRowGapCount ?? n - 1) * state.GAP_SMALL;
    const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

    const overflow =
      heights.some((h, i) => h < rowEffectiveMinHeight(state.chartRows[i])) ||
      totalHeight > v.chartsHeight;

    if (overflow) {
      row.height = originalHeight;
      row.locked = originalLocked;
      addWarning(t("warnings.size.heightNoFit"), "error");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    renderLayout();
  }
}

// Resyncs the selection panel after an Apply attempt. Fields still pending
// (e.g. one that failed validation) are kept, unlike on a fresh selection.
function refreshSelectedElementPreservingPending() {
  const info = state.selectedElement;
  if (!info) return;

  if (info.kind === "chartRow") {
    refreshSelectedChartAfterResize(true);
  } else if (info.kind === "slicer") {
    refreshSelectedSlicerAfterEdit(true);
  } else if (info.kind === "kpi") {
    refreshSelectedKpiAfterEdit(true);
  } else if (info.kind === "stackChart") {
    refreshSelectedStackChartAfterEdit(true);
  }
}

// Apply: one button that applies whichever of width/height changed.
export function handleApplySelection() {
  const info = state.selectedElement;
  if (!info) return;

  const widthDirty = isWidthEditable(info.kind) && getPendingWidth() !== info.width;
  const heightDirty = isHeightEditable(info.kind) && getPendingHeight() !== info.height;

  if (!widthDirty && !heightDirty) return;

  if (widthDirty) applyWidthValue(info, getPendingWidth());
  if (heightDirty) applyHeightValue(info, getPendingHeight());

  refreshSelectedElementPreservingPending();
  // Only if a value landed (a rejected one warns instead): the card is now
  // locked to it.
  const now = state.selectedElement;
  if (now && (now.width !== info.width || now.height !== info.height)) flash(info.domId);
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
