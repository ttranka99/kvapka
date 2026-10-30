// assets/js/state/state.js
//
// Live layout state, plus the constants every solver reads.
//
// The constants are projected from a *theme* (assets/js/theme/themeModel.js),
// a JSON object the user can edit, save and share. ES module bindings are
// live views, and every consumer reads them at call time (`state.GAP_SMALL`,
// or a named import used inside a function), never at module load. So
// anything a theme can change is a `let` assigned by applyTheme().

import {
  normalizeTheme,
  cloneTheme,
  BUILTIN_THEMES,
  isVerticalPlacement,
  sideOfPlacement
} from "../theme/themeModel.js";
import { getTheme } from "../theme/themeStore.js";
import { setStep, snapToStep } from "../layout/sizeStep.js";
import { addWarning } from "../ui/warnings.js";
import { t } from "../i18n/i18n.js";

export let activeTheme = normalizeTheme(BUILTIN_THEMES[0]);
export let activeTemplate = activeTheme.id;

export let CANVAS_WIDTH = activeTheme.canvasWidth;
export let CANVAS_HEIGHT = activeTheme.canvasHeight;
export let MARGIN = activeTheme.margin;
export let TITLE_HEIGHT = activeTheme.titleHeight;
export let GAP_SMALL = activeTheme.gapSmall;
export let GAP_KPI_TO_CHARTS = activeTheme.gapKpiToCharts;
export let SLICER_HEIGHT = activeTheme.slicerHeight;
// Horizontal band: the height every slicer in the band shares (both rows).
// A page value like SLICER_COLUMN_WIDTH, never below SLICER_HEIGHT.
export let SLICER_ROW_HEIGHT = activeTheme.slicerHeight;
// Vertical-slicer mode: slicers stack in one fixed-width column instead of a
// horizontal band under the title. SLICER_HEIGHT is still the per-slicer
// *minimum* (and default) height.
export let SLICER_COLUMN_WIDTH = activeTheme.slicerColumnWidth;
export let MIN_SLICER_COLUMN_WIDTH = activeTheme.minSlicerColumnWidth;
export let MAX_SLICER_COLUMN_WIDTH = activeTheme.maxSlicerColumnWidth;
// Once the minimum-height stack fills this much of the column, unlocked
// slicers stretch to fill it, since a nearly full column with a ragged empty
// tail looks like a bug.
export let SLICER_FILL_THRESHOLD = activeTheme.slicerFillThreshold;
export let KPI_MIN_HEIGHT = activeTheme.kpiMinHeight;
export let MIN_SLICER_WIDTH = activeTheme.minSlicerWidth;
// KPIs have no theme minimum, so a fixed floor.
export const MIN_KPI_WIDTH = 50;
export let MIN_CHART_ROW_HEIGHT = activeTheme.minChartRowHeight;
export let MIN_CHART_WIDTH = activeTheme.minChartWidth;
// Absolute floor for a chart row or stacked cell when the usual minimums
// (MIN_CHART_ROW_HEIGHT and stack minimums) don't fit the charts area, e.g.
// many rows on HD. Rows still render within the canvas, and a warning tells
// the user they were shrunk below the normal minimum.
export let HARD_MIN_CHART_HEIGHT = activeTheme.hardMinChartHeight;
export let USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
export const SCALE = 0.4;
// The scale actually used for rendering: SCALE, shrunk if the viewport is too
// narrow for the canvas. Read by renderLayout.js (drawing) and
// chartResizeEvents.js (converting drag deltas back to px).
export let EFFECTIVE_SCALE = SCALE;
export let MIN_COMPONENTS_PER_ROW = activeTheme.minPerRow;
export let MAX_COMPONENTS_PER_ROW = activeTheme.maxPerRow;
export let SECOND_ROW_MAX_ITEMS = activeTheme.secondRowMaxItems;
export let MAX_SLICERS = activeTheme.defaultSlicersPerRow;
export let MAX_KPIS = activeTheme.defaultKpisPerRow;

// Both are read-only projections of the active theme's `placement`, assigned
// only by applyTheme(). Orientation is part of the layout's identity, so
// changing it means choosing a different theme. There is deliberately no
// setter for either.
export let slicerOrientation = isVerticalPlacement(activeTheme.placement) ? "vertical" : "horizontal";
export let SLICER_SIDE = sideOfPlacement(activeTheme.placement);

export let slicers = [];
// KPI cards, keyed by the id of the `kpi` section (in theme.sections) they
// belong to. Each band a theme defines gets one entry. Switching between
// themes with different band counts is handled by applyTheme() (see
// reconcileKpiBands below).
export let kpiBands = {};
// Each KPI band's shared card height (both rows of a two-row band), keyed
// like kpiBands. A page value like SLICER_ROW_HEIGHT; a missing entry means
// KPI_MIN_HEIGHT.
export let kpiBandHeights = {};
export let chartRows = [];
export let selectedElement = null;
export let warnings = [];

export function setSlicers(v) { slicers = v; }
export function getKpiBand(id) { return kpiBands[id] || []; }
export function setKpiBands(v) { kpiBands = v; }
export function setKpiBand(id, list) { kpiBands = { ...kpiBands, [id]: list }; }
/** Ids of the theme's `kpi` sections, in `sections` order. */
export function kpiBandIds() {
  return activeTheme.sections.filter(s => s.type === "kpi").map(s => s.id);
}
export function setChartRows(v) { chartRows = v; }
export function setSelectedElement(v) { selectedElement = v; }
export function setWarnings(v) { warnings = v; }
export function setEffectiveScale(v) { EFFECTIVE_SCALE = v; }

export function isVerticalSlicers() { return slicerOrientation === "vertical"; }

export function setSlicerColumnWidth(v) {
  SLICER_COLUMN_WIDTH = Math.min(
    MAX_SLICER_COLUMN_WIDTH,
    Math.max(MIN_SLICER_COLUMN_WIDTH, v)
  );
}

export function setSlicerRowHeight(v) {
  SLICER_ROW_HEIGHT = Number.isFinite(v) ? Math.max(SLICER_HEIGHT, snapToStep(v)) : SLICER_HEIGHT;
}

export function kpiBandHeight(id) {
  return kpiBandHeights[id] ?? KPI_MIN_HEIGHT;
}

// Never below KPI_MIN_HEIGHT. A non-number drops the entry (the default).
export function setKpiBandHeight(id, v) {
  const next = { ...kpiBandHeights };
  if (Number.isFinite(v)) next[id] = Math.max(KPI_MIN_HEIGHT, snapToStep(v));
  else delete next[id];
  kpiBandHeights = next;
}

// Loads a page's heights. Only the active theme's KPI bands are kept.
export function setKpiBandHeights(map) {
  kpiBandHeights = {};
  if (!map || typeof map !== "object") return;
  kpiBandIds().forEach(id => {
    if (Object.prototype.hasOwnProperty.call(map, id)) setKpiBandHeight(id, map[id]);
  });
}

function clampComponentsPerRow(v) {
  const value = Number.parseInt(v, 10);
  if (Number.isNaN(value)) return MAX_COMPONENTS_PER_ROW;
  return Math.min(MAX_COMPONENTS_PER_ROW, Math.max(MIN_COMPONENTS_PER_ROW, value));
}

export function setMaxSlicers(v) {
  MAX_SLICERS = clampComponentsPerRow(v);
}

export function setMaxKpis(v) {
  MAX_KPIS = clampComponentsPerRow(v);
}

/**
 * Projects a theme onto every constant the solvers read. It is the only
 * place these bindings are assigned wholesale.
 *
 * Per-row limits always reset to the theme's defaults, because a limit of 7
 * carried onto a theme that caps rows at 5 would be out of range. A caller
 * that needs a page's own values (the tab restore in tabs.js) re-applies
 * them afterwards.
 *
 * Orientation and side are derived from the theme's placement, and nothing
 * else can set them.
 */
export function applyTheme(theme) {
  const t = normalizeTheme(theme);
  const oldSections = activeTheme.sections;
  const oldKpiBands = kpiBands;

  activeTheme = t;
  activeTemplate = t.id;

  CANVAS_WIDTH = t.canvasWidth;
  CANVAS_HEIGHT = t.canvasHeight;
  MARGIN = t.margin;
  TITLE_HEIGHT = t.titleHeight;
  GAP_SMALL = t.gapSmall;
  GAP_KPI_TO_CHARTS = t.gapKpiToCharts;
  SLICER_HEIGHT = t.slicerHeight;
  MIN_SLICER_WIDTH = t.minSlicerWidth;
  MIN_SLICER_COLUMN_WIDTH = t.minSlicerColumnWidth;
  MAX_SLICER_COLUMN_WIDTH = t.maxSlicerColumnWidth;
  // Reset to the theme's default, not the width dragged under the previous
  // theme: 290px is over a fifth of the HD canvas, and the min/max bounds
  // change with the theme.
  SLICER_COLUMN_WIDTH = t.slicerColumnWidth;
  // Same for the band heights: their minimums come from the theme.
  SLICER_ROW_HEIGHT = t.slicerHeight;
  kpiBandHeights = {};
  SLICER_FILL_THRESHOLD = t.slicerFillThreshold;
  KPI_MIN_HEIGHT = t.kpiMinHeight;
  MIN_CHART_ROW_HEIGHT = t.minChartRowHeight;
  MIN_CHART_WIDTH = t.minChartWidth;
  HARD_MIN_CHART_HEIGHT = t.hardMinChartHeight;
  USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;

  MIN_COMPONENTS_PER_ROW = t.minPerRow;
  MAX_COMPONENTS_PER_ROW = t.maxPerRow;
  SECOND_ROW_MAX_ITEMS = t.secondRowMaxItems;

  setStep(t.step);

  MAX_SLICERS = clampComponentsPerRow(t.defaultSlicersPerRow);
  MAX_KPIS = clampComponentsPerRow(t.defaultKpisPerRow);

  slicerOrientation = isVerticalPlacement(t.placement) ? "vertical" : "horizontal";
  SLICER_SIDE = sideOfPlacement(t.placement);

  kpiBands = reconcileKpiBands(oldSections, t.sections, oldKpiBands);

  return activeTheme;
}

/**
 * Carries a page's KPI cards across a theme switch, whatever number of `kpi`
 * sections each theme has. Rules tried in order for every band in the *new*
 * theme:
 *
 *   1. id match: the same section id existed before, so keep its cards
 *      (the common case).
 *   2. positional fallback: the Nth unmatched new band takes the Nth
 *      unmatched old band's cards. This keeps the header KPIs when two
 *      unrelated themes have different ids.
 *   3. seed: a band with nothing yet gets `defaultCount` blanks, if that is
 *      above zero. The header band's default is 0 (initState.js starts it
 *      empty), so this only fires for a band meant to show cards at once.
 *
 * A fourth pass rehomes any *old* band nothing claimed: its cards move to
 * the nearest new band by position in the section list. They are dropped,
 * with a warning, only if the new theme has no KPI section at all.
 */
function reconcileKpiBands(oldSections, newSections, oldBands) {
  const oldKpiSections = oldSections.filter(s => s.type === "kpi");
  const newKpiSections = newSections.filter(s => s.type === "kpi");

  const next = {};
  const claimedOldIds = new Set();

  // 1. id match.
  newKpiSections.forEach(s => {
    if (oldKpiSections.some(o => o.id === s.id) && oldBands[s.id] !== undefined) {
      next[s.id] = oldBands[s.id];
      claimedOldIds.add(s.id);
    }
  });

  // 2. positional fallback.
  const unmatchedOld = oldKpiSections.filter(o => !claimedOldIds.has(o.id));
  const unmatchedNew = newKpiSections.filter(s => next[s.id] === undefined);
  unmatchedNew.forEach((s, i) => {
    const donor = unmatchedOld[i];
    if (donor && oldBands[donor.id] !== undefined) {
      next[s.id] = oldBands[donor.id];
      claimedOldIds.add(donor.id);
    }
  });

  // 3. seed.
  newKpiSections.forEach(s => {
    if (next[s.id] !== undefined) return;
    next[s.id] = s.defaultCount > 0
      ? Array.from({ length: s.defaultCount }, () => ({ height: null, locked: false }))
      : [];
  });

  // 4. rehome orphans.
  oldKpiSections
    .filter(o => !claimedOldIds.has(o.id))
    .forEach(o => {
      const cards = oldBands[o.id];
      if (!cards || cards.length === 0) return;

      if (newKpiSections.length === 0) {
        addWarning(
          t("warnings.kpi.cardsDropped", { count: cards.length }),
          "warning"
        );
        return;
      }

      const oldIndex = oldSections.indexOf(o);
      let nearest = newKpiSections[0];
      let nearestDist = Infinity;
      newKpiSections.forEach(s => {
        const dist = Math.abs(newSections.indexOf(s) - oldIndex);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = s;
        }
      });
      next[nearest.id] = [...(next[nearest.id] || []), ...cards];
    });

  return next;
}

/**
 * Applies a theme by id (built-in or saved custom). Unknown ids are ignored,
 * so a page whose custom theme was deleted keeps what it renders now instead
 * of falling back to a default.
 */
export function setLayoutTemplate(templateKey) {
  const theme = getTheme(templateKey);
  if (!theme) return null;
  return applyTheme(theme);
}

export function getActiveTheme() { return cloneTheme(activeTheme); }

// --- Granular sizing-lock resets ---
//
// A full reset (resetSizingLocks) fits a theme switch, which changes both
// CANVAS_WIDTH (slicer/KPI/chart width locks) and CANVAS_HEIGHT (chart row
// height locks).
//
// Changing only "slicers per row" or "KPIs per row" leaves USABLE_WIDTH
// alone, so chart *widths* can't overflow. It can still shift chartsTop and
// chartsHeight, so chart *row heights* may need a reset. A blanket reset
// there wiped chart width locks for no reason, so each caller resets only
// what its change can invalidate.

export function resetSlicerSizingLocks() {
  slicers = slicers.map(s => ({ ...s, width: null, height: null, locked: false }));
}

export function resetKpiSizingLocks() {
  const next = {};
  for (const id of Object.keys(kpiBands)) {
    next[id] = kpiBands[id].map(k => ({ ...k, width: null, height: null, locked: false }));
  }
  kpiBands = next;
}

export function resetChartWidthLocks() {
  chartRows = chartRows.map(row => ({
    ...row,
    items: row.items.map(item => ({
      width: null,
      locked: false,
      // Stacks survive a width reset (only their sizing is reset), since
      // its triggers (per-row slicer/KPI count changes, theme switches) can't
      // invalidate a vertical stack.
      ...(item.stack ? { stack: item.stack.map(() => ({ height: null, locked: false })) } : {})
    }))
  }));
}

export function resetChartRowHeightLocks() {
  chartRows = chartRows.map(row => ({
    ...row,
    height: null,
    locked: false
  }));
}

// Full reset. Use when CANVAS_WIDTH or CANVAS_HEIGHT changed (a theme
// switch), which can invalidate every locked size.
export function resetSizingLocks() {
  resetSlicerSizingLocks();
  resetKpiSizingLocks();
  resetChartWidthLocks();
  resetChartRowHeightLocks();
}

// Getters for computeVerticalLayout
export function getSlicers() { return slicers; }
export function getChartRows() { return chartRows; }
