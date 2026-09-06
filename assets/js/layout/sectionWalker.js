// assets/js/layout/sectionWalker.js
//
// The single authority on where a theme's sections land, extracted out of
// computeVerticalLayout() so the canvas solver and the theme editor's
// preview share one implementation instead of two that can drift apart.
// Pure: every number it needs comes in through `theme` (a normalized theme
// object — canvasWidth, margin, gapSmall, ... — live or draft) and `content`
// (a description of what's actually being placed this time — how many
// slicers, which KPI cards, how many chart rows). No reads of `state`.

// The KPI/chart content box left by a vertical slicer column of the given
// width, on the given side, for the given theme's canvas/margin/gap. Shared
// by computeVerticalLayout() (for the live column width) and
// slicerColumnResizeEvents.js (for a width not yet committed, mid-drag).
export function contentBoxFor(theme, columnWidth, side) {
  const right = side === "right";
  const contentLeft = right ? theme.margin : theme.margin + columnWidth + theme.gapKpiToCharts;
  const contentWidth = theme.canvasWidth - theme.margin - contentLeft
    - (right ? columnWidth + theme.gapKpiToCharts : 0);
  return { contentLeft, contentWidth };
}

// The gap immediately above stack index `i` (i >= 1) of an *effective*
// stack — one that's already dropped every section occupying no space, so
// "does a charts section sit above this boundary" and "is this boundary
// directly before a charts section" both read straight off it.
//
//   1. any charts section strictly above the boundary -> the wide block gap
//      (once charts have started, everything below reads as one region);
//   2. a vertical slicer column only widens the very first boundary (title
//      to content) to the block gap — everything else inside that one
//      visual block stays tight;
//   3. otherwise: tight, unless the section starting here IS a charts group
//      (the KPI-to-charts gap the horizontal layout has always used).
//
// An explicit gapBefore ("small"/"block") on the section overrides all of
// this outright.
function boundaryGap(theme, stack, i, vertical) {
  const entry = stack[i];
  if (entry.gapBefore === "small") return theme.gapSmall;
  if (entry.gapBefore === "block") return theme.gapKpiToCharts;

  const chartsAbove = stack.slice(0, i).some(s => s.type === "charts");
  if (chartsAbove) return theme.gapKpiToCharts;
  if (vertical) return i === 1 ? theme.gapKpiToCharts : theme.gapSmall;
  return entry.type === "charts" ? theme.gapKpiToCharts : theme.gapSmall;
}

// A KPI band's height: normally split across two rows capped at
// kpisPerRow/secondRowMaxItems (the header band always has), or kept to a
// single row when the section says otherwise (the classic "second" band,
// which exists purely to interrupt the chart area and so never grows a
// second row of its own).
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

// Walks a slice of `sections`, dropping the ones that occupy no space and
// attaching each survivor's measured height (or, for a charts section, the
// row group it claimed). `kpiInfoBySectionId` and `chartGroupBySectionId`
// are computed once up front in walkSections() and passed in so every
// ordinal/row assignment stays consistent between the two slices (title/
// slicers/kpi-1, and the chart region) this function is called on.
function buildEffectiveStack(theme, sectionsSlice, ctx) {
  const { vertical, slicerCount, hasRow2, kpisPerRow, kpiInfoBySectionId, chartGroupBySectionId } = ctx;
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
      const info = kpiInfoBySectionId.get(s.id);
      const cards = info ? info.cards : [];
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

// Places an already-built effective stack starting at `startY`, applying
// boundaryGap() between consecutive entries. Charts entries are expanded
// into their rows (using the already-solved `rowHeights`) and write into
// `rowTops`; every other entry just occupies its measured height.
function placeStack(theme, effectiveStack, startY, vertical, rowHeights, rowTops) {
  let y = startY;
  const placed = [];
  effectiveStack.forEach((entry, i) => {
    if (i > 0) y += boundaryGap(theme, effectiveStack, i, vertical);
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
    placed.push({ ...entry, top, bottom: y, height });
  });
  return { placed, endY: y };
}

/**
 * Walks `theme.sections` and places every one of them, given a description
 * of the content actually being laid out this time.
 *
 * @param {object} theme - a normalized theme (live or draft).
 * @param {object} content
 * @param {number} content.slicerCount - how many slicers exist.
 * @param {number} content.slicersPerRow - the per-row cap that decides
 *   whether the horizontal slicer band needs a second row.
 * @param {number} content.kpisPerRow - the per-row cap that decides whether
 *   a KPI band needs a second row.
 * @param {Map<string, Array>} content.kpiCardsBySectionId - a `kpi`
 *   section's id -> its cards (each needing at most a `.height`).
 * @param {number} content.chartRowCount - how many chart rows exist.
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
  // Horizontal: a full-width band under the title that pushes the KPI/chart
  // content down. Vertical: a fixed-width column down the left side that
  // takes width from that content instead, and consumes no vertical band at
  // all — so every band below is computed exactly as it would be with no
  // slicers present. These stay their own small formula rather than being
  // read off the walk below: the column sits *beside* the stack, never
  // inside it.
  const slicersTop = vertical
    // 30px (20px on HD) below the title, per the vertical spec — not the
    // tighter gapSmall the horizontal band sits at.
    ? TITLE_Y + theme.titleHeight + theme.gapKpiToCharts
    : TITLE_Y + theme.titleHeight + theme.gapSmall;

  const hasRow2 = !vertical && slicerCount > slicersPerRow;

  const slicersBottom = vertical || slicerCount === 0
    ? slicersTop
    : hasRow2
      ? slicersTop + theme.slicerHeight * 2 + theme.gapSmall
      : slicersTop + theme.slicerHeight;

  // The slicer column reserves width only while slicers actually exist —
  // otherwise an empty page would permanently lose ~320px of canvas to a
  // column with nothing in it.
  const hasColumn = vertical && slicerCount > 0;
  const slicerColumnTop = slicersTop;
  const slicerColumnBottom = theme.canvasHeight - theme.margin;
  const slicerColumnHeight = slicerColumnBottom - slicerColumnTop;

  // The box the KPIs and charts lay out inside. In horizontal mode this is
  // just the full usable width at the standard margin; in vertical mode it
  // sits beside the slicer column, on whichever side that column isn't.
  const { contentLeft, contentWidth } = hasColumn
    ? contentBoxFor(theme, columnWidth, slicerSide)
    : { contentLeft: theme.margin, contentWidth: theme.canvasWidth - 2 * theme.margin };

  // Where the column itself starts, independent of whether it's showing —
  // read by the renderer and the column resize handle so neither has to
  // re-derive "left or right" from slicerSide on their own.
  const slicerColumnLeft = slicerSide === "right"
    ? theme.canvasWidth - theme.margin - columnWidth
    : theme.margin;

  // --- shared bookkeeping ---------------------------------------------
  const kpiInfoBySectionId = new Map();
  {
    let ord = 0;
    sections.forEach(s => {
      if (s.type !== "kpi") return;
      kpiInfoBySectionId.set(s.id, { cards: kpiCardsBySectionId.get(s.id) || [], ordinal: ord });
      ord++;
    });
  }

  const chartsSections = sections.filter(s => s.type === "charts");
  // computeChartGroups is intentionally not imported here — the caller
  // (computeVerticalLayout / the preview) already needs to compute it to
  // know chartRowCount's split, so it's passed in fully formed rather than
  // recomputed.
  const chartGroups = content.chartGroups;
  const chartGroupBySectionId = new Map(chartGroups.map(g => [g.sectionId, g]));

  const ctx = { vertical, slicerCount, hasRow2, kpisPerRow, kpiInfoBySectionId, chartGroupBySectionId };

  // The stack splits cleanly in two at the first charts section (there's
  // always at least one — normalizeSections() guarantees it): everything
  // above it is the title/slicers/header-KPI prefix, unaffected by anything
  // that happens inside the chart region; everything from it on is the
  // region itself, which the row solver and any KPI bands interrupting it
  // (the "second" band) share.
  const firstChartsIndex = sections.findIndex(s => s.type === "charts");
  const prefixSections = sections.slice(0, firstChartsIndex);
  const interiorSections = sections.slice(firstChartsIndex);

  const prefixEffective = buildEffectiveStack(theme, prefixSections, ctx);
  const { placed: placedPrefix, endY: prefixEnd } = placeStack(
    theme, prefixEffective, theme.margin, vertical, [], []
  );

  // kpiTop/kpiBottom describe the header KPI band's nominal position and
  // are kept as their own formula rather than read off
  // `sectionById["kpi-1"]`: the legacy contract gives them a value even
  // when the header band's cards are empty and the section was dropped from
  // the prefix entirely (nothing renders there, but downstream code still
  // reads kpiTop as "where the header band would start"). When the section
  // *is* active the two agree by construction — both apply the same
  // boundary-gap rule to the same position.
  const contentTop = vertical
    ? TITLE_Y + theme.titleHeight + theme.gapKpiToCharts
    : slicerCount === 0
      ? TITLE_Y + theme.titleHeight + theme.gapSmall
      : slicersBottom + theme.gapSmall;
  const kpiTop = contentTop;
  const firstKpiSection = sections.find(s => s.type === "kpi");
  const kpis = firstKpiSection ? (kpiCardsBySectionId.get(firstKpiSection.id) || []) : [];
  const kpiRow1 = kpis.slice(0, kpisPerRow);
  const kpiRow2 = kpis.length > kpisPerRow
    ? kpis.slice(kpisPerRow, kpisPerRow + theme.secondRowMaxItems)
    : [];
  const row1Height = kpiRow1.length
    ? Math.max(...kpiRow1.map(k => k.height ?? theme.kpiMinHeight))
    : 0;
  const row2Height = kpiRow2.length
    ? Math.max(...kpiRow2.map(k => k.height ?? theme.kpiMinHeight))
    : 0;
  const kpiTotalHeight = row1Height + (row2Height > 0 ? theme.gapSmall + row2Height : 0);
  const kpiBottom = kpis.length > 0 ? kpiTop + kpiTotalHeight : kpiTop;

  // The boundary between the prefix and the chart region uses the same
  // gap rule as any other, evaluated as though the first charts section
  // (present or not — it may yet claim zero rows) sat right after the
  // prefix. This is what keeps chartsTop meaningful even when nothing
  // actually renders there (chartRowCount === 0): exactly the position a
  // chart row would start at, matching the legacy formula, which never
  // depended on the row count either.
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

  // The rows' shared budget: everything left in the chart region once its
  // own fixed content (any KPI sections actually present in the walk — a
  // second, third, ... band interrupting the charts is an ordinary stack
  // entry here, exactly like the header band above) and the gaps around it
  // are taken out. chartRowGapCount only counts the gaps *within* a chart
  // group — the gaps between groups are already in interiorGaps above —
  // which is exactly why the row solver needs it instead of assuming every
  // row is n-1 gaps apart.
  const chartsHeightBudget = chartsBottom - chartsTop - interiorFixed - interiorGaps;
  const chartRowGapCount = chartRowCount - activeChartGroupCount;

  const rowHeights = rowHeightSolver({
    chartsHeight: chartsHeightBudget,
    chartRowGapCount
  });

  const rowTops = new Array(chartRowCount).fill(0);
  const { placed: placedInterior } = placeStack(
    theme, interiorEffective, chartsTop, vertical, rowHeights, rowTops
  );

  const placed = placedPrefix.concat(placedInterior);
  const sectionById = Object.fromEntries(placed.filter(s => s.id).map(s => [s.id, s]));

  const chartsHeight = chartsBottom - chartsTop - interiorFixed - interiorGaps;

  return {
    TITLE_Y,
    slicersTop,
    slicersBottom,
    slicerColumnTop,
    slicerColumnBottom,
    slicerColumnHeight,
    slicerColumnWidth: columnWidth,
    slicerColumnLeft,
    slicerSide,
    hasColumn,
    contentLeft,
    contentWidth,
    kpiTop,
    kpiBottom,
    chartsTop,
    chartsBottom,
    chartsHeight,
    hasRow2,

    sections: placed,
    sectionById,
    rowTops,
    rowHeights,
    chartGroups,
    chartRowGapCount
  };
}
