import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { distributeInSteps } from "./sizeStep.js";

const MAX_PER_ROW_INFO = "Dosažen maximální počet KPI. Další KPI budou umístěny na další řádek.";
const HARD_LIMIT_ERROR = "Dosaženo maximálního počtu KPI. Odeberte KPI.";
const SECOND_ROW_LIMIT_WARNING = "Druhý řádek KPI překračuje vybraný limit.";
const ROW1_MANUAL_WIDTH_SUM_ERROR = "The sum of manually set KPI widths exceeds the available width.";
const ROW1_OVERFLOW_ERROR = "KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.";
const ROW2_MANUAL_WIDTH_SUM_ERROR = "The sum of manually set KPI widths on the second row exceeds the available width.";
const ROW2_OVERFLOW_ERROR = "KPI se nevejdou do dostupné šířky – upravte šířku nebo odeberte KPI.";

// Messages for a band that never grows a second row (any `kpi` section past
// the first, unless a later stage opts more of them into allowSecondRow).
// Named after the band's own section id so two such bands never share, and
// therefore never fight over, one warning slot.
function singleRowMessages(bandId) {
  return {
    overflow: `KPI v pásu „${bandId}“ se nevejdou do dostupné šířky – upravte šířku nebo odeberte KPI.`,
    limit: `KPI v pásu „${bandId}“ překračují vybraný limit na řádek.`
  };
}

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

// The width rule for a single row of KPI cards, shared by every band's first
// row (and, for a band that never grows a second row, its only row). Three
// cases, in the order they're tested:
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

// Header-style layout: up to two rows, capped at MAX_KPIS / SECOND_ROW_MAX_ITEMS.
function computeTwoRowLayout(v, bandId, top, cards) {
  syncWarning(cards.length === state.MAX_KPIS, MAX_PER_ROW_INFO, "info");
  syncWarning(
    cards.length > state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS,
    HARD_LIMIT_ERROR,
    "error"
  );

  const n = cards.length;
  if (n === 0) {
    syncWarning(false, SECOND_ROW_LIMIT_WARNING, "warning");
    syncWarning(false, ROW1_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW1_OVERFLOW_ERROR, "error");
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR, "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR, "error");
    return [];
  }

  const row1 = cards.slice(0, state.MAX_KPIS);
  const row2 = cards.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS);

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

  const ordinal = state.kpiBandIds().indexOf(bandId);
  const rows = [];

  if (row1.length > 0) {
    let x = v.contentLeft;
    const y = top;

    const items = row1.map((k, i) => {
      const w = widths1[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: i,
        band: ordinal,
        bandId,
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

    const y = top + row1Height + state.GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: state.MAX_KPIS + i,
        band: ordinal,
        bandId,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  return rows;
}

// A band that never grows a second row — its whole point is to break up the
// chart area (or sit somewhere other than under the header) rather than
// become a second stack of cards. Its width rule is the header band's, so
// the two read as the same component wherever they sit.
function computeSingleRowLayout(v, bandId, top, cards) {
  const msgs = singleRowMessages(bandId);

  if (cards.length === 0) {
    syncWarning(false, msgs.overflow, "error");
    syncWarning(false, msgs.limit, "warning");
    return [];
  }

  const row = cards;
  syncWarning(row.length > state.MAX_KPIS, msgs.limit, "warning");

  const solved = kpiRowWidths(row, v.contentWidth);
  const fits = !solved.manualSumExceeded && rowFits(solved.widths, row.length, v.contentWidth);

  syncWarning(!fits, msgs.overflow, "error");
  if (!fits) return [];

  const ordinal = state.kpiBandIds().indexOf(bandId);
  let x = v.contentLeft;
  const items = row.map((k, i) => {
    const w = solved.widths[i];
    const item = {
      x,
      y: top,
      width: w,
      height: k.height ?? state.KPI_MIN_HEIGHT,
      index: i,
      band: ordinal,
      bandId,
      stateRef: k
    };
    x += w + state.GAP_SMALL;
    return item;
  });

  return [items];
}

/**
 * Lays out one KPI band's cards, whichever one it is — the header band, a
 * band splitting the chart area, or any further one a theme defines. `v`
 * already placed every active `kpi` section as part of the section walk
 * (see computeVerticalLayout.js), so this only has to read that section's
 * top edge and whether it's allowed to grow a second row; everything past
 * that is shared width-solving logic.
 *
 * Returns the same [row, ...] shape regardless of band, so renderers and the
 * exporter can treat every band identically.
 */
export function computeKpiLayoutForBand(v, bandId) {
  const cards = state.getKpiBand(bandId);
  const section = v.sectionById[bandId];
  const allowSecondRow = section ? section.allowSecondRow === true : false;
  // A section with zero cards was dropped from the walk entirely (nothing
  // renders there), so it has no placed `top` — but every code path below
  // returns [] before ever reading `top` in that case, so the exact
  // fallback value here is never observed.
  const top = section ? section.top : v.kpiTop;

  return allowSecondRow
    ? computeTwoRowLayout(v, bandId, top, cards)
    : computeSingleRowLayout(v, bandId, top, cards);
}
