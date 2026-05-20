import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { canAddChart } from "../layout/canAddChart.js";
import { renderLayout } from "../ui/renderLayout.js";

// Add chart to the left
export function handleAddChartLeft(rowIndex, itemIndex) {
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  simulated[rowIndex].items.splice(itemIndex, 0, {});

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
    return;
  }

  state.setChartRows(simulated);
  renderLayout();
}

// Add chart to the right
export function handleAddChartRight(rowIndex, itemIndex) {
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  simulated[rowIndex].items.splice(itemIndex + 1, 0, {});

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
    return;
  }

  state.setChartRows(simulated);
  renderLayout();
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
  renderLayout();
}

// Remove chart
export function handleRemoveChart(rowIndex, itemIndex) {
  const newRows = JSON.parse(JSON.stringify(state.chartRows));
  const rowItems = newRows[rowIndex].items;

  if (rowItems.length > 1) {
    rowItems.splice(itemIndex, 1);
  } else if (newRows.length > 1) {
    newRows.splice(rowIndex, 1);
  }

  state.setChartRows(newRows);
  renderLayout();
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
