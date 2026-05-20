import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";

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

  return true;
}
