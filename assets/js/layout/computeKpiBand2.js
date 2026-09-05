import * as state from "../state/state.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";

// Where the middle KPI band sits, and how the chart rows around it shift.
//
// computeVerticalLayout() already took the band's height (plus its two block
// gaps) out of the chart area, so the rows below simply start that much
// further down. Everything here is derived from the solved row heights, which
// is why it can't live in computeVerticalLayout — the row solver reads
// v.chartsHeight, so it has to run after it.

/**
 * The band's top edge in canvas coordinates, or null when no band is shown.
 * `heights` may be passed in when the caller already solved them (the render
 * path does), otherwise they're solved here.
 */
export function kpiBand2Top(v, heights) {
  if (!v.band2Active) return null;

  const rowHeights = heights ?? computeChartRowHeights(v);

  // No chart rows: the band simply takes the top of the chart area.
  if (rowHeights.length === 0) return v.chartsTop;

  const lastRow = Math.min(v.kpiBand2AfterRow, rowHeights.length - 1);
  let y = v.chartsTop;
  for (let i = 0; i <= lastRow; i++) {
    y += rowHeights[i] + (i < lastRow ? state.GAP_SMALL : 0);
  }
  return y + state.GAP_KPI_TO_CHARTS;
}
