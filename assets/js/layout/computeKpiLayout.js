import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { distributeInSteps } from "./sizeStep.js";
import { kpiBand2Top } from "./computeKpiBand2.js";

const MAX_PER_ROW_INFO = "Dosažen maximální počet KPI. Další KPI budou umístěny na další řádek.";
const HARD_LIMIT_ERROR = "Dosaženo maximálního počtu KPI. Odeberte KPI.";
const SECOND_ROW_LIMIT_WARNING = "Druhý řádek KPI překračuje vybraný limit.";
const ROW1_MANUAL_WIDTH_SUM_ERROR = "The sum of manually set KPI widths exceeds the available width.";
const ROW1_OVERFLOW_ERROR = "KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.";
const ROW2_MANUAL_WIDTH_SUM_ERROR = "The sum of manually set KPI widths on the second row exceeds the available width.";
const ROW2_OVERFLOW_ERROR = "KPI se nevejdou do dostupné šířky – upravte šířku nebo odeberte KPI.";
const BAND2_OVERFLOW_ERROR = "KPI v prostředním pásu se nevejdou do dostupné šířky – upravte šířku nebo odeberte KPI.";
const BAND2_LIMIT_WARNING = "Prostřední pás KPI překračuje vybraný limit na řádek.";

// Tracks which conditions this module has already surfaced a notification
// for, independent of whether that notification has since timed out into the
// bell's panel. This is the key difference from calling addWarning() every
// render while a condition holds: addWarning() alone can't tell "this
// condition just recurred after genuinely going away" apart from "this
// condition never stopped being true, its toast simply timed out to the
// panel on its own 5s schedule, and now some unrelated render happened to run
// again" — both look identical from state.warnings' point of view (message
// present, already moved to panel). Without this tracking, any unrelated
// re-render (e.g. removing a different KPI) would re-call addWarning() for a
// still-true condition and incorrectly pop its toast back up. With it, a
// message is only (re-)added at the actual false→true transition.
const activeConditions = new Set();

function syncWarning(condition, msg, type) {
  // Treat as "already accounted for" only if both our own tracking AND
  // state.warnings agree it's still there — if something else (e.g. the
  // Reset Layout button) wiped state.warnings directly, this falls back to
  // false so the message can be freshly re-added instead of being silently
  // considered handled.
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
  // condition && trackedActive → already surfaced for this occurrence and
  // still true; deliberately do nothing, whatever state its toast/panel
  // entry is currently in.
}

// The width rule for a single row of KPI cards, shared by the header band's
// first row and the middle band (which is always one row). Three cases, in
// the order they're tested:
//   0) three or fewer, none locked → a fixed 250px card each, so a sparse row
//      reads as a few cards rather than three enormous slabs;
//   1) any card locked → the locked widths are honoured and the rest split
//      what's left, left to right (there's no symmetry left to preserve);
//   2) otherwise → an even, symmetric split of the usable width.
function kpiRowWidths(row, availableWidth) {
  const n = row.length;
  const totalGaps = (n - 1) * state.GAP_SMALL;
  const usable = availableWidth - totalGaps;
  const anyLocked = row.some(k => k.locked);

  if (!anyLocked && n <= 3) {
    return { widths: Array(n).fill(250), manualSumExceeded: false };
  }

  if (anyLocked) {
    const lockedSum = row
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);

    const remaining = usable - lockedSum;
    if (remaining < 0) return { widths: [], manualSumExceeded: true };

    const unlockedCount = row.filter(k => !k.locked).length;
    if (unlockedCount === 0) return { widths: row.map(k => k.width), manualSumExceeded: false };

    const shares = distributeInSteps(remaining, unlockedCount, false);
    let next = 0;
    return {
      widths: row.map(k => (k.locked ? k.width : shares[next++])),
      manualSumExceeded: false
    };
  }

  return { widths: distributeInSteps(usable, n), manualSumExceeded: false };
}

function rowFits(widths, count, availableWidth) {
  const totalGaps = (count - 1) * state.GAP_SMALL;
  return widths.reduce((s, w) => s + w, 0) + totalGaps <= availableWidth;
}

export function computeKpiLayout(v) {
  syncWarning(state.kpis.length === state.MAX_KPIS, MAX_PER_ROW_INFO, "info");
  syncWarning(
    state.kpis.length > state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS,
    HARD_LIMIT_ERROR,
    "error"
  );

  const n = state.kpis.length;
  if (n === 0) {
    syncWarning(false, SECOND_ROW_LIMIT_WARNING, "warning");
    syncWarning(false, ROW1_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW1_OVERFLOW_ERROR, "error");
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR, "error");
    return [];
  }

  const row1 = state.kpis.slice(0, state.MAX_KPIS);
  const row2 = state.kpis.slice(
    state.MAX_KPIS,
    state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS
  );

  syncWarning(row2.length > state.MAX_KPIS, SECOND_ROW_LIMIT_WARNING, "warning");

  const totalGaps1 = (row1.length - 1) * state.GAP_SMALL;
  const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;

  const solved1 = kpiRowWidths(row1, v.contentWidth);
  const widths1 = solved1.widths;

  syncWarning(solved1.manualSumExceeded, ROW1_MANUAL_WIDTH_SUM_ERROR, "error");
  if (solved1.manualSumExceeded) {
    syncWarning(false, ROW1_OVERFLOW_ERROR, "error");
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR, "error");
    return [];
  }

  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  const row1Overflows = totalWidthRow1 > v.contentWidth;
  syncWarning(row1Overflows, ROW1_OVERFLOW_ERROR, "error");
  if (row1Overflows) {
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR, "error");
    return [];
  }

  let widths2 = [];
  let row2ManualWidthSumExceeded = false;

  if (row2.length > 0) {
    const n2 = row2.length;
    const anyLocked2 = row2.some(k => k.locked);
    const usable2 = v.contentWidth - totalGaps2;

    // 1) If there are locked KPI → use original logic
    if (anyLocked2) {
      const lockedSum2 = row2
        .filter(k => k.locked)
        .reduce((sum, k) => sum + (k.width ?? 0), 0);

      let remaining2 = usable2 - lockedSum2;

      if (remaining2 < 0) {
        row2ManualWidthSumExceeded = true;
        remaining2 = 0;
      }

      const unlocked2 = row2.filter(k => !k.locked);
      const u2 = unlocked2.length;

      if (u2 === 0) {
        widths2 = row2.map(k => k.width);
      } else {
        const shares = distributeInSteps(remaining2, u2, false);
        let next = 0;
        widths2 = row2.map(k => (k.locked ? k.width : shares[next++]));
      }
    }

    // 2) No locked KPI → symmetric logic for 4/6 KPI + special handling for 1–3 KPI
    else {
      const halfUsable = usable2 / 2;

      // --- A) If there are 4 or 6 KPI → use the same symmetric logic as row1 ---
      if (n2 >= 4) {
        widths2 = distributeInSteps(usable2, n2);
      }
      // --- B) If there are 1–3 KPI → follow the width of the first KPI in row1; if custom width and sum of first KPIs exceeds half, stretch only the last one ---
      else {
        widths2 = [];

        const baseWidth = widths1[0]; // width of the first KPI in the first row
        const isCustomWidth = !!row1[0].locked || !!row1[0].width;

        // 1 KPI in second row → always same width as first KPI in row1
        if (n2 === 1) {
          widths2 = [baseWidth];
        }

        // 2–3 KPI in second row
        else {
          const gapsWidth = (n2 - 1) * state.GAP_SMALL;
          const firstPartWidth = baseWidth * (n2 - 1) + gapsWidth; // sum of KPI 7+8 (+ gap) at n2=3

          // If no custom width OR sum of first KPIs does NOT exceed half → all KPIs same width
          if (!isCustomWidth || firstPartWidth <= halfUsable) {
            widths2 = Array(n2).fill(baseWidth);
          } else {
            // Custom width AND sum of first KPIs exceeds half → stretch ONLY the last KPI
            const lastWidth = Math.max(usable2 - firstPartWidth, 0);

            // First (n2 - 1) KPIs keep baseWidth
            for (let i = 0; i < n2 - 1; i++) {
              widths2.push(baseWidth);
            }
            // Last KPI fills the remaining usable width
            widths2.push(lastWidth);
          }
        }
      }

    }
  }

  syncWarning(row2ManualWidthSumExceeded, ROW2_MANUAL_WIDTH_SUM_ERROR, "error");

  const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
  const row2Overflows = totalWidthRow2 > v.contentWidth;
  syncWarning(row2Overflows, ROW2_OVERFLOW_ERROR, "error");
  if (row2Overflows) return [];

  const rows = [];

  if (row1.length > 0) {
    let x = v.contentLeft;
    const y = v.kpiTop;

    const items = row1.map((k, i) => {
      const w = widths1[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: i,
        band: 0,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  if (row2.length > 0) {
    let x = v.contentLeft;

    const row1Height = row1.length
      ? Math.max(...row1.map(k => k.height ?? state.KPI_MIN_HEIGHT))
      : state.KPI_MIN_HEIGHT;

    const y = v.kpiTop + row1Height + state.GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: state.MAX_KPIS + i,
        band: 0,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  return rows;
}

/**
 * The middle KPI band — always a single row, since its whole point is to
 * break up the chart area rather than become a second stack of cards. Its
 * width rule is the header band's, so the two read as the same component
 * wherever they sit; only its Y comes from elsewhere (the solved chart row
 * heights, via kpiBand2Top).
 *
 * Returns the same [row] shape as computeKpiLayout so renderers and the
 * exporter can treat both bands identically.
 */
export function computeKpiBand2Layout(v, heights) {
  if (!v.band2Active || state.kpis2.length === 0) {
    syncWarning(false, BAND2_OVERFLOW_ERROR, "error");
    syncWarning(false, BAND2_LIMIT_WARNING, "warning");
    return [];
  }

  const row = state.kpis2;
  syncWarning(row.length > state.MAX_KPIS, BAND2_LIMIT_WARNING, "warning");

  const solved = kpiRowWidths(row, v.contentWidth);
  const fits = !solved.manualSumExceeded && rowFits(solved.widths, row.length, v.contentWidth);

  syncWarning(!fits, BAND2_OVERFLOW_ERROR, "error");
  if (!fits) return [];

  const y = kpiBand2Top(v, heights);
  if (y === null) return [];

  let x = v.contentLeft;
  const items = row.map((k, i) => {
    const w = solved.widths[i];
    const item = {
      x,
      y,
      width: w,
      height: k.height ?? state.KPI_MIN_HEIGHT,
      index: i,
      band: 1,
      stateRef: k
    };
    x += w + state.GAP_SMALL;
    return item;
  });

  return [items];
}
