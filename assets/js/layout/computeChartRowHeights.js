import * as state from "../state/state.js";

export function computeChartRowHeights(v) {
  const rows = state.chartRows;
  const n = rows.length;
  if (n === 0) return [];

  const totalGaps = (n - 1) * state.GAP_SMALL;
  const lockedSum = rows
    .filter(r => r.locked)
    .reduce((s, r) => s + (r.height ?? 0), 0);

  let remaining = v.chartsHeight - totalGaps - lockedSum;
  if (remaining < 0) remaining = 0;

  const unlocked = rows.filter(r => !r.locked);
  const m = unlocked.length;

  const result = new Array(n);

  if (m === 0) {
    rows.forEach((r, i) => {
      result[i] = r.height ?? state.MIN_CHART_ROW_HEIGHT;
    });
    return result;
  }

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  rows.forEach((r, i) => {
    if (r.locked) {
      result[i] = r.height;
    } else {
      let h = base;
      if (remainder > 0) {
        h += 1;
        remainder--;
      }
      if (h < state.MIN_CHART_ROW_HEIGHT) {
        h = state.MIN_CHART_ROW_HEIGHT;
      }
      result[i] = h;
    }
  });

  return result;
}
