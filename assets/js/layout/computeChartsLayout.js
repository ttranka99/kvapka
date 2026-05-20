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

    let widths = Array(n).fill(baseWidth);

    // --- Symmetric distribution for even numbers of charts ---
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
    }

    // --- Middle chart larger for odd counts ---
    else if (n % 2 === 1 && n >= 3) {
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
    }

    // --- Default behavior for other cases ---
    else {
      for (let i = 0; i < n && remainder > 0; i++) {
        widths[i]++;
        remainder--;
      }
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
