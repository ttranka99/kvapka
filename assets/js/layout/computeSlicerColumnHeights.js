import * as state from "../state/state.js";
import { distributeInSteps } from "./sizeStep.js";

// Height solver for the vertical slicer column.
//
// Deliberately PURE: heights are recomputed from state on every render and
// never written back. Only a locked slicer stores a height. If the "expand to
// fill" and "shrink to fit" rules persisted their results, a window resize
// would change the layout and the changes would compound.
//
// So adding a slicer needs no special path: unlocked heights just shrink to
// fit. The add handler only checks slicerColumnFits().

// A locked slicer counts its stored height; an unlocked one needs at least
// SLICER_HEIGHT (80px on FULL HD, 70px on HD).
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

// Whether all `slicers` fit in `columnHeight` at their minimum height. Caps
// how many slicers can be added.
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
    // Space the unlocked slicers share.
    const remaining = Math.max(0, columnHeight - gaps - lockedSum);
    const natural = unlockedCount * state.SLICER_HEIGHT;

    // Column height with every unlocked slicer at its minimum. Past
    // SLICER_FILL_THRESHOLD of the column, stretch to fill it instead of
    // leaving a thin gap at the bottom.
    const naturalTotal = lockedSum + natural + gaps;
    const shouldFill =
      natural > remaining ||
      naturalTotal >= state.SLICER_FILL_THRESHOLD * columnHeight;

    // distributeInSteps keeps heights on the grid step and sums exactly to
    // `remaining`, so a filled column ends flush with the bottom margin.
    // Symmetric only when nothing is locked (same as the width solvers).
    const shares = shouldFill
      ? distributeInSteps(remaining, unlockedCount, unlockedCount === n)
      : Array(unlockedCount).fill(state.SLICER_HEIGHT);

    let next = 0;
    heights = lockedHeights.map(h => (h === null ? shares[next++] : h));
  }

  // Last-resort guard: every slicer locked and together taller than the
  // column. Clamp so nothing spills past the bottom margin.
  // computeSlicersLayout warns about the same case.
  let used = 0;
  return heights.map(h => {
    const clamped = Math.max(0, Math.min(h, columnHeight - used));
    used += clamped + state.GAP_SMALL;
    return clamped;
  });
}
