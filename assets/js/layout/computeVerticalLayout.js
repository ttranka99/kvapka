import * as state from "../state/state.js";
import { computeChartGroups } from "./chartGroups.js";
import { computeChartRowHeights } from "./computeChartRowHeights.js";

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
function boundaryGap(stack, i, vertical) {
  const entry = stack[i];
  if (entry.gapBefore === "small") return state.GAP_SMALL;
  if (entry.gapBefore === "block") return state.GAP_KPI_TO_CHARTS;

  const chartsAbove = stack.slice(0, i).some(s => s.type === "charts");
  if (chartsAbove) return state.GAP_KPI_TO_CHARTS;
  if (vertical) return i === 1 ? state.GAP_KPI_TO_CHARTS : state.GAP_SMALL;
  return entry.type === "charts" ? state.GAP_KPI_TO_CHARTS : state.GAP_SMALL;
}

// A KPI band's height: normally split across two rows capped at
// MAX_KPIS/SECOND_ROW_MAX_ITEMS (the header band always has), or kept to a
// single row when the section says otherwise (the classic "second" band,
// which exists purely to interrupt the chart area and so never grows a
// second row of its own).
function measureKpiHeight(cards, allowSecondRow) {
  if (cards.length === 0) return 0;
  if (!allowSecondRow) {
    return Math.max(...cards.map(k => k.height ?? state.KPI_MIN_HEIGHT));
  }
  const row1 = cards.slice(0, state.MAX_KPIS);
  const row2 = cards.length > state.MAX_KPIS
    ? cards.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS)
    : [];
  const row1Height = row1.length ? Math.max(...row1.map(k => k.height ?? state.KPI_MIN_HEIGHT)) : 0;
  const row2Height = row2.length ? Math.max(...row2.map(k => k.height ?? state.KPI_MIN_HEIGHT)) : 0;
  return row1Height + (row2Height > 0 ? state.GAP_SMALL + row2Height : 0);
}

// Walks a slice of `sections`, dropping the ones that occupy no space and
// attaching each survivor's measured height (or, for a charts section, the
// row group it claimed). `kpiInfoBySectionId` and `chartGroupBySectionId`
// are computed once up front in computeVerticalLayout() and passed in so
// every ordinal/row assignment stays consistent between the two slices
// (title/slicers/kpi-1, and the chart region) this function is called on.
function buildEffectiveStack(sectionsSlice, ctx) {
  const { vertical, slicers, hasRow2, kpiInfoBySectionId, chartGroupBySectionId } = ctx;
  const out = [];
  sectionsSlice.forEach(s => {
    if (s.type === "title") {
      out.push({ ...s, height: state.TITLE_HEIGHT });
      return;
    }
    if (s.type === "slicers") {
      if (vertical || slicers.length === 0) return;
      const height = hasRow2 ? state.SLICER_HEIGHT * 2 + state.GAP_SMALL : state.SLICER_HEIGHT;
      out.push({ ...s, height });
      return;
    }
    if (s.type === "kpi") {
      const info = kpiInfoBySectionId.get(s.id);
      const cards = info ? info.cards : [];
      if (cards.length === 0) return;
      out.push({ ...s, height: measureKpiHeight(cards, s.allowSecondRow), cards });
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
//
// `band2` (optional: { row, reserved }) is the legacy second-KPI-band notch
// — see the block comment where it's computed in computeVerticalLayout().
// It isn't a stack entry of its own (nothing here reflects it in
// `sections`), so the one row it sits below needs its usual advance to the
// next row widened by `reserved` to leave the band room. `reserved` already
// nets out the GAP_SMALL a plain row-to-row boundary would have contributed
// (see the comment there), so it's simply added on top of the normal
// per-row advance rather than replacing it.
function placeStack(effectiveStack, startY, vertical, rowHeights, rowTops, band2 = null) {
  let y = startY;
  const placed = [];
  effectiveStack.forEach((entry, i) => {
    if (i > 0) y += boundaryGap(effectiveStack, i, vertical);
    const top = y;
    let height;
    if (entry.type === "charts") {
      const { startRow, count } = entry.group;
      let rowY = top;
      for (let r = 0; r < count; r++) {
        const rowIndex = startRow + r;
        rowTops[rowIndex] = rowY;
        rowY += rowHeights[rowIndex] + (r < count - 1 ? state.GAP_SMALL : 0);
        if (band2 && rowIndex === band2.row) rowY += band2.reserved;
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

export function computeVerticalLayout() {
  const slicers = state.getSlicers();
  const kpis = state.getKpis();
  const kpis2 = state.getKpis2();
  const chartRows = state.getChartRows();

  const vertical = state.isVerticalSlicers();
  const sections = state.activeTheme.sections;

  // TITLE
  const TITLE_Y = state.MARGIN;

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
    // tighter GAP_SMALL the horizontal band sits at.
    ? TITLE_Y + state.TITLE_HEIGHT + state.GAP_KPI_TO_CHARTS
    : TITLE_Y + state.TITLE_HEIGHT + state.GAP_SMALL;

  const hasRow2 = !vertical && slicers.length > state.MAX_SLICERS;

  const slicersBottom = vertical || slicers.length === 0
    ? slicersTop
    : hasRow2
      ? slicersTop + state.SLICER_HEIGHT * 2 + state.GAP_SMALL
      : slicersTop + state.SLICER_HEIGHT;

  // The slicer column reserves width only while slicers actually exist —
  // otherwise an empty page would permanently lose ~320px of canvas to a
  // column with nothing in it.
  const hasColumn = vertical && slicers.length > 0;
  const slicerColumnTop = slicersTop;
  const slicerColumnBottom = state.CANVAS_HEIGHT - state.MARGIN;
  const slicerColumnHeight = slicerColumnBottom - slicerColumnTop;

  // The box the KPIs and charts lay out inside. In horizontal mode this is
  // just the full usable width at the standard margin; in vertical mode it
  // starts to the right of the slicer column. Every KPI/chart solver reads
  // these two instead of state.MARGIN / state.USABLE_WIDTH so neither mode
  // needs a special case of its own.
  const contentLeft = hasColumn
    ? state.MARGIN + state.SLICER_COLUMN_WIDTH + state.GAP_KPI_TO_CHARTS
    : state.MARGIN;
  const contentWidth = state.CANVAS_WIDTH - state.MARGIN - contentLeft;

  // --- shared bookkeeping ---------------------------------------------
  //
  // kpi sections read the legacy arrays positionally: the first one is
  // state.kpis, the second state.kpis2, anything past that is empty (and so
  // always drops out of the stack). A later stage generalises per-section
  // content; until then this ordinal mapping *is* what "the second KPI
  // band" means. Computed once, up front, so both the prefix (title/
  // slicers/header KPI) and interior (chart region) walks below agree on
  // it regardless of which slice of `sections` they each see.
  const kpiInfoBySectionId = new Map();
  {
    let ord = 0;
    sections.forEach(s => {
      if (s.type !== "kpi") return;
      const cards = ord === 0 ? kpis : ord === 1 ? kpis2 : [];
      kpiInfoBySectionId.set(s.id, { cards, ordinal: ord });
      ord++;
    });
  }

  const chartsSections = sections.filter(s => s.type === "charts");
  const chartGroups = computeChartGroups(chartsSections, chartRows.length);
  const chartGroupBySectionId = new Map(chartGroups.map(g => [g.sectionId, g]));

  const ctx = { vertical, slicers, hasRow2, kpiInfoBySectionId, chartGroupBySectionId };

  // The stack splits cleanly in two at the first charts section (there's
  // always at least one — normalizeSections() guarantees it): everything
  // above it is the title/slicers/header-KPI prefix, unaffected by anything
  // that happens inside the chart region; everything from it on is the
  // region itself, which the row solver and any KPI bands interrupting it
  // (the "second" band) share.
  const firstChartsIndex = sections.findIndex(s => s.type === "charts");
  const prefixSections = sections.slice(0, firstChartsIndex);
  const interiorSections = sections.slice(firstChartsIndex);

  const prefixEffective = buildEffectiveStack(prefixSections, ctx);
  const { placed: placedPrefix, endY: prefixEnd } = placeStack(
    prefixEffective, state.MARGIN, vertical, [], []
  );

  // kpiTop/kpiBottom describe the header KPI band's nominal position and
  // are kept as their own formula rather than read off
  // `sectionById["kpi-1"]`: the legacy contract gives them a value even
  // when state.kpis is empty and the section was dropped from the prefix
  // entirely (nothing renders there, but downstream code still reads
  // kpiTop as "where the header band would start"). When the section *is*
  // active the two agree by construction — both apply the same
  // boundary-gap rule to the same position.
  const contentTop = vertical
    ? TITLE_Y + state.TITLE_HEIGHT + state.GAP_KPI_TO_CHARTS
    : slicers.length === 0
      ? TITLE_Y + state.TITLE_HEIGHT + state.GAP_SMALL
      : slicersBottom + state.GAP_SMALL;
  const kpiTop = contentTop;
  const kpiRow1 = kpis.slice(0, state.MAX_KPIS);
  const kpiRow2 = kpis.length > state.MAX_KPIS
    ? kpis.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS)
    : [];
  const row1Height = kpiRow1.length
    ? Math.max(...kpiRow1.map(k => k.height ?? state.KPI_MIN_HEIGHT))
    : 0;
  const row2Height = kpiRow2.length
    ? Math.max(...kpiRow2.map(k => k.height ?? state.KPI_MIN_HEIGHT))
    : 0;
  const kpiTotalHeight = row1Height + (row2Height > 0 ? state.GAP_SMALL + row2Height : 0);
  const kpiBottom = kpis.length > 0 ? kpiTop + kpiTotalHeight : kpiTop;

  // The boundary between the prefix and the chart region uses the same
  // gap rule as any other, evaluated as though the first charts section
  // (present or not — it may yet claim zero rows) sat right after the
  // prefix. This is what keeps chartsTop meaningful even when nothing
  // actually renders there (chartRows.length === 0): exactly the position
  // a chart row would start at, matching the legacy formula, which never
  // depended on the row count either.
  const firstInteriorSection = interiorSections[0];
  const gapToInterior = boundaryGap(
    [...prefixEffective, { ...firstInteriorSection, type: "charts" }],
    prefixEffective.length,
    vertical
  );
  const chartsTop = prefixEnd + gapToInterior;
  const chartsBottom = state.CANVAS_HEIGHT - state.MARGIN;

  const interiorEffective = buildEffectiveStack(interiorSections, ctx);

  let interiorFixed = 0;
  let interiorGaps = 0;
  let activeChartGroupCount = 0;
  interiorEffective.forEach((entry, i) => {
    if (i > 0) interiorGaps += boundaryGap(interiorEffective, i, vertical);
    if (entry.type === "charts") activeChartGroupCount++;
    else interiorFixed += entry.height;
  });

  // --- the second-KPI-band legacy fields ----------------------------------
  //
  // theme.sections doesn't carry this band — normalizeTheme() only ever
  // synthesizes a kpi-2/charts-2 split from theme.kpiBand2 the first time a
  // theme has no `sections` of its own at all; a theme (or a live draft)
  // that already has `sections` keeps them untouched even if kpiBand2 is
  // toggled afterward. So for as long as that's true, this band is real but
  // invisible to the walk above: read straight from the legacy state, exactly
  // as it always was, and folded into the chart region's budget as its own
  // carved-out notch rather than a stack entry.
  const band2Active = state.hasKpiBand2() && kpis2.length > 0;
  const band2Row = band2Active ? state.kpiBand2AfterRow() : -1;
  const kpiBand2Height = band2Active
    ? Math.max(...kpis2.map(k => k.height ?? state.KPI_MIN_HEIGHT))
    : 0;

  // How much height the band costs the chart rows. Landing *between* two
  // rows it replaces the small gap that boundary already had, so only the
  // difference comes out of the rows' budget; landing below the last row
  // there is no gap to replace and it costs its own height plus one block
  // gap above it.
  const kpiBand2Reserved = !band2Active
    ? 0
    : chartRows.length === 0
      ? kpiBand2Height
      : band2Row < chartRows.length - 1
        ? kpiBand2Height + 2 * state.GAP_KPI_TO_CHARTS - state.GAP_SMALL
        : kpiBand2Height + state.GAP_KPI_TO_CHARTS;

  // The rows' shared budget: everything left in the chart region once its
  // own fixed content (a KPI section actually present in the walk, plus the
  // legacy band2 notch above) and the gaps around it are taken out.
  // chartRowGapCount only counts the gaps *within* a chart group — the gaps
  // between groups are already in interiorGaps above — which is exactly why
  // computeChartRowHeights needs it instead of assuming every row is n-1
  // gaps apart.
  const chartsHeightBudget = chartsBottom - chartsTop - interiorFixed - interiorGaps - kpiBand2Reserved;
  const chartRowGapCount = chartRows.length - activeChartGroupCount;

  const rowHeights = computeChartRowHeights({
    chartsHeight: chartsHeightBudget,
    chartRowGapCount
  });

  const rowTops = new Array(chartRows.length).fill(0);
  const { placed: placedInterior } = placeStack(
    interiorEffective, chartsTop, vertical, rowHeights, rowTops,
    band2Active ? { row: band2Row, reserved: kpiBand2Reserved } : null
  );

  const placed = placedPrefix.concat(placedInterior);
  const sectionById = Object.fromEntries(placed.filter(s => s.id).map(s => [s.id, s]));

  const chartsHeight = chartsBottom - chartsTop - interiorFixed - interiorGaps - kpiBand2Reserved;

  return {
    TITLE_Y,
    slicersTop,
    slicersBottom,
    slicerColumnTop,
    slicerColumnBottom,
    slicerColumnHeight,
    slicerColumnWidth: state.SLICER_COLUMN_WIDTH,
    hasColumn,
    contentLeft,
    contentWidth,
    kpiTop,
    kpiBottom,
    chartsTop,
    chartsBottom,
    chartsHeight,
    hasRow2,
    kpiBand2Height,

    // New in the section-walk rewrite.
    sections: placed,
    sectionById,
    rowTops,
    rowHeights,
    chartGroups,
    chartRowGapCount
  };
}
