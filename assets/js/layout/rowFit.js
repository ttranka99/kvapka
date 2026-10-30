import * as state from "../state/state.js";

// Share of the row a short, partly locked row stays compact in before its
// unlocked items fill the rest.
export const COMPACT_ROW_SHARE = 0.65;

// Whether a row of slicers or KPI cards fits in `available`: locked items at
// their width, the rest at `minWidth`.
export function rowFitsMin(row, minWidth, available) {
  const lockedSum = row.filter(r => r.locked).reduce((sum, r) => sum + (r.width ?? 0), 0);
  const unlockedCount = row.filter(r => !r.locked).length;
  const gaps = (row.length - 1) * state.GAP_SMALL;
  return lockedSum + unlockedCount * minWidth + gaps <= available;
}

// A KPI band's rows, split as in computeKpiLayout.js: two rows at
// MAX_KPIS for a band with allowSecondRow, one row otherwise.
export function kpiRowsOf(bandId) {
  const cards = state.getKpiBand(bandId);
  const section = state.activeTheme.sections.find(s => s.id === bandId);
  if (!section || !section.allowSecondRow) return [cards];
  return [
    cards.slice(0, state.MAX_KPIS),
    cards.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS)
  ];
}
