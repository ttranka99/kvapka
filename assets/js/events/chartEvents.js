import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { canAddChart } from "../layout/canAddChart.js";
import { renderLayout } from "../ui/renderLayout.js";
import { flash, flashAll } from "../ui/motion.js";
import { renderWarnings } from "../ui/warnings.js";
import { t } from "../i18n/i18n.js";

// DOM ids of the locked cards among `itemIndexes`, used to point at what
// blocked a refused action. A row height lock (from Apply) locks every card
// in the row. A stacked cell's chart-r-i id is an invisible anchor
// (renderLayout.js), so its sub-charts are returned instead: the locked
// ones, or all of them if the row is locked.
export function lockedChartCardIds(rowIndex, itemIndexes) {
  const row = state.chartRows[rowIndex];
  if (!row) return [];
  const ids = [];
  itemIndexes.forEach(i => {
    const item = row.items[i];
    if (!item) return;
    if (item.stack && item.stack.length >= 2) {
      item.stack.forEach((s, si) => {
        if (row.locked || s.locked) ids.push(`chart-${rowIndex}-${i}-${si}`);
      });
    } else if (row.locked || item.locked) {
      ids.push(`chart-${rowIndex}-${i}`);
    }
  });
  return ids;
}

function allItemIndexes(rowIndex) {
  return state.chartRows[rowIndex]?.items.map((_, i) => i) ?? [];
}

// Builds the "row is fully locked" warning. A stack's width lock is derived
// (item.locked = some sub-chart is locked, see handleToggleStackLock in
// stackEvents.js), so the column stays locked until every sub-chart is
// unlocked. When a stack is locked, the warning says so.
function buildAllLockedRowWarning(items) {
  const base = t("warnings.chart.allLocked");
  const hasLockedStack = items.some(item => item.locked && item.stack);
  return hasLockedStack
    ? t("warnings.chart.allLockedStackNote", { message: base })
    : base;
}

// Add chart to the left
export function handleAddChartLeft(rowIndex, itemIndex) {
  // Locked charts stay as they are. Unlocked charts, including ones that
  // still hold an old width (see handleToggleChartLock), go back to auto
  // width so they can shrink for the new chart. Only a real add/remove
  // does this, not unlocking.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  // All charts locked: none can shrink. This is a lock problem, not a space
  // problem, so tell the user to unlock something.
  if (simulatedRow.items.length > 0 && simulatedRow.items.every(item => item.locked)) {
    addWarning(buildAllLockedRowWarning(simulatedRow.items), "error");
    flashAll(lockedChartCardIds(rowIndex, allItemIndexes(rowIndex)));
    return;
  }

  simulatedRow.items = simulatedRow.items.map(item =>
    item.locked ? item : { ...item, width: null }
  );

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex, 0, { width: null, locked: false });

  if (!canAddChart(simulated)) {
    addWarning(t("warnings.chart.noSpace"), "error");
    return;
  }

  state.chartRows[rowIndex] = simulatedRow;
  state.setChartRows([...state.chartRows]);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Add chart to the right
export function handleAddChartRight(rowIndex, itemIndex) {
  // Locked charts stay as they are. Unlocked charts, including ones that
  // still hold an old width (see handleToggleChartLock), go back to auto
  // width so they can shrink for the new chart. Only a real add/remove
  // does this, not unlocking.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  // All charts locked: none can shrink. This is a lock problem, not a space
  // problem, so tell the user to unlock something.
  if (simulatedRow.items.length > 0 && simulatedRow.items.every(item => item.locked)) {
    addWarning(buildAllLockedRowWarning(simulatedRow.items), "error");
    flashAll(lockedChartCardIds(rowIndex, allItemIndexes(rowIndex)));
    return;
  }

  simulatedRow.items = simulatedRow.items.map(item =>
    item.locked ? item : { ...item, width: null }
  );

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex + 1, 0, { width: null, locked: false });

  if (!canAddChart(simulated)) {
    addWarning(t("warnings.chart.tooSmall"), "error");
    return;
  }

  state.chartRows[rowIndex] = simulatedRow;
  state.setChartRows([...state.chartRows]);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Add new chart row below
export function handleAddChartRow(rowIndex) {
  const simulated = JSON.parse(JSON.stringify(state.chartRows));

  // Free every row's height lock first. Users can't unlock a row height by
  // hand, and rows get locked by the sidebar height editor or the row-height
  // drag (which locks both rows it touches). Without this, locked rows would
  // keep their share and could block adding rows for good.
  simulated.forEach(row => {
    row.height = null;
    row.locked = false;
  });

  simulated.splice(rowIndex + 1, 0, { height: null, locked: false, items: [{}] });

  if (!canAddChart(simulated)) {
    addWarning(t("warnings.chart.adjustRowHeights"), "error");
    return;
  }

  state.setChartRows(simulated);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Remove chart
export function handleRemoveChart(rowIndex, itemIndex) {
  const newRows = JSON.parse(JSON.stringify(state.chartRows));
  const rowItems = newRows[rowIndex].items;

  if (rowItems.length > 1) {
    const remainingAfterRemoval = rowItems.filter((_, i) => i !== itemIndex);
    const anyUnlockedRemaining = remainingAfterRemoval.some(item => !item.locked);

    // If every remaining chart would be locked, nothing could absorb the
    // freed space and it would stay as a gap. Block the removal instead.
    if (!anyUnlockedRemaining) {
      addWarning(t("warnings.chart.removeUnlockRow"), "error");
      flashAll(lockedChartCardIds(rowIndex, allItemIndexes(rowIndex).filter(i => i !== itemIndex)));
      return;
    }

    // remove the item
    rowItems.splice(itemIndex, 1);
    // Free only unlocked charts so they fill the gap; locked ones keep
    // their width.
    newRows[rowIndex].items = newRows[rowIndex].items.map(item =>
      item.locked ? item : { ...item, width: null, locked: false }
    );
  } else if (newRows.length > 1) {
    // remove the whole row; other rows will recompute their widths
    newRows.splice(rowIndex, 1);

    // Free the remaining rows' height locks too, or the freed vertical
    // space would stay as a blank gap instead of the rows expanding.
    newRows.forEach(row => {
      row.height = null;
      row.locked = false;
    });
  }

  state.setChartRows(newRows);
  // Clear warnings after removal (previous warning may no longer apply)
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Toggles the width lock of one chart. Locking freezes the current width so
// add/remove elsewhere in the row doesn't resize it. The row height lock is
// separate (resizeEvents.js).
// Unlocking keeps the current width. The chart only rejoins the flexible
// pool on the next add/remove in its row (see handleAddChartLeft/Right/Row
// and handleRemoveChart).
// The button is the card's lock mark. It looks engaged if the card's width
// or its row height (from Apply) is locked, and clicking it releases both.
export function handleToggleChartLock(rowIndex, itemIndex) {
  const row = state.chartRows[rowIndex];
  const item = row?.items?.[itemIndex];
  if (!item) return;

  if (item.locked || row.locked) {
    // Keep the width so the chart doesn't jump when unlocked. An add/remove
    // in the row resets the widths (see the handlers above).
    item.locked = false;
    if (row.locked) {
      row.locked = false;
      row.height = null;
    }
  } else {
    const v = computeVerticalLayout();
    const rowsLayout = computeChartsLayout(v);
    const currentWidth = rowsLayout[rowIndex]?.[itemIndex]?.width;
    item.width = currentWidth;
    item.locked = true;
  }

  state.setChartRows([...state.chartRows]);
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
  // Flash on lock only (dashed ring appears); unlocking stays quiet.
  if (item.locked) flash(`chart-${rowIndex}-${itemIndex}`);
}

// Select chart row
export function handleSelectChart(item, rowIndex, domId, heights, opts = {}) {
  setSelected({
    kind: "chartRow",
    labelType: t("selection.kind.chartRow"),
    labelIndex: rowIndex + 1,
    x: item.x,
    y: item.y,
    width: item.width,
    height: heights[rowIndex],
    domId,
    rowIndex
  }, opts);
}

// Re-syncs the selection panel to the selected chart's current geometry
// mid-drag. Resize handlers call it after re-rendering. It uses the selected
// domId, so it works for both width and row-height drags.
export function refreshSelectedChartAfterResize(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "chartRow" || !selected.domId) return;

  const match = /^chart-(\d+)-(\d+)$/.exec(selected.domId);
  if (!match) return;

  const rowIndex = Number(match[1]);
  const itemIndex = Number(match[2]);

  const v = computeVerticalLayout();
  const chartsLayout = computeChartsLayout(v);
  const heights = computeChartRowHeights(v);
  const item = chartsLayout[rowIndex]?.[itemIndex];
  if (!item) return;

  handleSelectChart(item, rowIndex, selected.domId, heights, { preservePending });
}