import * as state from "../state/state.js";
import { computeVerticalLayout } from "./computeVerticalLayout.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";
import { rowEffectiveMinHeight } from "./computeStackHeights.js";

// Whether `simulatedChartRows` would fit the canvas. Since chart groups can
// now carve up the vertical budget differently depending on how many rows
// exist (a fixed-count group ahead of the open-ended one absorbs a
// different remainder), `chartsHeight` itself depends on the row count —
// unlike the old single-block layout, it can no longer be solved once from
// the real rows and reused for a simulated count. So the swap-in/swap-out
// window now covers computeVerticalLayout() too, and this computes its own
// `v` for the simulated rows rather than taking one from the caller.
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

  // Check horizontal: each row must fit within the content box (narrower
  // than USABLE_WIDTH when the slicer column is on the left)
  for (const row of simulatedChartRows) {
    const itemCount = row.items.length;
    const gapsInRow = (itemCount - 1) * state.GAP_SMALL;

    // Mirrors computeChartsLayout.js: any chart with a stored width is
    // treated as fixed/reserved space, whether or not it's still "locked" —
    // an unlocked-but-still-sized chart (see handleToggleChartLock in
    // chartEvents.js) keeps its width until an actual add/remove nulls it
    // out, so it can't be assumed to shrink down to MIN_CHART_WIDTH like a
    // truly free chart can.
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