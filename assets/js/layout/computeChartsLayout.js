import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";

export function computeChartsLayout(v) {
  const heights = computeChartRowHeights(v);
  const rowsLayout = [];
  let currentY = v.chartsTop;

  state.chartRows.forEach((row, rowIndex) => {
    const rowHeight = heights[rowIndex];
    const items = [];
    const n = row.items.length;

    const totalGaps = (n - 1) * state.GAP_SMALL;
    const remainingWidth = state.USABLE_WIDTH - totalGaps;

    const baseWidth = Math.floor(remainingWidth / n);
    let remainder = remainingWidth % n;

    let x = state.MARGIN;

    row.items.forEach((item, i) => {
      let w = baseWidth;
      if (remainder > 0) {
        w += 1;
        remainder--;
      }

      items.push({
        type: "chart",
        rowIndex,
        indexInRow: i,
        x,
        y: currentY,
        width: w,
        height: rowHeight
      });

      x += w + state.GAP_SMALL;
    });

    rowsLayout.push(items);
    currentY += rowHeight + state.GAP_SMALL;
  });

  return rowsLayout;
}
