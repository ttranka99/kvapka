import * as state from "../state/state.js";
import { rowEffectiveMinHeight } from "./computeStackHeights.js";
import { distributeInSteps, snapToStep } from "./sizeStep.js";

// Shrinks the rows at `unlockedIndices` until they fit in `remaining`, each by
// its share of the headroom above HARD_MIN_CHART_HEIGHT.
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
      result[i] = snapToStep(result[i] - shrinkable * ratio);
    });
  }
}

export function computeChartRowHeights(v) {
  const rows = state.chartRows;
  const n = rows.length;
  if (n === 0) return [];

  // chartRowGapCount counts the gaps inside chart groups only. The gaps
  // between groups are already counted by computeVerticalLayout. Falls back
  // to n - 1 (one unbroken block) if missing.
  const totalGaps = (v.chartRowGapCount ?? n - 1) * state.GAP_SMALL;
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
    // Every row is locked. The canvas must still be filled exactly, so scale
    // the heights to `target` without changing the stored values.
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
          result[i] = Math.max(floor, snapToStep(result[i] * (target / sum)));
          assigned += result[i];
        }
      });
    }
    return result;
  }

  const shares = distributeInSteps(remaining, m, false);
  let next = 0;

  rows.forEach((r, i) => {
    if (r.locked) {
      result[i] = r.height;
    } else {
      result[i] = Math.max(shares[next++], rowEffectiveMinHeight(r));
    }
  });

  clampUnlockedRows(result, unlockedIndices, remaining);

  // If the locked rows still overflow once the unlocked ones are at their
  // floor, shrink the locked heights (on-screen only) to fit.
  const unlockedSum = unlockedIndices.reduce((s, i) => s + result[i], 0);
  const lockedTarget = Math.max(0, target - unlockedSum);
  if (lockedSum > lockedTarget) {
    clampUnlockedRows(result, lockedIndices, lockedTarget);
  }

  return result;
}
