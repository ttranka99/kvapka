import * as state from "../state/state.js";
import { computeVerticalLayout } from "./computeVerticalLayout.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";
import { rowEffectiveMinHeight } from "./computeStackHeights.js";

// Whether `simulatedChartRows` would fit the canvas. `chartsHeight` depends on
// the row count (chart groups split the vertical budget differently per
// count), so it can't be reused from the real rows. The state swap therefore
// also covers computeVerticalLayout(), and this computes its own `v`.
export function canAddChart(simulatedChartRows) {
  const original = state.chartRows;
  state.setChartRows(simulatedChartRows);

  state.setWarnings([]);
  const vLayout = computeVerticalLayout();
  const heights = computeChartRowHeights(vLayout);

  state.setChartRows(original);

  const n = simulatedChartRows.length;
  const totalGaps = (vLayout.chartRowGapCount ?? n - 1) * state.GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (heights.some((h, i) => h < rowEffectiveMinHeight(simulatedChartRows[i]))) return false;
  if (totalHeight > vLayout.chartsHeight) return false;

  // Each row must fit the content box (narrower than USABLE_WIDTH when the
  // slicer column is on the left).
  for (const row of simulatedChartRows) {
    const itemCount = row.items.length;
    const gapsInRow = (itemCount - 1) * state.GAP_SMALL;

    // Mirrors computeChartsLayout.js: any chart with a stored width is fixed,
    // locked or not. An unlocked chart keeps its width (see
    // handleToggleChartLock in chartEvents.js), so it can't shrink to
    // MIN_CHART_WIDTH.
    const lockedSum = row.items
      .filter(item => Number.isFinite(item.width))
      .reduce((sum, item) => sum + item.width, 0);
    const unlockedCount = itemCount - row.items.filter(item => Number.isFinite(item.width)).length;

    const minWidthNeeded = lockedSum + unlockedCount * state.MIN_CHART_WIDTH + gapsInRow;
    if (minWidthNeeded > vLayout.contentWidth) {
      return false;
    }
  }

  return true;
}