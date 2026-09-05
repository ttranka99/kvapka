import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";
import { computeStackHeights } from "./computeStackHeights.js";
import { distributeInSteps } from "./sizeStep.js";

export function computeChartsLayout(v) {
  const heights = computeChartRowHeights(v);
  const rowsLayout = [];
  let currentY = v.chartsTop;

  state.chartRows.forEach((row, rowIndex) => {
    const rowHeight = heights[rowIndex];
    const items = [];
    const n = row.items.length;

    const totalGaps = (n - 1) * state.GAP_SMALL;
    const availableWidth = v.contentWidth - totalGaps;

    // A chart keeps its current width if one is stored, whether or not it's
    // still "locked" — unlocking a chart intentionally leaves its width in
    // place (see handleToggleChartLock in chartEvents.js) so it doesn't
    // visibly jump just from being unlocked. Only an explicit add/remove
    // nulls out a row's widths to force a fresh even redistribution, so by
    // the time this runs, "has a stored width" and "should stay fixed" are
    // the same thing regardless of the locked flag.
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
        y: currentY,
        width: w,
        height: rowHeight
      };

      if (item.stack && item.stack.length >= 2) {
        const subHeights = computeStackHeights(item.stack, rowHeight);
        let subY = currentY;
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
    currentY += rowHeight + state.GAP_SMALL;

    // The middle KPI band is carved out between two chart rows: once the row
    // it sits below is placed, skip past the space computeVerticalLayout()
    // already reserved for it before laying out the next row. currentY is
    // already one GAP_SMALL past this row's bottom, and kpiBand2Reserved is
    // the *extra* on top of that gap, so it adds straight on.
    if (v.band2Active && rowIndex === v.kpiBand2AfterRow) {
      currentY += v.kpiBand2Reserved;
    }
  });

  return rowsLayout;
}