import * as state from "../state/state.js";
import { rowEffectiveMinHeight } from "./computeStackHeights.js";

// Shrinks the unlocked rows' heights (proportionally to how much headroom
// each has above HARD_MIN_CHART_HEIGHT) until their total no longer exceeds
// `remaining`. Locked rows are never touched — the user explicitly fixed
// those sizes.
function clampUnlockedRows(result, unlockedIndices, remaining) {
  const unlockedSum = unlockedIndices.reduce((s, i) => s + result[i], 0);
  const excess = unlockedSum - remaining;
  if (excess <= 0) return;

  const hardFloor = state.HARD_MIN_CHART_HEIGHT;
  const headroom = unlockedIndices.reduce((s, i) => s + Math.max(0, result[i] - hardFloor), 0);
  if (headroom > 0) {
    const ratio = Math.min(1, excess / headroom);
    unlockedIndices.forEach(i => {
      const shrinkable = Math.max(0, result[i] - hardFloor);
      result[i] = Math.round(result[i] - shrinkable * ratio);
    });
  }
}

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

  const lockedIndices = [];
  const unlockedIndices = [];
  rows.forEach((r, i) => { (r.locked ? lockedIndices : unlockedIndices).push(i); });
  const m = unlockedIndices.length;

  const result = new Array(n);
  const target = Math.max(0, v.chartsHeight - totalGaps);

  if (m === 0) {
    // Every row is locked: stored heights are honored verbatim whenever
    // possible, but the canvas must still be filled exactly, so scale them
    // to fit `target` (grow or shrink) without touching the stored values.
    rows.forEach((r, i) => {
      result[i] = r.height ?? rowEffectiveMinHeight(r);
    });
    const sum = result.reduce((s, h) => s + h, 0);
    if (sum > 0 && sum !== target) {
      let assigned = 0;
      rows.forEach((r, i) => {
        const floor = rowEffectiveMinHeight(r);
        if (i === n - 1) {
          result[i] = Math.max(floor, target - assigned);
        } else {
          result[i] = Math.max(floor, Math.round(result[i] * (target / sum)));
          assigned += result[i];
        }
      });
    }
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
      const rowMin = rowEffectiveMinHeight(r);
      if (h < rowMin) {
        h = rowMin;
      }
      result[i] = h;
    }
  });

  clampUnlockedRows(result, unlockedIndices, remaining);

  // If the locked rows alone exceed the room left after the unlocked ones
  // settled at their floor, the layout still overflows the canvas —
  // shrink the locked heights (on-screen only) to fit what's left.
  const unlockedSum = unlockedIndices.reduce((s, i) => s + result[i], 0);
  const lockedTarget = Math.max(0, target - unlockedSum);
  if (lockedSum > lockedTarget) {
    clampUnlockedRows(result, lockedIndices, lockedTarget);
  }

  return result;
}
