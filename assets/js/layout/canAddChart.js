import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";

const MIN_CHART_WIDTH = 150;

export function canAddChart(simulatedChartRows, vLayout) {
  const original = state.chartRows;
  state.setChartRows(simulatedChartRows);

  state.setWarnings([]);
  const heights = computeChartRowHeights(vLayout);

  state.setChartRows(original);

  const n = simulatedChartRows.length;
  const totalGaps = (n - 1) * state.GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (heights.some(h => h < state.MIN_CHART_ROW_HEIGHT)) return false;
  if (totalHeight > vLayout.chartsHeight) return false;

  // Check horizontal: each row must fit within USABLE_WIDTH
  for (const row of simulatedChartRows) {
    const itemCount = row.items.length;
    const gapsInRow = (itemCount - 1) * state.GAP_SMALL;
    const lockedSum = row.items
      .filter(item => item.locked && Number.isFinite(item.width))
      .reduce((sum, item) => sum + item.width, 0);
    const unlockedCount = itemCount - row.items.filter(item => item.locked).length;

    const minWidthNeeded = lockedSum + unlockedCount * MIN_CHART_WIDTH + gapsInRow;
    if (minWidthNeeded > state.USABLE_WIDTH) {
      return false;
    }
  }

  return true;
}
