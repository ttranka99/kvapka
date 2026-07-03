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
    const availableWidth = state.USABLE_WIDTH - totalGaps;

    const fixedWidths = row.items.map(item => {
      return item.locked && Number.isFinite(item.width) ? item.width : null;
    });

    const lockedCount = fixedWidths.filter(w => w !== null).length;
    const unlockedCount = n - lockedCount;
    const lockedSum = fixedWidths.reduce((sum, w) => sum + (w || 0), 0);
    let widths = [];

    if (lockedCount === 0) {
      const baseWidth = Math.floor(availableWidth / n);
      let remainder = availableWidth % n;
      widths = Array(n).fill(baseWidth);

      if (n % 2 === 0 && n >= 4) {
        let left = 0;
        let right = n - 1;

        while (remainder > 1 && left < right) {
          widths[left]++;
          widths[right]++;
          remainder -= 2;
          left++;
          right--;
        }

        if (remainder === 1) {
          widths[n - 1]++;
        }
      } else if (n % 2 === 1 && n >= 3) {
        const center = Math.floor(n / 2);
        let left = 0;
        let right = n - 1;

        while (remainder > 2 && left < right) {
          widths[left]++;
          widths[right]++;
          remainder -= 2;
          left++;
          right--;
        }

        if (remainder === 1) {
          widths[center]++;
        }
      } else {
        for (let i = 0; i < n && remainder > 0; i++) {
          widths[i]++;
          remainder--;
        }
      }
    } else {
      let remainingWidth = availableWidth - lockedSum;
      const baseWidth = unlockedCount > 0 ? Math.floor(remainingWidth / unlockedCount) : 0;
      let remainder = unlockedCount > 0 ? remainingWidth % unlockedCount : 0;

      widths = row.items.map((item, index) => {
        if (fixedWidths[index] !== null) {
          return fixedWidths[index];
        }

        let value = Math.max(baseWidth, state.MIN_CHART_WIDTH);
        if (remainder > 0) {
          value += 1;
          remainder -= 1;
        }

        return value;
      });
    }

    let x = state.MARGIN;

    row.items.forEach((item, i) => {
      const w = widths[i];

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