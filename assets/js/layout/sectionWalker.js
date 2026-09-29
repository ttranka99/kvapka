// assets/js/layout/sectionWalker.js
//
// The single authority on where a theme's sections land. The canvas solver
// and the theme editor's preview share it so they can't drift apart.
// Pure, never reads `state`. Everything comes in through `theme` (a
// normalized theme, live or draft) and `content` (what is being placed:
// slicer count, KPI cards, chart rows).

// The KPI/chart content box left beside a vertical slicer column of the given
// width and side. Shared by computeVerticalLayout() (live width) and
// slicerColumnResizeEvents.js (uncommitted width, mid-drag).
export function contentBoxFor(theme, columnWidth, side) {
  const right = side === "right";
  const contentLeft = right ? theme.margin : theme.margin + columnWidth + theme.gapKpiToCharts;
  const contentWidth = theme.canvasWidth - theme.margin - contentLeft
    - (right ? columnWidth + theme.gapKpiToCharts : 0);
  return { contentLeft, contentWidth };
}

// The gap above stack index `i` (i >= 1) of an *effective* stack, i.e. one
// with all zero-space sections already dropped.
//
//   1. a charts section above the boundary: the wide block gap;
//   2. vertical slicer column: only the first boundary (title to content)
//      gets the block gap, the rest stay tight;
//   3. otherwise tight, unless the section here IS a charts group (the
//      KPI-to-charts gap).
//
// An explicit gapBefore ("small"/"block") on the section overrides all this.
function boundaryGap(theme, stack, i, vertical) {
  const entry = stack[i];
  if (entry.gapBefore === "small") return theme.gapSmall;
  if (entry.gapBefore === "block") return theme.gapKpiToCharts;

  const chartsAbove = stack.slice(0, i).some(s => s.type === "charts");
  if (chartsAbove) return theme.gapKpiToCharts;
  if (vertical) return i === 1 ? theme.gapKpiToCharts : theme.gapSmall;
  return entry.type === "charts" ? theme.gapKpiToCharts : theme.gapSmall;
}

// A KPI band's height. Up to two rows (capped by kpisPerRow and
// secondRowMaxItems) when allowSecondRow is set, as for the header band.
// Otherwise one row, as for the "second" band that interrupts the charts.
function measureKpiHeight(theme, kpisPerRow, cards, allowSecondRow) {
  if (cards.length === 0) return 0;
  if (!allowSecondRow) {
    return Math.max(...cards.map(k => k.height ?? theme.kpiMinHeight));
  }
  const row1 = cards.slice(0, kpisPerRow);
  const row2 = cards.length > kpisPerRow
    ? cards.slice(kpisPerRow, kpisPerRow + theme.secondRowMaxItems)
    : [];
  const row1Height = row1.length ? Math.max(...row1.map(k => k.height ?? theme.kpiMinHeight)) : 0;
  const row2Height = row2.length ? Math.max(...row2.map(k => k.height ?? theme.kpiMinHeight)) : 0;
  return row1Height + (row2Height > 0 ? theme.gapSmall + row2Height : 0);
}

// Walks a slice of `sections`, dropping those that take no space and adding
// each one's height (or, for charts, its row group). `chartGroupBySectionId`
// is built once in walkSections() so row assignment is consistent across the
// two slices this is called on (prefix and chart region).
function buildEffectiveStack(theme, sectionsSlice, ctx) {
  const { vertical, slicerCount, hasRow2, kpisPerRow, kpiCardsBySectionId, chartGroupBySectionId } = ctx;
  const out = [];
  sectionsSlice.forEach(s => {
    if (s.type === "title") {
      out.push({ ...s, height: theme.titleHeight });
      return;
    }
    if (s.type === "slicers") {
      if (vertical || slicerCount === 0) return;
      const height = hasRow2 ? theme.slicerHeight * 2 + theme.gapSmall : theme.slicerHeight;
      out.push({ ...s, height });
      return;
    }
    if (s.type === "kpi") {
      const cards = kpiCardsBySectionId.get(s.id) || [];
      if (cards.length === 0) return;
      out.push({ ...s, height: measureKpiHeight(theme, kpisPerRow, cards, s.allowSecondRow), cards });
      return;
    }
    if (s.type === "charts") {
      const group = chartGroupBySectionId.get(s.id);
      if (!group || group.count === 0) return;
      out.push({ ...s, group });
    }
  });
  return out;
}

// Places an effective stack from `startY`, with boundaryGap() between
// entries. Charts entries expand into rows (from the solved `rowHeights`) and
// write `rowTops`; other entries take their measured height.
//
// Each placed box records its applied gap as `gapAbove`, so consumers (the
// theme editor's gap rulers) don't re-derive it. `startGap` is the gap above
// the first entry: already included in `startY`, so recorded but not added
// again. null when nothing is above it.
function placeStack(theme, effectiveStack, startY, vertical, rowHeights, rowTops, startGap = null) {
  let y = startY;
  const placed = [];
  effectiveStack.forEach((entry, i) => {
    const gapAbove = i > 0 ? boundaryGap(theme, effectiveStack, i, vertical) : startGap;
    if (i > 0) y += gapAbove;
    const top = y;
    let height;
    if (entry.type === "charts") {
      const { startRow, count } = entry.group;
      let rowY = top;
      for (let r = 0; r < count; r++) {
        const rowIndex = startRow + r;
        rowTops[rowIndex] = rowY;
        rowY += rowHeights[rowIndex] + (r < count - 1 ? theme.gapSmall : 0);
      }
      height = rowY - top;
    } else {
      height = entry.height;
    }
    y = top + height;
    placed.push({ ...entry, top, bottom: y, height, gapAbove });
  });
  return { placed, endY: y };
}

/**
 * Walks `theme.sections` and places every one, given the content being
 * laid out.
 *
 * @param {object} theme - a normalized theme (live or draft).
 * @param {object} content
 * @param {number} content.slicerCount - how many slicers exist.
 * @param {number} content.slicersPerRow - per-row cap; more slicers than this
 *   need a second row in the horizontal band.
 * @param {number} content.kpisPerRow - per-row cap for a KPI band.
 * @param {Map<string, Array>} content.kpiCardsBySectionId - a `kpi`
 *   section's id -> its cards (each needs at most a `.height`).
 * @param {number} content.chartRowCount - how many chart rows exist.
 * @param {Array<{sectionId:string, startRow:number, count:number}>} content.chartGroups -
 *   computeChartGroups(chartsSections, chartRowCount). Required: the caller
 *   computes it anyway, so it is passed in, not recomputed.
 * @param {"horizontal"|"vertical"} content.orientation
 * @param {"left"|"right"} content.slicerSide
 * @param {number} content.columnWidth - the vertical slicer column's width.
 * @param {(v: {chartsHeight:number, chartRowGapCount:number}) => number[]} content.rowHeightSolver
 */
export function walkSections(theme, content) {
  const {
    slicerCount,
    slicersPerRow,
    kpisPerRow,
    kpiCardsBySectionId,
    chartRowCount,
    orientation,
    slicerSide,
    columnWidth,
    rowHeightSolver
  } = content;

  const vertical = orientation === "vertical";
  const sections = theme.sections;

  // TITLE
  const TITLE_Y = theme.margin;

  // SLICERS
  //
  // Horizontal: a full-width band that pushes the KPI/chart content down.
  // Vertical: a column at the side that takes width, not height, so the
  // bands below are laid out as if there were no slicers.
  // This is the *nominal* position, right below the title. It is used as-is
  // for the vertical column (never in the stack walk) and as the fallback
  // for an empty horizontal band. A rendered band is placed by the walk in
  // theme order, and the returned slicersTop uses that (see placedSlicers
  // near the end).
  const slicersTop = vertical
    // 30px (20px on HD) below the title, not the tighter gapSmall of the
    // horizontal band.
    ? TITLE_Y + theme.titleHeight + theme.gapKpiToCharts
    : TITLE_Y + theme.titleHeight + theme.gapSmall;

  const hasRow2 = !vertical && slicerCount > slicersPerRow;

  // The column reserves width only while slicers exist, so an empty page
  // doesn't lose ~320px to nothing.
  const hasColumn = vertical && slicerCount > 0;
  const slicerColumnTop = slicersTop;
  const slicerColumnHeight = theme.canvasHeight - theme.margin - slicerColumnTop;

  // The box KPIs and charts lay out in: the full usable width, or, in
  // vertical mode, the space beside the slicer column.
  const { contentLeft, contentWidth } = hasColumn
    ? contentBoxFor(theme, columnWidth, slicerSide)
    : { contentLeft: theme.margin, contentWidth: theme.canvasWidth - 2 * theme.margin };

  // Where the column starts, whether or not it's showing. The renderer and
  // the resize handle read it instead of deriving it from slicerSide.
  const slicerColumnLeft = slicerSide === "right"
    ? theme.canvasWidth - theme.margin - columnWidth
    : theme.margin;

  // --- shared bookkeeping ---------------------------------------------
  //
  // computeChartGroups is not imported here on purpose. The caller
  // (computeVerticalLayout or the preview) already has it.
  const chartGroupBySectionId = new Map(content.chartGroups.map(g => [g.sectionId, g]));

  const ctx = { vertical, slicerCount, hasRow2, kpisPerRow, kpiCardsBySectionId, chartGroupBySectionId };

  // The stack splits at the first charts section (normalizeSections()
  // guarantees one). Above it is the prefix (title, slicers, header KPI),
  // unaffected by the chart region. From it on is the chart region, shared by
  // the row solver and any KPI bands inside it (the "second" band).
  const firstChartsIndex = sections.findIndex(s => s.type === "charts");
  const prefixSections = sections.slice(0, firstChartsIndex);
  const interiorSections = sections.slice(firstChartsIndex);

  const prefixEffective = buildEffectiveStack(theme, prefixSections, ctx);
  const { placed: placedPrefix, endY: prefixEnd } = placeStack(
    theme, prefixEffective, theme.margin, vertical, [], []
  );

  // The prefix-to-charts gap uses the usual rule, as if the first charts
  // section (even one with zero rows) sat right after the prefix. So chartsTop
  // stays meaningful when nothing renders (chartRowCount === 0): it is where
  // a chart row would start.
  const firstInteriorSection = interiorSections[0];
  const gapToInterior = boundaryGap(
    theme,
    [...prefixEffective, { ...firstInteriorSection, type: "charts" }],
    prefixEffective.length,
    vertical
  );
  const chartsTop = prefixEnd + gapToInterior;
  const chartsBottom = theme.canvasHeight - theme.margin;

  const interiorEffective = buildEffectiveStack(theme, interiorSections, ctx);

  let interiorFixed = 0;
  let interiorGaps = 0;
  let activeChartGroupCount = 0;
  interiorEffective.forEach((entry, i) => {
    if (i > 0) interiorGaps += boundaryGap(theme, interiorEffective, i, vertical);
    if (entry.type === "charts") activeChartGroupCount++;
    else interiorFixed += entry.height;
  });

  // The rows' shared budget: the chart region minus its fixed content (KPI
  // bands inside it are ordinary stack entries) and the gaps around it.
  // chartRowGapCount counts only gaps *within* a chart group; gaps between
  // groups are already in interiorGaps. That is why the row solver needs it
  // instead of assuming n - 1 gaps.
  const chartsHeightBudget = chartsBottom - chartsTop - interiorFixed - interiorGaps;
  const chartRowGapCount = chartRowCount - activeChartGroupCount;

  const rowHeights = rowHeightSolver({
    chartsHeight: chartsHeightBudget,
    chartRowGapCount
  });

  const rowTops = new Array(chartRowCount).fill(0);
  const { placed: placedInterior } = placeStack(
    theme, interiorEffective, chartsTop, vertical, rowHeights, rowTops, gapToInterior
  );

  const placed = placedPrefix.concat(placedInterior);
  const sectionById = Object.fromEntries(placed.filter(s => s.id).map(s => [s.id, s]));

  // `slicersTop` above is *nominal*: where the band sits in the default
  // title, slicers, kpi, charts order. A band can be dragged elsewhere, so it
  // can differ from where the walk placed it. computeSlicersLayout reads
  // slicersTop, so this is the one place that reconciles the two.
  // A horizontal slicers section with slicers is always in `sectionById`.
  // The vertical column has no placed box (buildEffectiveStack() drops it,
  // since it sits beside the stack), so the nominal value, the column's own
  // top, is what we want.
  const slicersSectionDef = sections.find(s => s.type === "slicers");
  const placedSlicers = !vertical && slicersSectionDef ? sectionById[slicersSectionDef.id] : undefined;

  return {
    TITLE_Y,
    slicersTop: placedSlicers ? placedSlicers.top : slicersTop,
    slicerColumnTop,
    slicerColumnHeight,
    slicerColumnWidth: columnWidth,
    slicerColumnLeft,
    hasColumn,
    contentLeft,
    contentWidth,
    chartsTop,
    chartsHeight: chartsHeightBudget,

    sections: placed,
    sectionById,
    rowTops,
    rowHeights,
    chartRowGapCount
  };
}
