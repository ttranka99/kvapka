import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { canAddChart } from "../layout/canAddChart.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings } from "../ui/warnings.js";

// Add chart to the left
export function handleAddChartLeft(rowIndex, itemIndex) {
  // Simulate: unlock all charts, insert new chart
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];
  
  // Unlock all items in this row so they redistribute
  simulatedRow.items = simulatedRow.items.map(item => ({ ...item, width: null, locked: false }));
  
  // Insert new chart
  simulatedRow.items.splice(itemIndex, 0, {});
  
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
  // Simulate: unlock all charts, insert new chart
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];
  
  // Unlock all items in this row so they redistribute
  simulatedRow.items = simulatedRow.items.map(item => ({ ...item, width: null, locked: false }));
  
  // Insert new chart
  simulatedRow.items.splice(itemIndex + 1, 0, {});
  
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
