import {
  getSlicers,
  getKpis,
  getKpis2,
  getChartRows,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MARGIN,
  TITLE_HEIGHT,
  GAP_SMALL,
  GAP_KPI_TO_CHARTS,
  SLICER_HEIGHT,
  SLICER_COLUMN_WIDTH,
  KPI_MIN_HEIGHT,
  MAX_SLICERS,
  MAX_KPIS,
  SECOND_ROW_MAX_ITEMS,
  isVerticalSlicers,
  hasKpiBand2,
  kpiBand2AfterRow
} from "../state/state.js";

export function computeVerticalLayout() {
  const slicers = getSlicers();
  const kpis = getKpis();
  const kpis2 = getKpis2();
  const chartRows = getChartRows();

  const vertical = isVerticalSlicers();

  // TITLE
  const TITLE_Y = MARGIN;

  // SLICERS
  //
  // Horizontal: a full-width band under the title that pushes the KPI/chart
  // content down. Vertical: a fixed-width column down the left side that
  // takes width from that content instead, and consumes no vertical band at
  // all — so every band below is computed exactly as it would be with no
  // slicers present. That's deliberate: KPI and chart behaviour is meant to
  // be identical in both modes apart from the width they're given.
  const slicersTop = vertical
    // 30px (20px on HD) below the title, per the vertical spec — not the
    // tighter GAP_SMALL the horizontal band sits at.
    ? TITLE_Y + TITLE_HEIGHT + GAP_KPI_TO_CHARTS
    : TITLE_Y + TITLE_HEIGHT + GAP_SMALL;

  const hasRow2 = !vertical && slicers.length > MAX_SLICERS;

  const slicersBottom = vertical || slicers.length === 0
    ? slicersTop
    : hasRow2
      ? slicersTop + SLICER_HEIGHT * 2 + GAP_SMALL
      : slicersTop + SLICER_HEIGHT;

  // The slicer column reserves width only while slicers actually exist —
  // otherwise an empty page would permanently lose ~320px of canvas to a
  // column with nothing in it.
  const hasColumn = vertical && slicers.length > 0;
  const slicerColumnTop = slicersTop;
  const slicerColumnBottom = CANVAS_HEIGHT - MARGIN;
  const slicerColumnHeight = slicerColumnBottom - slicerColumnTop;

  // The box the KPIs and charts lay out inside. In horizontal mode this is
  // just the full usable width at the standard margin; in vertical mode it
  // starts to the right of the slicer column. Every KPI/chart solver reads
  // these two instead of state.MARGIN / state.USABLE_WIDTH so neither mode
  // needs a special case of its own.
  const contentLeft = hasColumn
    ? MARGIN + SLICER_COLUMN_WIDTH + GAP_KPI_TO_CHARTS
    : MARGIN;
  const contentWidth = CANVAS_WIDTH - MARGIN - contentLeft;

  // The vertical band the content starts at. With a vertical (or absent)
  // slicer band there's nothing above it but the title.
  //
  // In vertical mode the KPIs and charts read as one block of visuals sitting
  // beside the slicer column, so the content starts on exactly the same line
  // the column does (GAP_KPI_TO_CHARTS below the title) rather than at the
  // tighter GAP_SMALL a horizontal slicer band uses.
  const contentTop = vertical
    ? TITLE_Y + TITLE_HEIGHT + GAP_KPI_TO_CHARTS
    : slicers.length === 0
      ? TITLE_Y + TITLE_HEIGHT + GAP_SMALL
      : slicersBottom + GAP_SMALL;

  // KPI
  const kpiTop = contentTop;

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
  // With nothing above them but the title the charts use the same
  // title-to-content gap as the KPI-to-charts spacing (30px on FULL HD,
  // 20px on HD) rather than the tighter GAP_SMALL.
  //
  // The KPI-to-charts gap is the mirror of contentTop above: horizontally the
  // KPIs are their own band separated from the charts by the wide gap, while
  // vertically they're the top of one content block, so the charts follow at
  // the tight GAP_SMALL instead.
  const chartsTop =
    kpis.length > 0
      ? kpiBottom + (vertical ? GAP_SMALL : GAP_KPI_TO_CHARTS)
      : (vertical || slicers.length === 0)
        ? TITLE_Y + TITLE_HEIGHT + GAP_KPI_TO_CHARTS
        : slicersBottom + GAP_KPI_TO_CHARTS;

  const chartsBottom = CANVAS_HEIGHT - MARGIN;

  // SECOND KPI BAND
  //
  // A band the theme can place *between* two chart rows instead of under the
  // header. It is carved out of the chart area rather than added below it, so
  // the layout still ends exactly at the bottom margin: the rows share
  // whatever is left after the band and its two block gaps are taken out.
  //
  // Only its height is settled here. Where it actually lands depends on the
  // solved row heights, which are computed one layer up — see
  // kpiBand2Top() in computeKpiBand2.js.
  const band2Active = hasKpiBand2() && kpis2.length > 0;
  const band2Row = band2Active ? kpiBand2AfterRow() : -1;
  const kpiBand2Height = band2Active
    ? Math.max(...kpis2.map(k => k.height ?? KPI_MIN_HEIGHT))
    : 0;

  // How much height the band costs the chart rows. Landing *between* two rows
  // it replaces the small gap that boundary already had, so only the
  // difference comes out of the rows' budget; landing below the last row
  // there is no gap to replace and it costs its own height plus the one block
  // gap above it. Getting this wrong leaves the layout short of (or over) the
  // bottom margin by exactly one gap.
  const kpiBand2Reserved = !band2Active
    ? 0
    : chartRows.length === 0
      ? kpiBand2Height
      : band2Row < chartRows.length - 1
        ? kpiBand2Height + 2 * GAP_KPI_TO_CHARTS - GAP_SMALL
        : kpiBand2Height + GAP_KPI_TO_CHARTS;

  const chartsHeight = chartsBottom - chartsTop - kpiBand2Reserved;

  return {
    TITLE_Y,
    slicersTop,
    slicersBottom,
    slicerColumnTop,
    slicerColumnBottom,
    slicerColumnHeight,
    slicerColumnWidth: SLICER_COLUMN_WIDTH,
    hasColumn,
    contentLeft,
    contentWidth,
    kpiTop,
    kpiBottom,
    chartsTop,
    chartsBottom,
    chartsHeight,
    hasRow2,
    band2Active,
    kpiBand2Height,
    kpiBand2Reserved,
    kpiBand2AfterRow: band2Row
  };
}
