import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";

const MANUAL_WIDTH_SUM_ERROR = "Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku.";
const TIGHT_FIT_WARNING = "Nedostatek místa – některé slicery mohou být příliš úzké.";

// Tracks which conditions this module has already surfaced a notification
// for, independent of the toast's own 5s panel-timeout — see the identical
// comment in computeKpiLayout.js / computeSlicersLayout.js.
const activeConditions = new Set();

function syncWarning(condition, msg, type) {
  const trackedActive = activeConditions.has(msg) && state.warnings.includes(msg);

  if (condition && !trackedActive) {
    addWarning(msg, type);
    activeConditions.add(msg);
  } else if (!condition) {
    if (state.warnings.includes(msg)) {
      state.setWarnings(state.warnings.filter(w => w !== msg));
    }
    activeConditions.delete(msg);
  }
}

export function computeSlicerRowWidths(rowSlicers) {
  const n = rowSlicers.length;
  if (n === 0) return [];

  if (n <= 3) return rowSlicers.map(s => s.locked ? s.width : 350);

  const totalGaps = (n - 1) * state.GAP_SMALL;
  const lockedSum = rowSlicers
    .filter(s => s.locked)
    .reduce((sum, s) => sum + (s.width ?? 0), 0);

  let remaining = state.USABLE_WIDTH - totalGaps - lockedSum;

  const manualWidthSumExceeded = remaining < 0;
  syncWarning(manualWidthSumExceeded, MANUAL_WIDTH_SUM_ERROR, "error");
  if (manualWidthSumExceeded) {
    remaining = 0;
  }

  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;

  if (m === 0) {
    syncWarning(false, TIGHT_FIT_WARNING, "warning");
    return rowSlicers.map(s => s.width);
  }

  syncWarning(remaining < m * state.MIN_SLICER_WIDTH, TIGHT_FIT_WARNING, "warning");

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  // Special symmetric distribution for 4 or 6 slicers (no locked slicers)
  if (m === n && (n === 4 || n === 6)) {
    const widths = Array(n).fill(base);

    let left = 0;
    let right = n - 1;

    // Distribute remainder symmetrically
    while (remainder > 1 && left < right) {
      widths[left]++;
      widths[right]++;
      remainder -= 2;
      left++;
      right--;
    }

    // If 1 pixel remains → give it to the rightmost slicer
    if (remainder === 1) {
      widths[n - 1]++;
    }

    return widths;
  }

  // Default logic for all other cases
  return rowSlicers.map(s => {
    if (s.locked) return s.width;
    let w = base;
    if (remainder > 0) { w += 1; remainder--; }
    return w;
  });

}