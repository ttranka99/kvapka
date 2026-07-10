// assets/js/events/stackEvents.js
//
// Vertical chart stacking: an unlocked, unstacked top-level chart cell can be
// split into a vertical stack of charts (one nesting level only — the
// sub-charts themselves can never be split again). Sub-charts share the
// cell's width but each get their own height, get/lose entries via +/-, and
// can be individually height-locked. All of it stays bound by the row's own
// height (see computeStackHeights.js's rowEffectiveMinHeight, consumed by
// computeChartRowHeights/canAddChart/row-height dragging/inline editing).
import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { stackMinHeight } from "../layout/computeStackHeights.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings } from "../ui/warnings.js";

// Computes row heights against a simulated set of chartRows rather than live
// state, mirroring the same swap-in/swap-out trick canAddChart.js uses —
// computeChartRowHeights always reads the live module-level state.chartRows,
// so a not-yet-committed change has to be staged there temporarily to see
// what its row heights *would* be.
function computeHeightsForRows(rows, v) {
  const original = state.chartRows;
  state.setChartRows(rows);
  const heights = computeChartRowHeights(v);
  state.setChartRows(original);
  return heights;
}

// Whether the sidebar "Graf" split button should be offered for the current
// selection: only for a top-level chart cell that isn't already a stack and
// isn't width-locked (a locked cell's width can't shrink to make room for
// the split visually distinguishing two charts, and more importantly
// splitting is a structural change that should start from a flexible cell).
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
    addWarning(`Nelze rozdělit graf, řada je příliš nízká (min. ${minNeeded}px).`, "error");
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

  // The row's *current* height (before this add is staged) is what the new
  // sub-chart actually has to fit into. Computing it from the *simulated*
  // rows instead (as handleAddStackChart used to) is wrong: an unlocked
  // row's height auto-floors at rowEffectiveMinHeight(row), which already
  // accounts for the just-added sub-chart, so "rowHeight" would silently
  // grow to match "needed" and this check could never fire — the row would
  // just overflow instead of the add being rejected. A row-height-locked row
  // doesn't have this problem (its height is fixed regardless), but reading
  // the *current* height is correct for both cases either way.
  const v = computeVerticalLayout();
  const currentRowHeight = computeChartRowHeights(v)[rowIndex];

  const allExistingLocked = stack.length > 0 && stack.every(s => s.locked);

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
  const totalGaps = (n - 1) * state.GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (needed > currentRowHeight || totalHeight > v.chartsHeight) {
    // When every existing sub-chart is locked, nothing can shrink to make
    // room — the real blocker is the locks, so say that instead of
    // claiming the charts would be too small.
    addWarning(
      allExistingLocked
        ? "Nelze přidat graf, všechny grafy ve sloupci jsou uzamčené. Nejprve odemkněte alespoň jeden graf."
        : "Nelze přidat graf, grafy ve sloupci by byly příliš malé.",
      "error"
    );
    renderWarnings();
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
    addWarning("Nelze odebrat zamčený graf, nejprve jej odemkněte.", "error");
    renderWarnings();
    return;
  }

  const remaining = stack.filter((_, i) => i !== stackIndex);
  if (!remaining.some(s => !s.locked)) {
    addWarning("Nelze odebrat graf, nejprve odemkněte alespoň jeden graf ve sloupci.", "error");
    renderWarnings();
    return;
  }

  stack.splice(stackIndex, 1);
  stack.forEach(s => {
    if (!s.locked) s.height = null;
  });

  // Re-sync the cell's derived width lock now that a sub-chart is gone —
  // it's only locked while at least one remaining sub-chart still is.
  item.locked = stack.some(s => s.locked);

  // A stack that's down to a single chart is no longer a stack — it reverts
  // to a normal chart cell (plain width/lock controls, no stack controls).
  // The remaining entry is guaranteed unlocked here (the checks above refuse
  // removal otherwise), so the cell reverts fully unlocked too.
  if (stack.length === 1) {
    delete item.stack;
  }

  state.setChartRows(rowsCopy);
  state.setWarnings([]);
  renderLayout();

  // The selected sub-chart's index may now point at a different chart (or
  // nothing at all) after the splice — clear the selection rather than risk
  // showing stale/mismatched geometry for this cell.
  const selected = state.selectedElement;
  if (selected?.kind === "stackChart" && selected.rowIndex === rowIndex && selected.itemIndex === itemIndex) {
    setSelected(null);
  }

  renderWarnings();
}

// Toggle height-lock for a single sub-chart. Locking freezes its current
// computed height so it's excluded from auto-redistribution; unlocking keeps
// the current height in place (no visible jump) until a structural change
// (add/remove) or a row-height change redistributes it — mirrors
// handleToggleChartLock's width-lock semantics in chartEvents.js.
//
// The cell's own width lock (item.locked) is *derived* from its sub-charts
// rather than toggled directly, since a stacked cell has no width-lock
// control of its own: the column is width-locked while any sub-chart is
// locked, and only unlocking every sub-chart frees the column's width again.
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
}

export function handleSelectStackChart(rowIndex, itemIndex, stackIndex, domId, opts = {}) {
  const v = computeVerticalLayout();
  const chartsLayout = computeChartsLayout(v);
  const sub = chartsLayout[rowIndex]?.[itemIndex]?.subCharts?.[stackIndex];
  if (!sub) return;

  setSelected({
    kind: "stackChart",
    labelType: "Graf (sloupec)",
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

// Re-syncs the selection panel to a sub-chart's current geometry mid-drag or
// after an Apply attempt — the stack counterpart of
// refreshSelectedChartAfterResize in chartEvents.js.
export function refreshSelectedStackChartAfterEdit(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "stackChart" || !selected.domId) return;

  const { rowIndex, itemIndex, stackIndex, domId } = selected;
  handleSelectStackChart(rowIndex, itemIndex, stackIndex, domId, { preservePending });
}
