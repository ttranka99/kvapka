// assets/js/layout/computeStackHeights.js
import * as state from "../state/state.js";
import { distributeInSteps, snapToStep } from "./sizeStep.js";

// Minimum height a stack of `count` charts needs: each sub-chart floors at
// MIN_CHART_ROW_HEIGHT, plus the small gaps between them.
export function stackMinHeight(count) {
  return count * state.MIN_CHART_ROW_HEIGHT + (count - 1) * state.GAP_SMALL;
}

// A row's minimum height is MIN_CHART_ROW_HEIGHT, unless a stack in it needs
// more: locked sub-charts keep their height, and each unlocked one still
// needs MIN_CHART_ROW_HEIGHT.
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

// Shrinks the entries at `unlockedIdx` until they fit in `remaining`, each by
// its share of the headroom above HARD_MIN_CHART_HEIGHT. Mirrors
// clampUnlockedRows() in computeChartRowHeights.js. Needed because a short
// canvas can shrink a row below rowEffectiveMinHeight().
function clampUnlockedStack(heights, unlockedIdx, remaining) {
  const unlockedSum = unlockedIdx.reduce((s, i) => s + heights[i], 0);
  const excess = unlockedSum - remaining;
  if (excess <= 0) return;

  const hardFloor = state.HARD_MIN_CHART_HEIGHT;
  const headroom = unlockedIdx.reduce((s, i) => s + Math.max(0, heights[i] - hardFloor), 0);
  if (headroom <= 0) return;

  const ratio = Math.min(1, excess / headroom);
  unlockedIdx.forEach(i => {
    const shrinkable = Math.max(0, heights[i] - hardFloor);
    heights[i] = snapToStep(heights[i] - shrinkable * ratio);
  });
}

// Scales the heights at `indices` proportionally to sum to `target`, with
// each at least HARD_MIN_CHART_HEIGHT. Used when every entry is locked but
// the cell no longer matches their sum (e.g. a sibling row was removed).
// Only the on-screen heights change, not `stack[i].height`, so the locked
// sizes return once the cell fits them again.
function fitHeightsTo(heights, indices, target) {
  const sum = indices.reduce((s, i) => s + heights[i], 0);
  if (sum <= 0 || sum === target) return;

  const hardFloor = state.HARD_MIN_CHART_HEIGHT;
  let assigned = 0;
  indices.forEach((i, idx) => {
    if (idx === indices.length - 1) {
      heights[i] = Math.max(hardFloor, target - assigned);
    } else {
      heights[i] = Math.max(hardFloor, snapToStep(heights[i] * (target / sum)));
      assigned += heights[i];
    }
  });
}

// Splits a cell's height among its stacked sub-charts. Locked entries keep
// their stored height. The unlocked ones share the rest:
// - all have a stored height (e.g. from a drag): scaled proportionally, so a
//   row-height change keeps the dragged proportions;
// - any is "auto" (height: null): split evenly, as in computeChartRowHeights.
// Each height is at least MIN_CHART_ROW_HEIGHT.
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

  if (unlockedIdx.length === 0) {
    // All locked: still fill the cell exactly, so scale to `available`
    // (stored heights stay untouched).
    fitHeightsTo(heights, lockedIdx, available);
    return heights;
  }

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
        h = snapToStep(stack[i].height * (remaining / storedSum));
        assigned += h;
      }
      heights[i] = Math.max(state.MIN_CHART_ROW_HEIGHT, h);
    });
  } else {
    const shares = distributeInSteps(remaining, unlockedIdx.length, false);
    unlockedIdx.forEach((i, idx) => {
      heights[i] = Math.max(state.MIN_CHART_ROW_HEIGHT, shares[idx]);
    });
  }

  clampUnlockedStack(heights, unlockedIdx, remaining);

  // Locked entries can still overflow the cell once the unlocked ones are at
  // their floor: shrink them too (on-screen only).
  const unlockedSum = unlockedIdx.reduce((s, i) => s + heights[i], 0);
  const lockedRemaining = available - unlockedSum;
  if (lockedSum > lockedRemaining) {
    clampUnlockedStack(heights, lockedIdx, lockedRemaining);
  }

  return heights;
}
