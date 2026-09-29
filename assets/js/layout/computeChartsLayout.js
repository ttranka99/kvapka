import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";
import { computeStackHeights } from "./computeStackHeights.js";
import { distributeInSteps } from "./sizeStep.js";

export function computeChartsLayout(v) {
  const heights = computeChartRowHeights(v);
  const rowsLayout = [];

  state.chartRows.forEach((row, rowIndex) => {
    const rowHeight = heights[rowIndex];
    const y = v.rowTops[rowIndex];
    const items = [];
    const n = row.items.length;

    const totalGaps = (n - 1) * state.GAP_SMALL;
    const availableWidth = v.contentWidth - totalGaps;

    // A stored width means the chart stays fixed, locked or not. Unlocking
    // keeps the width so the chart doesn't jump (see handleToggleChartLock in
    // chartEvents.js). Only an add/remove nulls a row's widths.
    const fixedWidths = row.items.map(item => {
      return Number.isFinite(item.width) ? item.width : null;
    });

    const lockedCount = fixedWidths.filter(w => w !== null).length;
    const unlockedCount = n - lockedCount;
    const lockedSum = fixedWidths.reduce((sum, w) => sum + (w || 0), 0);
    let widths = [];

    if (lockedCount === 0) {
      widths = distributeInSteps(availableWidth, n);
    } else {
      const remainingWidth = availableWidth - lockedSum;
      const shares = distributeInSteps(remainingWidth, unlockedCount, false);

      let next = 0;
      widths = row.items.map((item, index) => {
        if (fixedWidths[index] !== null) {
          return fixedWidths[index];
        }
        return Math.max(shares[next++], state.MIN_CHART_WIDTH);
      });
    }

    let x = v.contentLeft;

    row.items.forEach((item, i) => {
      const w = widths[i];

      const layoutItem = {
        type: "chart",
        rowIndex,
        indexInRow: i,
        x,
        y,
        width: w,
        height: rowHeight
      };

      if (item.stack && item.stack.length >= 2) {
        const subHeights = computeStackHeights(item.stack, rowHeight);
        let subY = y;
        layoutItem.subCharts = subHeights.map((h, stackIndex) => {
          const sub = {
            type: "chart",
            rowIndex,
            indexInRow: i,
            stackIndex,
            x,
            y: subY,
            width: w,
            height: h
          };
          subY += h + state.GAP_SMALL;
          return sub;
        });
      }

      items.push(layoutItem);

      x += w + state.GAP_SMALL;
    });

    rowsLayout.push(items);
  });

  return rowsLayout;
}