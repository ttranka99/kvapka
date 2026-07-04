import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { canAddChart } from "../layout/canAddChart.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings } from "../ui/warnings.js";

// Add chart to the left
export function handleAddChartLeft(rowIndex, itemIndex) {
  // Simulate: keep existing width-locked charts as-is; only the newly
  // inserted chart starts unlocked. Unlocked charts (including the new one)
  // redistribute the space left over after locked charts' widths are
  // subtracted — see computeChartsLayout.js / canAddChart.js.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex, 0, { width: null, locked: false });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nedostatek prostoru pro přidání grafu");
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
  // Simulate: keep existing width-locked charts as-is; only the newly
  // inserted chart starts unlocked. Unlocked charts (including the new one)
  // redistribute the space left over after locked charts' widths are
  // subtracted — see computeChartsLayout.js / canAddChart.js.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex + 1, 0, { width: null, locked: false });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat graf — všechny grafy by byly příliš malé.");
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
  simulated.splice(rowIndex + 1, 0, { height: null, locked: false, items: [{}] });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
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
    // remove the item
    rowItems.splice(itemIndex, 1);
    // Unlock all remaining charts in this row so they redistribute evenly
    newRows[rowIndex].items = newRows[rowIndex].items.map(item => ({
      ...item,
      width: null,
      locked: false
    }));
  } else if (newRows.length > 1) {
    // remove the whole row; other rows will recompute their widths
    newRows.splice(rowIndex, 1);
  }

  state.setChartRows(newRows);
  // Clear warnings after removal (previous warning may no longer apply)
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Toggle width-lock for a single chart. Locking freezes the chart's current
// computed width so it's excluded from auto-redistribution when charts are
// added/removed elsewhere in the row. This is independent of the chart row's
// height lock (a separate, row-level concern handled in resizeEvents.js).
// Unlocking clears the width back to auto so it resumes resizing with the row.
export function handleToggleChartLock(rowIndex, itemIndex) {
  const row = state.chartRows[rowIndex];
  const item = row?.items?.[itemIndex];
  if (!item) return;

  if (item.locked) {
    item.width = null;
    item.locked = false;
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
}

// Select chart row
export function handleSelectChart(item, rowIndex, domId, heights) {
  setSelected({
    kind: "chartRow",
    labelType: "Řada grafů",
    labelIndex: rowIndex + 1,
    x: item.x,
    y: item.y,
    width: item.width,
    height: heights[rowIndex],
    domId,
    rowIndex
  });
}