import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { distributeInSteps } from "./sizeStep.js";
import { t } from "../i18n/i18n.js";

const MANUAL_WIDTH_SUM_ERROR = () => t("warnings.slicer.manualWidthSum");
const TIGHT_FIT_WARNING = () => t("warnings.slicer.tightFit");

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
  syncWarning(manualWidthSumExceeded, MANUAL_WIDTH_SUM_ERROR(), "error");
  if (manualWidthSumExceeded) {
    remaining = 0;
  }

  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;

  if (m === 0) {
    syncWarning(false, TIGHT_FIT_WARNING(), "warning");
    return rowSlicers.map(s => s.width);
  }

  syncWarning(remaining < m * state.MIN_SLICER_WIDTH, TIGHT_FIT_WARNING(), "warning");

  // Symmetric distribution when nothing is locked — same rule as KPI rows
  // (computeKpiLayout.js) and chart rows, so a slicer row and a KPI row with
  // the same element count line up column for column.
  if (m === n) {
    return distributeInSteps(remaining, n);
  }

  // Default logic for all other cases
  const shares = distributeInSteps(remaining, m, false);
  let next = 0;
  return rowSlicers.map(s => (s.locked ? s.width : shares[next++]));
}