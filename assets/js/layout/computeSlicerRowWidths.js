import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { distributeInSteps } from "./sizeStep.js";
import { COMPACT_ROW_SHARE } from "./rowFit.js";
import { t } from "../i18n/i18n.js";

const MANUAL_WIDTH_SUM_ERROR = () => t("warnings.slicer.manualWidthSum");
const TIGHT_FIT_WARNING = () => t("warnings.slicer.tightFit");

const COMPACT_SLICER_WIDTH = 350;

// Conditions already reported, tracked apart from the toast's 5s timeout.
// Same as in computeKpiLayout.js / computeSlicersLayout.js.
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

  const totalGaps = (n - 1) * state.GAP_SMALL;

  // Up to 3 slicers stay compact. Once one has a hand-set width, only while
  // the row fits in COMPACT_ROW_SHARE of the width; past that, the unlocked
  // ones fill the row like longer rows do.
  if (n <= 3) {
    const compact = rowSlicers.map(s => s.locked ? s.width : COMPACT_SLICER_WIDTH);
    const compactTotal = compact.reduce((sum, w) => sum + w, 0) + totalGaps;
    const anyLocked = rowSlicers.some(s => s.locked);
    if (!anyLocked || compactTotal <= COMPACT_ROW_SHARE * state.USABLE_WIDTH) {
      syncWarning(false, MANUAL_WIDTH_SUM_ERROR(), "error");
      syncWarning(false, TIGHT_FIT_WARNING(), "warning");
      return compact;
    }
  }

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

  // Symmetric when nothing is locked, as in KPI rows (computeKpiLayout.js)
  // and chart rows, so rows with the same count line up column for column.
  if (m === n) {
    return distributeInSteps(remaining, n);
  }

  // Some locked: share the rest left to right.
  const shares = distributeInSteps(remaining, m, false);
  let next = 0;
  return rowSlicers.map(s => (s.locked ? s.width : shares[next++]));
}