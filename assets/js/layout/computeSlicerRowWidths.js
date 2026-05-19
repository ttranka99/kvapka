import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";

export function computeSlicerRowWidths(rowSlicers) {
  const n = rowSlicers.length;
  if (n === 0) return [];

  if (n <= 3) return rowSlicers.map(s => s.locked ? s.width : 350);

  const totalGaps = (n - 1) * state.GAP_SMALL;
  const lockedSum = rowSlicers
    .filter(s => s.locked)
    .reduce((sum, s) => sum + (s.width ?? 0), 0);

  let remaining = state.USABLE_WIDTH - totalGaps - lockedSum;

  if (remaining < 0) {
    addWarning("Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku.");
    remaining = 0;
  }

  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;

  if (m === 0) return rowSlicers.map(s => s.width);

  if (remaining < m * state.MIN_SLICER_WIDTH) {
    addWarning("Nedostatek místa – některé slicery mohou být příliš úzké.");
  }

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  return rowSlicers.map(s => {
    if (s.locked) return s.width;
    let w = base;
    if (remainder > 0) { w += 1; remainder--; }
    return w;
  });
}
