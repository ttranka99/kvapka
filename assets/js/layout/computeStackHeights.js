// assets/js/layout/computeStackHeights.js
import * as state from "../state/state.js";
import { distributeInSteps, snapToStep } from "./sizeStep.js";

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

// Shrinks the unlocked stack entries (proportionally to their headroom above
// HARD_MIN_CHART_HEIGHT) until their total fits within `remaining`. Mirrors
// clampUnlockedRows() in computeChartRowHeights.js — needed because a row can
// itself get shrunk below rowEffectiveMinHeight() (see that file) when the
// canvas is too short, leaving less cellHeight than this stack's own
// MIN_CHART_ROW_HEIGHT floors add up to.
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

// Scales the given `indices`' heights proportionally so they sum to exactly
// `target` (growing or shrinking as needed), flooring each at
// HARD_MIN_CHART_HEIGHT. Used when every stack entry is locked: locked
// heights are normally kept verbatim, but when the cell itself doesn't
// match their sum (e.g. a sibling row was removed and this row grew) they
// must be redistributed on-screen. This never writes back to the stored
// `stack[i].height`, so the exact locked sizes return once the cell fits
// them again.
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

  if (unlockedIdx.length === 0) {
    // Every entry is locked: their stored heights are honored verbatim
    // whenever possible, but the cell must still be filled exactly, so
    // scale them to fit `available` (grow or shrink) without touching the
    // stored values.
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

  // If the locked entries alone exceed the room left after the unlocked
  // ones settled at their floor, the stack still overflows the cell —
  // shrink the locked heights (on-screen only) to fit what's left.
  const unlockedSum = unlockedIdx.reduce((s, i) => s + heights[i], 0);
  const lockedRemaining = available - unlockedSum;
  if (lockedSum > lockedRemaining) {
    clampUnlockedStack(heights, lockedIdx, lockedRemaining);
  }

  return heights;
}
