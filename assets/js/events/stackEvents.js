// assets/js/events/stackEvents.js
//
// Vertical chart stacking: an unlocked, unstacked chart cell can be split
// into a vertical stack (one level only, sub-charts can't be split again).
// Sub-charts share the cell's width, have their own heights, are added or
// removed with +/-, and can be height-locked one by one. The row's height
// still bounds them (see rowEffectiveMinHeight in computeStackHeights.js).
import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { stackMinHeight } from "../layout/computeStackHeights.js";
import { renderLayout } from "../ui/renderLayout.js";
import { flash, flashAll } from "../ui/motion.js";
import { renderWarnings } from "../ui/warnings.js";
import { t } from "../i18n/i18n.js";

// Row heights for a simulated `rows`. computeChartRowHeights reads the live
// state.chartRows, so `rows` is swapped in temporarily (as in canAddChart.js).
function computeHeightsForRows(rows, v) {
  const original = state.chartRows;
  state.setChartRows(rows);
  const heights = computeChartRowHeights(v);
  state.setChartRows(original);
  return heights;
}

// Whether the sidebar "Graf" split button is offered: only for a chart cell
// that isn't a stack and isn't width-locked, since splitting is a structural
// change that should start from a flexible cell.
export function canSplitChart(rowIndex, itemIndex) {
  const item = state.chartRows[rowIndex]?.items?.[itemIndex];
  return !!item && !item.stack && !item.locked;
}

export function handleSplitChart(rowIndex, itemIndex) {
  const row = state.chartRows[rowIndex];
  const item = row?.items?.[itemIndex];
  if (!item || item.stack || item.locked) return;

  const v = computeVerticalLayout();
  const heights = computeChartRowHeights(v);
  const rowHeight = heights[rowIndex];
  const minNeeded = stackMinHeight(2);

  if (rowHeight < minNeeded) {
    addWarning(t("warnings.chart.splitTooLow", { min: minNeeded }), "error");
    renderWarnings();
    return;
  }

  item.stack = [{ height: null, locked: false }, { height: null, locked: false }];

  state.setChartRows([...state.chartRows]);
  state.setWarnings([]);
  renderLayout();
  renderWarnings();

  handleSelectStackChart(rowIndex, itemIndex, 0, `chart-${rowIndex}-${itemIndex}-0`);
}

export function handleAddStackChart(rowIndex, itemIndex, stackIndex) {
  const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
  const stack = rowsCopy[rowIndex]?.items?.[itemIndex]?.stack;
  if (!stack) return;

  // Use the row's current height (before this add), not the simulated one.
  // An unlocked row floors at rowEffectiveMinHeight(row), which already
  // includes the new sub-chart, so the simulated height would grow to match
  // "needed" and the check below could never fail.
  const v = computeVerticalLayout();
  const currentRowHeight = computeChartRowHeights(v)[rowIndex];

  const allExistingLocked = stack.length > 0 && stack.every(s => s.locked);
  const existingIds = stack.map((_, s) => `chart-${rowIndex}-${itemIndex}-${s}`);

  stack.splice(stackIndex + 1, 0, { height: null, locked: false });
  stack.forEach(s => {
    if (!s.locked) s.height = null;
  });

  const lockedSum = stack.filter(s => s.locked).reduce((sum, s) => sum + s.height, 0);
  const unlockedCount = stack.filter(s => !s.locked).length;
  const gaps = (stack.length - 1) * state.GAP_SMALL;
  const needed = lockedSum + unlockedCount * state.MIN_CHART_ROW_HEIGHT + gaps;

  const heights = computeHeightsForRows(rowsCopy, v);
  const n = rowsCopy.length;
  const totalGaps = (v.chartRowGapCount ?? n - 1) * state.GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (needed > currentRowHeight || totalHeight > v.chartsHeight) {
    // If all existing sub-charts are locked, the locks are the blocker, so
    // say that instead of "too small".
    addWarning(
      allExistingLocked
        ? t("warnings.chart.stackAllLocked")
        : t("warnings.chart.stackTooSmall"),
      "error"
    );
    renderWarnings();
    if (allExistingLocked) flashAll(existingIds);
    return;
  }

  state.setChartRows(rowsCopy);
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

export function handleRemoveStackChart(rowIndex, itemIndex, stackIndex) {
  const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
  const item = rowsCopy[rowIndex]?.items?.[itemIndex];
  const stack = item?.stack;
  const target = stack?.[stackIndex];
  if (!target) return;

  if (target.locked) {
    addWarning(t("warnings.chart.removeLocked"), "error");
    renderWarnings();
    flash(`chart-${rowIndex}-${itemIndex}-${stackIndex}`);
    return;
  }

  const remaining = stack.filter((_, i) => i !== stackIndex);
  if (!remaining.some(s => !s.locked)) {
    addWarning(t("warnings.chart.removeUnlockStack"), "error");
    renderWarnings();
    flashAll(stack.map((_, s) => `chart-${rowIndex}-${itemIndex}-${s}`).filter((_, s) => s !== stackIndex));
    return;
  }

  stack.splice(stackIndex, 1);
  stack.forEach(s => {
    if (!s.locked) s.height = null;
  });

  // The cell's width lock is derived: locked while any sub-chart is.
  item.locked = stack.some(s => s.locked);

  // A single remaining chart is a normal cell again. It is always unlocked
  // here (the checks above refuse the removal otherwise).
  if (stack.length === 1) {
    delete item.stack;
  }

  state.setChartRows(rowsCopy);
  state.setWarnings([]);
  renderLayout();

  // After the splice the selected index may point at another chart or none,
  // so clear the selection.
  const selected = state.selectedElement;
  if (selected?.kind === "stackChart" && selected.rowIndex === rowIndex && selected.itemIndex === itemIndex) {
    setSelected(null);
  }

  renderWarnings();
}

// Toggles the height lock of one sub-chart. Locking freezes its current
// height. Unlocking keeps the height until an add/remove or a row-height
// change redistributes it. Mirrors handleToggleChartLock in chartEvents.js.
//
// The cell's width lock (item.locked) is derived, since a stacked cell has no
// width-lock control: the column is locked while any sub-chart is, and freed
// only when all are unlocked.
export function handleToggleStackLock(rowIndex, itemIndex, stackIndex) {
  const item = state.chartRows[rowIndex]?.items?.[itemIndex];
  const entry = item?.stack?.[stackIndex];
  if (!entry) return;

  if (entry.locked) {
    entry.locked = false;
  } else {
    const v = computeVerticalLayout();
    const chartsLayout = computeChartsLayout(v);
    const currentHeight = chartsLayout[rowIndex]?.[itemIndex]?.subCharts?.[stackIndex]?.height;
    entry.height = currentHeight;
    entry.locked = true;
  }

  const anyLocked = item.stack.some(s => s.locked);
  if (anyLocked && !item.locked) {
    const v = computeVerticalLayout();
    const rowsLayout = computeChartsLayout(v);
    item.width = rowsLayout[rowIndex]?.[itemIndex]?.width;
    item.locked = true;
  } else if (!anyLocked && item.locked) {
    item.locked = false;
  }

  state.setChartRows([...state.chartRows]);
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
  if (entry.locked) flash(`chart-${rowIndex}-${itemIndex}-${stackIndex}`);   // locking only; unlocking is quiet
}

export function handleSelectStackChart(rowIndex, itemIndex, stackIndex, domId, opts = {}) {
  const v = computeVerticalLayout();
  const chartsLayout = computeChartsLayout(v);
  const sub = chartsLayout[rowIndex]?.[itemIndex]?.subCharts?.[stackIndex];
  if (!sub) return;

  setSelected({
    kind: "stackChart",
    labelType: t("selection.kind.stackChart"),
    labelIndex: `${rowIndex + 1}.${itemIndex + 1}.${stackIndex + 1}`,
    x: sub.x,
    y: sub.y,
    width: sub.width,
    height: sub.height,
    domId,
    rowIndex,
    itemIndex,
    stackIndex
  }, opts);
}

// Re-syncs the selection panel to the selected sub-chart mid-drag or after
// Apply. Stack counterpart of refreshSelectedChartAfterResize (chartEvents.js).
export function refreshSelectedStackChartAfterEdit(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "stackChart" || !selected.domId) return;

  const { rowIndex, itemIndex, stackIndex, domId } = selected;
  handleSelectStackChart(rowIndex, itemIndex, stackIndex, domId, { preservePending });
}
