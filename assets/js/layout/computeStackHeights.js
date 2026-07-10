// assets/js/layout/computeStackHeights.js
import * as state from "../state/state.js";

// Minimum height a stack of `count` charts needs: each sub-chart floors at
// MIN_CHART_ROW_HEIGHT, plus the small gaps between them.
export function stackMinHeight(count) {
  return count * state.MIN_CHART_ROW_HEIGHT + (count - 1) * state.GAP_SMALL;
}

// A row's effective minimum height is normally MIN_CHART_ROW_HEIGHT, but a
// stacked cell inside it can raise that floor — either because it simply has
// more sub-charts than fit in one MIN_CHART_ROW_HEIGHT, or because some of
// its sub-charts are height-locked at a size that leaves less room for the
// still-flexible ones (each of which still needs at least
// MIN_CHART_ROW_HEIGHT of its own).
export function rowEffectiveMinHeight(row) {
  let min = state.MIN_CHART_ROW_HEIGHT;

  row.items.forEach(item => {
    if (!item.stack || item.stack.length < 2) return;

    const n = item.stack.length;
    const gaps = (n - 1) * state.GAP_SMALL;
    const lockedSum = item.stack
      .filter(s => s.locked)
      .reduce((sum, s) => sum + (Number.isFinite(s.height) ? s.height : state.MIN_CHART_ROW_HEIGHT), 0);
    const unlockedCount = n - item.stack.filter(s => s.locked).length;

    const needed = lockedSum + unlockedCount * state.MIN_CHART_ROW_HEIGHT + gaps;
    min = Math.max(min, needed);
  });

  return min;
}

// Splits a cell's total height among its stacked sub-charts. Locked entries
// keep their stored height untouched. Among the unlocked entries: if every
// one of them already has a stored height (e.g. from a prior drag), they're
// scaled proportionally to fill whatever room remains — this is what makes
// a row-height change redistribute a stack's manually-dragged proportions
// instead of resetting them. Otherwise (any unlocked entry is still "auto",
// height: null) the remaining room is split evenly, same pattern as
// computeChartRowHeights. Every returned height floors at
// MIN_CHART_ROW_HEIGHT.
export function computeStackHeights(stack, cellHeight) {
  const n = stack.length;
  const gaps = (n - 1) * state.GAP_SMALL;
  const available = Math.max(0, cellHeight - gaps);

  const heights = new Array(n).fill(0);
  const lockedIdx = [];
  const unlockedIdx = [];
  stack.forEach((s, i) => (s.locked ? lockedIdx : unlockedIdx).push(i));

  let lockedSum = 0;
  lockedIdx.forEach(i => {
    heights[i] = Number.isFinite(stack[i].height) ? stack[i].height : state.MIN_CHART_ROW_HEIGHT;
    lockedSum += heights[i];
  });

  const remaining = Math.max(0, available - lockedSum);

  if (unlockedIdx.length === 0) return heights;

  const storedUnlocked = unlockedIdx.filter(i => Number.isFinite(stack[i].height));
  const allUnlockedStored = storedUnlocked.length === unlockedIdx.length;
  const storedSum = storedUnlocked.reduce((sum, i) => sum + stack[i].height, 0);

  if (allUnlockedStored && storedSum > 0) {
    let assigned = 0;
    unlockedIdx.forEach((i, idx) => {
      let h;
      if (idx === unlockedIdx.length - 1) {
        h = remaining - assigned;
      } else {
        h = Math.round(stack[i].height * (remaining / storedSum));
        assigned += h;
      }
      heights[i] = Math.max(state.MIN_CHART_ROW_HEIGHT, h);
    });
    return heights;
  }

  const base = Math.floor(remaining / unlockedIdx.length);
  let remainder = remaining % unlockedIdx.length;
  unlockedIdx.forEach(i => {
    let h = base;
    if (remainder > 0) {
      h += 1;
      remainder--;
    }
    heights[i] = Math.max(state.MIN_CHART_ROW_HEIGHT, h);
  });

  return heights;
}
