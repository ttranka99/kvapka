import {
  getSlicers,
  getKpis,
  getChartRows,
  CANVAS_HEIGHT,
  MARGIN,
  TITLE_HEIGHT,
  GAP_SMALL,
  GAP_KPI_TO_CHARTS,
  SLICER_HEIGHT,
  KPI_MIN_HEIGHT,
  MAX_SLICERS,
  MAX_KPIS,
  SECOND_ROW_MAX_ITEMS
} from "../state/state.js";

export function computeVerticalLayout() {
  const slicers = getSlicers();
  const kpis = getKpis();
  const chartRows = getChartRows();

  // TITLE
  const TITLE_Y = MARGIN;

  // SLICERS
  const slicersTop = TITLE_Y + TITLE_HEIGHT + GAP_SMALL;

  const hasRow2 = slicers.length > MAX_SLICERS;

  const slicersBottom =
    slicers.length === 0
      ? slicersTop
      : hasRow2
        ? slicersTop + SLICER_HEIGHT * 2 + GAP_SMALL
        : slicersTop + SLICER_HEIGHT;

  // KPI
  const kpiTop =
    slicers.length > 0
      ? slicersBottom + GAP_SMALL
      : slicersTop;

  const kpiRow1 = kpis.slice(0, MAX_KPIS);
  const kpiRow2 = kpis.length > MAX_KPIS
    ? kpis.slice(MAX_KPIS, MAX_KPIS + SECOND_ROW_MAX_ITEMS)
    : [];

  const row1Height = kpiRow1.length
    ? Math.max(...kpiRow1.map(k => k.height ?? KPI_MIN_HEIGHT))
    : 0;

  const row2Height = kpiRow2.length
    ? Math.max(...kpiRow2.map(k => k.height ?? KPI_MIN_HEIGHT))
    : 0;

  const kpiTotalHeight =
    row1Height +
    (row2Height > 0 ? GAP_SMALL + row2Height : 0);

  const kpiBottom =
    kpis.length > 0
      ? kpiTop + kpiTotalHeight
      : kpiTop;

  // CHARTS
  const chartsTop =
    slicers.length === 0 && kpis.length === 0
      ? slicersTop
      : kpis.length > 0
        ? kpiBottom + GAP_KPI_TO_CHARTS
        : slicersBottom + GAP_KPI_TO_CHARTS;

  const chartsBottom = CANVAS_HEIGHT - MARGIN;
  const chartsHeight = chartsBottom - chartsTop;

  return {
    TITLE_Y,
    slicersTop,
    slicersBottom,
    kpiTop,
    kpiBottom,
    chartsTop,
    chartsBottom,
    chartsHeight,
    hasRow2
  };
}
