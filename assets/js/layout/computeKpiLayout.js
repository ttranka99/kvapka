import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";
import { distributeInSteps } from "./sizeStep.js";
import { t } from "../i18n/i18n.js";

const MAX_PER_ROW_INFO = () => t("warnings.kpi.maxPerRow");
const HARD_LIMIT_ERROR = () => t("warnings.kpi.hardLimit");
const SECOND_ROW_LIMIT_WARNING = () => t("warnings.kpi.secondRowLimit");
const ROW1_MANUAL_WIDTH_SUM_ERROR = () => t("warnings.kpi.row1ManualWidthSum");
const ROW1_OVERFLOW_ERROR = () => t("warnings.kpi.row1Overflow");
const ROW2_MANUAL_WIDTH_SUM_ERROR = () => t("warnings.kpi.row2ManualWidthSum");
const ROW2_OVERFLOW_ERROR = () => t("warnings.kpi.row2Overflow");

// Messages for a band with no second row (any `kpi` section past the first,
// unless opted into allowSecondRow). Named by section id so two bands never
// share one warning slot.
function singleRowMessages(bandId) {
  return {
    overflow: t("warnings.kpi.bandOverflow", { band: bandId }),
    limit: t("warnings.kpi.bandLimit", { band: bandId })
  };
}

// Conditions already reported, tracked apart from whether their toast has
// timed out into the bell's panel. state.warnings alone can't tell "the
// condition just came back" from "it never went away and the toast timed
// out". Without this, any unrelated re-render (e.g. removing a different KPI)
// would pop the toast back up. With it, a message is only added when the
// condition goes from false to true.
const activeConditions = new Set();

function syncWarning(condition, msg, type) {
  // Already handled only if our tracking AND state.warnings both have it. If
  // something else wiped state.warnings (e.g. Reset Layout), the message is
  // added again.
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
  // condition && trackedActive: already reported and still true. Do nothing.
}

const lockedWidthSum = row =>
  row.filter(k => k.locked).reduce((sum, k) => sum + (k.width ?? 0), 0);

// Locked cards keep their width. The rest split what is left, left to right
// (no symmetry once a card is pinned). `remaining` is passed in because the
// two callers treat a negative value differently.
function widthsWithLocked(row, remaining) {
  const unlockedCount = row.filter(k => !k.locked).length;
  if (unlockedCount === 0) return row.map(k => k.width);

  const shares = distributeInSteps(Math.max(0, remaining), unlockedCount, false);
  let next = 0;
  return row.map(k => (k.locked ? k.width : shares[next++]));
}

// Width rule for one row of KPI cards, used for every band's first row (and
// the only row of a single-row band). Cases, in order:
//   0) three or fewer, none locked: fixed 250px cards, so a sparse row
//      doesn't become a few huge slabs;
//   1) any locked: widthsWithLocked(). A negative remainder is fatal, so the
//      row renders nothing and warns instead of showing squeezed cards;
//   2) otherwise: even, symmetric split of the usable width.
function kpiRowWidths(row, availableWidth) {
  const n = row.length;
  const totalGaps = (n - 1) * state.GAP_SMALL;
  const usable = availableWidth - totalGaps;
  const anyLocked = row.some(k => k.locked);

  if (!anyLocked && n <= 3) {
    return { widths: Array(n).fill(250), manualSumExceeded: false };
  }

  if (anyLocked) {
    const remaining = usable - lockedWidthSum(row);
    if (remaining < 0) return { widths: [], manualSumExceeded: true };
    return { widths: widthsWithLocked(row, remaining), manualSumExceeded: false };
  }

  return { widths: distributeInSteps(usable, n), manualSumExceeded: false };
}

function rowFits(widths, count, availableWidth) {
  const totalGaps = (count - 1) * state.GAP_SMALL;
  return widths.reduce((s, w) => s + w, 0) + totalGaps <= availableWidth;
}

// Header-style layout: up to two rows, capped at MAX_KPIS / SECOND_ROW_MAX_ITEMS.
function computeTwoRowLayout(v, bandId, top, cards) {
  syncWarning(cards.length === state.MAX_KPIS, MAX_PER_ROW_INFO(), "info");
  syncWarning(
    cards.length > state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS,
    HARD_LIMIT_ERROR(),
    "error"
  );

  const n = cards.length;
  if (n === 0) {
    syncWarning(false, SECOND_ROW_LIMIT_WARNING(), "warning");
    syncWarning(false, ROW1_MANUAL_WIDTH_SUM_ERROR(), "error");
    syncWarning(false, ROW1_OVERFLOW_ERROR(), "error");
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR(), "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR(), "error");
    return [];
  }

  const row1 = cards.slice(0, state.MAX_KPIS);
  const row2 = cards.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS);

  syncWarning(row2.length > state.MAX_KPIS, SECOND_ROW_LIMIT_WARNING(), "warning");

  const totalGaps1 = (row1.length - 1) * state.GAP_SMALL;
  const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;

  const solved1 = kpiRowWidths(row1, v.contentWidth);
  const widths1 = solved1.widths;

  syncWarning(solved1.manualSumExceeded, ROW1_MANUAL_WIDTH_SUM_ERROR(), "error");
  if (solved1.manualSumExceeded) {
    syncWarning(false, ROW1_OVERFLOW_ERROR(), "error");
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR(), "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR(), "error");
    return [];
  }

  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  const row1Overflows = totalWidthRow1 > v.contentWidth;
  syncWarning(row1Overflows, ROW1_OVERFLOW_ERROR(), "error");
  if (row1Overflows) {
    syncWarning(false, ROW2_MANUAL_WIDTH_SUM_ERROR(), "error");
    syncWarning(false, ROW2_OVERFLOW_ERROR(), "error");
    return [];
  }

  let widths2 = [];
  let row2ManualWidthSumExceeded = false;

  if (row2.length > 0) {
    const n2 = row2.length;
    const anyLocked2 = row2.some(k => k.locked);
    const usable2 = v.contentWidth - totalGaps2;

    // Any locked: the shared rule, except that a locked sum too wide to fit
    // is flagged and clamped, not fatal. Row 2 still renders (squeezed) so the
    // user can see which cards to shrink. Row 1 renders nothing.
    if (anyLocked2) {
      const remaining2 = usable2 - lockedWidthSum(row2);
      row2ManualWidthSumExceeded = remaining2 < 0;
      widths2 = widthsWithLocked(row2, remaining2);
    }

    // Nothing locked. Four or more cards split evenly, like row 1. One to
    // three take row 1's first card width, so a short row 2 continues row 1
    // instead of stretching across the canvas.
    else if (n2 >= 4) {
      widths2 = distributeInSteps(usable2, n2);
    }

    else {
      const baseWidth = widths1[0];
      const gapsWidth = (n2 - 1) * state.GAP_SMALL;
      // Every card but the last at row 1's width.
      const firstPartWidth = baseWidth * (n2 - 1) + gapsWidth;
      // Only a hand-set width can make the base too wide; a computed one
      // always fits.
      const isCustomWidth = !!row1[0].locked || !!row1[0].width;

      widths2 = (n2 > 1 && isCustomWidth && firstPartWidth > usable2 / 2)
        // Too wide to repeat: the last card takes what is left.
        ? [...Array(n2 - 1).fill(baseWidth), Math.max(usable2 - firstPartWidth, 0)]
        : Array(n2).fill(baseWidth);
    }
  }

  syncWarning(row2ManualWidthSumExceeded, ROW2_MANUAL_WIDTH_SUM_ERROR(), "error");

  const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
  const row2Overflows = totalWidthRow2 > v.contentWidth;
  syncWarning(row2Overflows, ROW2_OVERFLOW_ERROR(), "error");
  if (row2Overflows) return [];

  const ordinal = state.kpiBandIds().indexOf(bandId);
  // Every card in the band, both rows, shares one height.
  const h = state.kpiBandHeight(bandId);
  const rows = [];

  if (row1.length > 0) {
    let x = v.contentLeft;
    const y = top;

    const items = row1.map((k, i) => {
      const w = widths1[i];

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

    const y = top + h + state.GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];

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

// A band with no second row. It breaks up the chart area or sits away from
// the header. Uses the header band's width rule, so both look like the same
// component.
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
  const height = state.kpiBandHeight(bandId);
  let x = v.contentLeft;
  const items = row.map((k, i) => {
    const w = solved.widths[i];
    const item = {
      x,
      y: top,
      width: w,
      height,
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
 * Lays out one KPI band's cards (header band, chart-area band, or any other
 * band a theme defines). `v` already placed every active `kpi` section (see
 * computeVerticalLayout.js), so this only reads the section's top edge and
 * allowSecondRow.
 *
 * Returns the same [row, ...] shape for every band, so renderers and the
 * exporter treat them alike.
 */
export function computeKpiLayoutForBand(v, bandId) {
  const cards = state.getKpiBand(bandId);
  // The walk drops a section with zero cards, so `section` is undefined only
  // for an empty band. Both layouts below return [] before reading `top`, so
  // the fallback is never used.
  const section = v.sectionById[bandId];
  const allowSecondRow = section ? section.allowSecondRow === true : false;
  const top = section ? section.top : 0;

  return allowSecondRow
    ? computeTwoRowLayout(v, bandId, top, cards)
    : computeSingleRowLayout(v, bandId, top, cards);
}
