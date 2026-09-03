import * as state from "../state/state.js";
import { distributeInSteps } from "./sizeStep.js";

// Height solver for the vertical slicer column.
//
// Deliberately PURE: heights are derived from state on every render and
// never written back. Only a locked slicer stores a height. That matters
// more here than anywhere else in the layout, because both rules below
// ("expand to fill" and "shrink to fit") are relative to the current heights
// — if either persisted its result, a plain window resize would silently
// mutate the layout and the adjustments would compound render after render.
//
// Being pure also means "shrink the others to make room for a new slicer"
// needs no special add path at all: an unlocked slicer's height is simply
// whatever the column has room for, recomputed from scratch each time. The
// add handler only has to ask slicerColumnFits() whether the result would
// still clear the per-slicer minimum.

// A locked slicer contributes its stored height; every unlocked one needs at
// least SLICER_HEIGHT (80px on FULL HD, 70px on HD).
function requiredHeight(slicers) {
  const n = slicers.length;
  if (n === 0) return 0;

  const gaps = (n - 1) * state.GAP_SMALL;
  const fixed = slicers.reduce(
    (sum, s) => sum + (s.locked && Number.isFinite(s.height) ? s.height : state.SLICER_HEIGHT),
    0
  );
  return fixed + gaps;
}

// Whether `slicers` can all be shown at or above their minimum height within
// a column of `columnHeight`. Used to cap how many slicers can be added.
export function slicerColumnFits(slicers, columnHeight) {
  return requiredHeight(slicers) <= columnHeight;
}

export function slicerColumnOverflows(slicers, columnHeight) {
  return !slicerColumnFits(slicers, columnHeight);
}

export function computeSlicerColumnHeights(slicers, columnHeight) {
  const n = slicers.length;
  if (n === 0) return [];

  const gaps = (n - 1) * state.GAP_SMALL;
  const lockedHeights = slicers.map(s =>
    s.locked && Number.isFinite(s.height) ? s.height : null
  );
  const lockedSum = lockedHeights.reduce((sum, h) => sum + (h ?? 0), 0);
  const unlockedCount = lockedHeights.filter(h => h === null).length;

  let heights;

  if (unlockedCount === 0) {
    heights = lockedHeights.slice();
  } else {
    // Space the unlocked slicers have to share.
    const remaining = Math.max(0, columnHeight - gaps - lockedSum);
    const natural = unlockedCount * state.SLICER_HEIGHT;

    // Total the column would occupy with every unlocked slicer at its
    // minimum height. Past SLICER_FILL_THRESHOLD of the column, stretch to
    // fill it exactly instead of leaving a thin ragged gap at the bottom.
    const naturalTotal = lockedSum + natural + gaps;
    const shouldFill =
      natural > remaining ||
      naturalTotal >= state.SLICER_FILL_THRESHOLD * columnHeight;

    // distributeInSteps keeps every height a multiple of 5 and makes the
    // shares sum to exactly `remaining`, so a filled column lands flush on
    // the bottom margin. Symmetric spreading only makes sense when the whole
    // column is being solved; with locked slicers interleaved there's no
    // symmetry to preserve (same convention as the width solvers).
    const shares = shouldFill
      ? distributeInSteps(remaining, unlockedCount, unlockedCount === n)
      : Array(unlockedCount).fill(state.SLICER_HEIGHT);

    let next = 0;
    heights = lockedHeights.map(h => (h === null ? shares[next++] : h));
  }

  // Last-resort guard for the one case the rules above can't satisfy: every
  // slicer locked, at heights that together exceed the column. Clamp so the
  // stack can never spill past the bottom margin — computeSlicersLayout
  // raises an error warning for the same condition.
  let used = 0;
  return heights.map(h => {
    const clamped = Math.max(0, Math.min(h, columnHeight - used));
    used += clamped + state.GAP_SMALL;
    return clamped;
  });
}
