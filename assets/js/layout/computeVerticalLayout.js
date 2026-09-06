import * as state from "../state/state.js";
import { computeChartGroups } from "./chartGroups.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";
import { walkSections, contentBoxFor as contentBoxForTheme } from "./sectionWalker.js";

// Thin wrapper kept at its old signature — slicerColumnResizeEvents.js calls
// this with a width not yet committed, mid-drag, so it needs the box for a
// hypothetical column width without touching state.SLICER_COLUMN_WIDTH.
export function contentBoxFor(columnWidth, side) {
  return contentBoxForTheme(state.activeTheme, columnWidth, side);
}

// Feeds sectionWalker.js the live state and keeps emitting exactly the
// fields it emitted before the walk was extracted — every solver and
// renderer downstream reads this shape as-is.
export function computeVerticalLayout() {
  const slicers = state.getSlicers();
  const chartRows = state.getChartRows();
  const vertical = state.isVerticalSlicers();
  const sections = state.activeTheme.sections;

  const kpiCardsBySectionId = new Map(
    sections.filter(s => s.type === "kpi").map(s => [s.id, state.getKpiBand(s.id)])
  );

  const chartsSections = sections.filter(s => s.type === "charts");
  const chartGroups = computeChartGroups(chartsSections, chartRows.length);

  return walkSections(state.activeTheme, {
    slicerCount: slicers.length,
    slicersPerRow: state.MAX_SLICERS,
    kpisPerRow: state.MAX_KPIS,
    kpiCardsBySectionId,
    chartRowCount: chartRows.length,
    chartGroups,
    orientation: vertical ? "vertical" : "horizontal",
    slicerSide: state.SLICER_SIDE,
    columnWidth: state.SLICER_COLUMN_WIDTH,
    rowHeightSolver: v => computeChartRowHeights(v)
  });
}
