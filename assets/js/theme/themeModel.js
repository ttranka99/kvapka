// assets/js/theme/themeModel.js
//
// A *theme* is the set of layout constants the solvers read (margins, gaps,
// title band height, slicer/KPI minimums, per-row caps, the 5px grid step),
// plus the band stack (`sections`) and its `placement`, which sets the
// layout's shape.
//
// A theme is ONE layout in ONE placement. Horizontal and vertical layouts
// have different budgets (a slicer band costs height, a slicer column costs
// width), so "FULL HD" horizontal and "FULL HD" vertical are separate records
// edited separately. The sidebar puts them behind one switch, but the switch
// *chooses a layout*; it doesn't bend one.
//
// Themes are plain JSON, so they can be exported, kept in localStorage and
// moved between machines without a build step. FIELDS below is the single
// source of truth for what a theme contains: state applies it, the editor
// renders controls from it and validation clamps against it. A new tunable
// needs one entry there and nothing else.

import { t } from "../i18n/i18n.js";

export const THEME_SCHEMA = "kvapka-theme@3";

// The three layout shapes, in the order the UI offers them. A vertical
// column's side is part of the layout's identity, not a toggle. "Slicers left"
// and "slicers right" put the content box on opposite sides of the canvas, so
// they are different layouts, not a mirrored view.
export const PLACEMENTS = ["horizontal", "vertical-left", "vertical-right"];

const PLACEMENT_LABELS = {
  get "horizontal"() { return t("placement.horizontal"); },
  get "vertical-left"() { return t("placement.verticalLeft"); },
  get "vertical-right"() { return t("placement.verticalRight"); }
};

export const isVerticalPlacement = p => p === "vertical-left" || p === "vertical-right";

/** The side a vertical column stands on. Horizontal layouts have no column
 *  and answer "left", so callers need no null case. */
export const sideOfPlacement = p => (p === "vertical-right" ? "right" : "left");

export const placementLabel = p => PLACEMENT_LABELS[p] || PLACEMENT_LABELS.horizontal;

// Every editable numeric constant, in the order the editor shows it.
//   key    — property name on the theme object
//   group  — editor section it belongs to
//   label  — UI label, from the locale file (i18n/locales/)
//   min/max/step — the input's own bounds
//   region — the preview region this control highlights; hovering either
//            side of the editor lights up the other
//   scope  — the one placement this field governs. Omitted means both. An
//            out-of-scope field is hidden by the editor (a control with no
//            visible effect is worse than none) but still normalized and
//            stored, so a round trip never loses the other placement's values.
//   verticalLabel / verticalHint / verticalRegion — for a field that also
//            exists in a vertical layout but means something different there.
//            One label can't describe both. The highlighted region differs
//            too, since the shape is drawn as another part of the preview.
export const FIELDS = [
  // --- Plátno ---
  { key: "canvasWidth", group: "canvas", get label() { return t("themeField.canvasWidth.label"); }, unit: "px", min: 480, max: 7680, step: 10, region: "canvas" },
  { key: "canvasHeight", group: "canvas", get label() { return t("themeField.canvasHeight.label"); }, unit: "px", min: 320, max: 4320, step: 10, region: "canvas" },

  // --- Okraje a mezery ---
  { key: "margin", group: "spacing", get label() { return t("themeField.margin.label"); }, unit: "px", min: 0, max: 200, step: 1, region: "margin",
    get hint() { return t("themeField.margin.hint"); } },
  { key: "gapSmall", group: "spacing", get label() { return t("themeField.gapSmall.label"); }, unit: "px", min: 0, max: 100, step: 1, region: "gap-small",
    get hint() { return t("themeField.gapSmall.hint"); } },
  { key: "gapKpiToCharts", group: "spacing", get label() { return t("themeField.gapKpiToCharts.label"); }, unit: "px", min: 0, max: 200, step: 1, region: "gap-block",
    get hint() { return t("themeField.gapKpiToCharts.hint"); } },

  // --- Hlavička ---
  { key: "titleHeight", group: "header", get label() { return t("themeField.titleHeight.label"); }, unit: "px", min: 0, max: 400, step: 1, region: "title" },

  // --- Slicery ---
  //
  // slicerHeight is kept by both placements but means different things: the
  // band's fixed height in a row, the per-slicer floor in a column.
  { key: "slicerHeight", group: "slicers", get label() { return t("themeField.slicerHeight.label"); }, unit: "px", min: 20, max: 400, step: 1, region: "slicer",
    get hint() { return t("themeField.slicerHeight.hint"); },
    get verticalLabel() { return t("themeField.slicerHeight.verticalLabel"); },
    get verticalHint() { return t("themeField.slicerHeight.verticalHint"); },
    // The horizontal band is drawn as "slicer", the column as "slicer-column".
    verticalRegion: "slicer-column" },
  { key: "minSlicerWidth", group: "slicers", get label() { return t("themeField.minSlicerWidth.label"); }, unit: "px", min: 20, max: 600, step: 5, region: "slicer",
    scope: "horizontal" },
  { key: "slicerColumnWidth", group: "slicers", get label() { return t("themeField.slicerColumnWidth.label"); }, unit: "px", min: 60, max: 900, step: 5, region: "slicer-column",
    scope: "vertical",
    get hint() { return t("themeField.slicerColumnWidth.hint"); } },
  { key: "minSlicerColumnWidth", group: "slicers", get label() { return t("themeField.minSlicerColumnWidth.label"); }, unit: "px", min: 40, max: 900, step: 5, region: "slicer-column",
    scope: "vertical" },
  { key: "maxSlicerColumnWidth", group: "slicers", get label() { return t("themeField.maxSlicerColumnWidth.label"); }, unit: "px", min: 60, max: 1200, step: 5, region: "slicer-column",
    scope: "vertical" },
  { key: "slicerFillThreshold", group: "slicers", get label() { return t("themeField.slicerFillThreshold.label"); }, unit: "%", min: 0, max: 100, step: 5, region: "slicer-column",
    percent: true,
    scope: "vertical",
    get hint() { return t("themeField.slicerFillThreshold.hint"); } },

  // --- KPI ---
  { key: "kpiMinHeight", group: "kpis", get label() { return t("themeField.kpiMinHeight.label"); }, unit: "px", min: 20, max: 500, step: 1, region: "kpi" },

  // --- Grafy ---
  { key: "minChartRowHeight", group: "charts", get label() { return t("themeField.minChartRowHeight.label"); }, unit: "px", min: 30, max: 800, step: 5, region: "charts" },
  { key: "minChartWidth", group: "charts", get label() { return t("themeField.minChartWidth.label"); }, unit: "px", min: 30, max: 900, step: 5, region: "charts" },
  { key: "hardMinChartHeight", group: "charts", get label() { return t("themeField.hardMinChartHeight.label"); }, unit: "px", min: 10, max: 400, step: 5, region: "charts",
    get hint() { return t("themeField.hardMinChartHeight.hint"); } },

  // --- Počty slicerů a KPI ---
  //
  // These bound slicers and KPI cards only. Charts have no per-row limit (how
  // many fit follows from minChartWidth), so the labels name the two things
  // they govern, not "prvky".
  //
  // In a vertical layout slicers stand in one column, so these bound KPI cards
  // alone. The vertical wording drops the slicer half of the label.
  { key: "minPerRow", group: "limits", get label() { return t("themeField.minPerRow.label"); }, min: 1, max: 12, step: 1, region: null,
    get verticalLabel() { return t("themeField.minPerRow.verticalLabel"); } },
  { key: "maxPerRow", group: "limits", get label() { return t("themeField.maxPerRow.label"); }, min: 1, max: 12, step: 1, region: null,
    get verticalLabel() { return t("themeField.maxPerRow.verticalLabel"); } },
  { key: "secondRowMaxItems", group: "limits", get label() { return t("themeField.secondRowMaxItems.label"); }, min: 0, max: 12, step: 1, region: null,
    get hint() { return t("themeField.secondRowMaxItems.hint"); },
    get verticalLabel() { return t("themeField.secondRowMaxItems.verticalLabel"); },
    get verticalHint() { return t("themeField.secondRowMaxItems.verticalHint"); } },
  { key: "defaultSlicersPerRow", group: "limits", get label() { return t("themeField.defaultSlicersPerRow.label"); }, min: 1, max: 12, step: 1, region: "slicer",
    scope: "horizontal",
    get hint() { return t("themeField.defaultSlicersPerRow.hint"); } },
  { key: "defaultKpisPerRow", group: "limits", get label() { return t("themeField.defaultKpisPerRow.label"); }, min: 1, max: 12, step: 1, region: "kpi" },

  // --- Mřížka ---
  { key: "step", group: "grid", get label() { return t("themeField.step.label"); }, unit: "px", min: 1, max: 50, step: 1, region: null,
    get hint() { return t("themeField.step.hint"); } }
];

export const GROUPS = [
  { id: "canvas", get label() { return t("themeGroup.canvas"); } },
  { id: "spacing", get label() { return t("themeGroup.spacing"); } },
  { id: "header", get label() { return t("themeGroup.header"); } },
  { id: "slicers", get label() { return t("themeGroup.slicers"); } },
  { id: "kpis", get label() { return t("themeGroup.kpis"); } },
  { id: "charts", get label() { return t("themeGroup.charts"); } },
  {
    id: "limits",
    get label() { return t("themeGroup.limits"); },
    // These two settings only fill a dropdown, but read like layout
    // constraints, so the group says what they do and what they leave alone.
    // The vertical wording names the one dropdown that still exists there. The
    // sidebar collapses "Slicery na řádek" for a column (see app.js), so naming
    // it would point at a control that isn't on screen.
    get note() { return t("themeGroup.limits.note"); },
    get verticalNote() { return t("themeGroup.limits.verticalNote"); }
  },
  { id: "grid", get label() { return t("themeGroup.grid"); } }
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map(f => [f.key, f]));

// --- Placement-aware presentation ---------------------------------------
//
// Three small resolvers so the editor never asks "is this vertical?". They
// sit next to the table because wording and scoping belong to the field; the
// editor just renders what they return.

/** The fields a layout of this placement actually uses, in table order. */
export const fieldsFor = placement =>
  FIELDS.filter(f => !f.scope || (f.scope === "vertical") === isVerticalPlacement(placement));

export const fieldLabel = (field, placement) =>
  (isVerticalPlacement(placement) && field.verticalLabel) || field.label;

export const fieldHint = (field, placement) =>
  (isVerticalPlacement(placement) && field.verticalHint) || field.hint;

export const fieldRegion = (field, placement) =>
  (isVerticalPlacement(placement) && field.verticalRegion) || field.region;

export const groupNote = (group, placement) =>
  (isVerticalPlacement(placement) && group.verticalNote) || group.note;

// The default title/slicer/KPI/charts stack: the ordered bands the editor lets
// the user reorder and repeat (charts sections may repeat, which is how "a KPI
// band between two chart rows" is expressed). A function, not a shared array,
// so each theme falling back to it gets its own objects instead of aliasing
// BASE's.
const DEFAULT_SECTIONS = () => [
  { type: "title", gapBefore: "auto" },
  { type: "slicers", id: "slicers", gapBefore: "auto" },
  { type: "kpi", id: "kpi-1", defaultCount: 0, allowSecondRow: true, gapBefore: "auto" },
  { type: "charts", id: "charts-1", rows: null, gapBefore: "auto" }
];

const SECTION_TYPES = ["title", "slicers", "kpi", "charts"];
const GAP_BEFORE_VALUES = ["auto", "small", "block"];

const BASE = {
  schema: THEME_SCHEMA,
  id: "FULL_HD",
  label: "FULL HD",
  builtin: false,
  // Which built-in preset this theme started as. Informational only: it
  // drives the editor's "N changes from FULL HD" readout and reset button. No
  // layout code reads it.
  derivedFrom: "FULL_HD",
  canvasWidth: 1920,
  canvasHeight: 1080,
  margin: 30,
  gapSmall: 10,
  gapKpiToCharts: 30,
  titleHeight: 50,
  slicerHeight: 80,
  minSlicerWidth: 50,
  slicerColumnWidth: 290,
  minSlicerColumnWidth: 270,
  maxSlicerColumnWidth: 500,
  slicerFillThreshold: 0.65,
  kpiMinHeight: 90,
  minChartRowHeight: 150,
  minChartWidth: 150,
  hardMinChartHeight: 40,
  minPerRow: 4,
  maxPerRow: 7,
  secondRowMaxItems: 7,
  defaultSlicersPerRow: 7,
  defaultKpisPerRow: 6,
  // Which shape this layout is: its identity, not a default. Changing it makes
  // a different layout, so the editor only allows choosing it at creation.
  placement: "horizontal",
  step: 5,
  sections: DEFAULT_SECTIONS()
};

// What makes HD an HD rather than a FULL HD: the canvas and the proportions
// that follow. Shared by both placements, so the pair reads as one resolution.
const HD_CANVAS = {
  canvasWidth: 1280,
  canvasHeight: 720,
  margin: 20,
  titleHeight: 40,
  gapKpiToCharts: 20,
  slicerHeight: 70,
  slicerColumnWidth: 190,
  minSlicerColumnWidth: 170,
  maxSlicerColumnWidth: 400,
  kpiMinHeight: 80,
  minChartRowHeight: 100
};

// What changes when a resolution is authored vertically. Only `slicerHeight`,
// the one field that means something different in a column: the band's fixed
// height becomes the floor a stacked slicer may shrink to, and a shorter floor
// lets a full column hold a useful number of slicers. The column widths in
// each theme are already right (always authored for the column; horizontal
// layouts just never rendered them), so restating them would create two
// copies of one number that could drift apart.
//
// The deltas are small on purpose: the pair starts alike and is then
// *separately editable*.
const VERTICAL_FULL_HD = { slicerHeight: 70 };
const VERTICAL_HD = { slicerHeight: 60 };

// The four built-ins. The horizontal two keep their old ids (`FULL_HD`, `HD`),
// so a stored default-theme id or an older page still resolves to the layout
// it named. Each pair shares a label; the placement switch tells them apart
// and the chip list shows one placement at a time.
export const BUILTIN_THEMES = [
  { ...BASE, id: "FULL_HD", label: "FULL HD", builtin: true, derivedFrom: "FULL_HD", placement: "horizontal" },
  { ...BASE, ...VERTICAL_FULL_HD, id: "FULL_HD_V", label: "FULL HD", builtin: true, derivedFrom: "FULL_HD_V", placement: "vertical-left" },
  { ...BASE, ...HD_CANVAS, id: "HD", label: "HD", builtin: true, derivedFrom: "HD", placement: "horizontal" },
  { ...BASE, ...HD_CANVAS, ...VERTICAL_HD, id: "HD_V", label: "HD", builtin: true, derivedFrom: "HD_V", placement: "vertical-left" }
];

export function getBuiltinTheme(id) {
  return BUILTIN_THEMES.find(t => t.id === id) || null;
}

/**
 * The built-in a theme's "N changes from …" readout compares against.
 *
 * Matches by *orientation*, not exact placement. A built-in of the other
 * orientation would diff two different shapes and flag every slicer field.
 * A vertical-left built-in is a fine baseline for a vertical-right layout;
 * they differ only by the column's side, which is worth reporting. No
 * right-side built-in ships, so without this a right-side layout would fall
 * back to a horizontal one.
 */
export function baselineIdFor(placement, preferredId) {
  const named = getBuiltinTheme(preferredId);
  if (named && isVerticalPlacement(named.placement) === isVerticalPlacement(placement)) {
    return named.id;
  }
  const match = BUILTIN_THEMES.find(
    t => isVerticalPlacement(t.placement) === isVerticalPlacement(placement)
  );
  return (match || BUILTIN_THEMES[0]).id;
}

export const baselineFor = theme =>
  getBuiltinTheme(baselineIdFor(theme.placement, theme.derivedFrom)) || BUILTIN_THEMES[0];

function num(value, fallback) {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// A charts section's `rows`, coerced to null or a positive integer. Garbage
// (strings, negatives, zero) becomes null ("absorb everything") instead of
// being rejected, since merging and the "last charts section is open-ended"
// rule need some answer.
function rowsValue(v) {
  if (v === null || v === undefined) return null;
  const n = Math.round(num(v, NaN));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

// Repairs any array into a valid sections list instead of rejecting it. This
// runs on every localStorage read, so a bug here silently destroys saved
// layouts. Each numbered step below is one of the module's design rules.
function normalizeSections(rawSections) {
  // 1. Keep only objects whose type is one of the four known kinds.
  let list = (Array.isArray(rawSections) ? rawSections : [])
    .filter(s => s && typeof s === "object" && SECTION_TYPES.includes(s.type))
    .map(s => ({ ...s }));

  // 2. Exactly one title, pinned to index 0.
  const titles = list.filter(s => s.type === "title");
  list = list.filter(s => s.type !== "title");
  list.unshift(titles[0] || { type: "title" });

  // 3. At most one slicers band, kept where it sits. The drag reorder
  // (themeEditor.js) relies on this: moving it past a KPI band must not be
  // snapped back by this pass. A theme with none gets a default one right
  // after the title, since every layout needs a home for the slicer controls.
  const slicerSections = list.filter(s => s.type === "slicers");
  if (slicerSections.length === 0) {
    list.splice(1, 0, { type: "slicers", id: "slicers" });
  } else if (slicerSections.length > 1) {
    let kept = false;
    list = list.filter(s => {
      if (s.type !== "slicers") return true;
      if (kept) return false;
      kept = true;
      return true;
    });
  }

  // 4. At least one charts band.
  if (!list.some(s => s.type === "charts")) {
    list.push({ type: "charts", rows: null });
  }

  // 5. Merge adjacent charts sections: a null `rows` (open-ended) absorbs
  // and wins over a fixed count sitting next to it, otherwise the counts add.
  const merged = [];
  list.forEach(s => {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === "charts" && s.type === "charts") {
      const a = rowsValue(prev.rows);
      const b = rowsValue(s.rows);
      prev.rows = (a === null || b === null) ? null : a + b;
    } else {
      merged.push(s);
    }
  });
  list = merged;

  // 6. Ids unique and present (title carries none).
  const seen = new Set();
  list.forEach(s => {
    if (s.type === "title") {
      delete s.id;
      return;
    }
    if (typeof s.id !== "string" || !s.id.trim() || seen.has(s.id)) {
      if (s.type === "slicers") {
        s.id = "slicers";
      } else {
        let n = 1;
        let id = `${s.type}-${n}`;
        while (seen.has(id)) id = `${s.type}-${++n}`;
        s.id = id;
      }
    }
    seen.add(s.id);
  });

  // 7 & 8: per-type field coercion.
  let lastChartsIndex = -1;
  list.forEach((s, i) => {
    if (s.type === "kpi") {
      s.defaultCount = Math.min(12, Math.max(0, Math.round(num(s.defaultCount, 0))));
      s.allowSecondRow = s.allowSecondRow === true;
    }
    if (s.type === "charts") {
      s.rows = rowsValue(s.rows);
      lastChartsIndex = i;
    }
  });
  // 8 (cont.): the last charts section must be open-ended, so fixed counts
  // can't swallow the rest of the canvas. Only the last may be, because
  // computeChartGroups() (chartGroups.js) resolves "whatever's left" only for
  // the last one; an earlier null (hand-edited or merged theme) would get zero
  // rows. Pin every other null to one row instead of rejecting the theme.
  if (lastChartsIndex >= 0) {
    let sawNull = false;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].type !== "charts" || list[i].rows !== null) continue;
      if (!sawNull) { sawNull = true; continue; }
      list[i].rows = 1;
    }
    if (!sawNull) list[lastChartsIndex].rows = null;
  }

  // 9. gapBefore coerced to one of the three literals.
  list.forEach(s => {
    s.gapBefore = GAP_BEFORE_VALUES.includes(s.gapBefore) ? s.gapBefore : "auto";
  });

  return list;
}

// Turns anything (partial object, parsed JSON, half-edited draft) into a
// theme every solver can consume. Unknown keys are dropped, so an imported
// file can't smuggle in state.
export function normalizeTheme(raw) {
  const src = raw || {};
  const out = { ...BASE };

  out.schema = THEME_SCHEMA;
  out.id = String(src.id == null ? BASE.id : src.id).trim() || BASE.id;
  out.label = String(src.label == null ? out.id : src.label).trim().slice(0, 40) || out.id;
  out.builtin = src.builtin === true;

  // Placement, and with it the @2 -> @3 migration. There is no versioned
  // migration machinery: every stored, imported and hand-edited theme passes
  // through normalizeTheme, so an older shape is repaired here. A @2 theme
  // had `defaultSlicerOrientation` + `slicerSide`; both collapse into one token.
  out.placement = PLACEMENTS.includes(src.placement)
    ? src.placement
    : src.defaultSlicerOrientation === "vertical"
      ? (src.slicerSide === "right" ? "vertical-right" : "vertical-left")
      : "horizontal";

  out.derivedFrom = baselineIdFor(out.placement, src.derivedFrom);

  FIELDS.forEach(field => {
    let value = src[field.key];
    // Thresholds are stored 0–1 but edited as a percentage; accept both.
    if (field.percent && value != null && num(value, 0) > 1) value = num(value, 0) / 100;
    const lo = field.percent ? field.min / 100 : field.min;
    const hi = field.percent ? field.max / 100 : field.max;
    const clamped = Math.min(hi, Math.max(lo, num(value, BASE[field.key])));
    out[field.key] = field.percent ? clamped : Math.round(clamped);
  });

  // A theme with no sections (never saved with this schema) gets the default
  // stack, never an empty one.
  out.sections = normalizeSections(
    Array.isArray(src.sections) ? src.sections : DEFAULT_SECTIONS()
  );

  return resolveDependencies(out);
}

// Cross-field rules the per-field clamps can't express. Applied after every
// normalize and every editor keystroke, so a theme is never self-contradictory
// (e.g. a max below its min).
export function resolveDependencies(theme) {
  const t = { ...theme, sections: theme.sections.map(s => ({ ...s })) };

  t.maxPerRow = Math.max(t.minPerRow, t.maxPerRow);
  t.defaultSlicersPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultSlicersPerRow));
  t.defaultKpisPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultKpisPerRow));

  t.maxSlicerColumnWidth = Math.max(t.minSlicerColumnWidth, t.maxSlicerColumnWidth);
  t.slicerColumnWidth = Math.min(t.maxSlicerColumnWidth, Math.max(t.minSlicerColumnWidth, t.slicerColumnWidth));

  t.hardMinChartHeight = Math.min(t.hardMinChartHeight, t.minChartRowHeight);

  // The margin can't eat the canvas: leave at least a 100px box.
  const marginCap = Math.floor((Math.min(t.canvasWidth, t.canvasHeight) - 100) / 2);
  t.margin = Math.max(0, Math.min(t.margin, marginCap));

  // No KPI band's seed count may exceed the row it must fit in.
  t.sections = t.sections.map(s => s.type === "kpi"
    ? { ...s, defaultCount: Math.min(t.maxPerRow, Math.max(0, s.defaultCount)) }
    : s);

  return t;
}

export const usableWidth = t => t.canvasWidth - 2 * t.margin;
export const usableHeight = t => t.canvasHeight - 2 * t.margin;

/**
 * One finding for the editor's status panel: a headline naming the problem
 * and a hint on what to change. `key` is the stem under "editor.issue."
 * whose .title and .hint hold the two texts.
 */
export function issue(severity, key, params) {
  return {
    severity,
    title: t(`editor.issue.${key}.title`, params),
    hint: t(`editor.issue.${key}.hint`, params)
  };
}

// Problems worth showing the user. Severity "error" blocks saving. "warning"
// is advisory: the theme works but squeezes something.
export function validateTheme(theme) {
  const issues = [];
  const uw = usableWidth(theme);
  const uh = usableHeight(theme);
  const vertical = isVerticalPlacement(theme.placement);

  if (uw < 200) issues.push(issue("error", "usableWidth"));
  if (uh < 200) issues.push(issue("error", "usableHeight"));

  // Each of the next two concerns a field the other placement doesn't show.
  // Reporting it there would point at a hidden control, so each is checked
  // only for the layout it applies to.
  if (vertical && theme.minSlicerColumnWidth > uw - theme.minChartWidth - theme.gapKpiToCharts) {
    issues.push(issue("warning", "columnTooWide"));
  }

  const perRowMin = theme.maxPerRow * theme.minSlicerWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (!vertical && perRowMin > uw) {
    issues.push(issue("warning", "slicerRow", { count: theme.maxPerRow, need: perRowMin, available: uw }));
  }

  const chartRowMin = theme.maxPerRow * theme.minChartWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (chartRowMin > uw) {
    issues.push(issue("warning", "chartRow", { count: theme.maxPerRow }));
  }

  // Vertical budget: header + slicer band + KPI band(s) + one chart row.
  // A vertical theme's slicers stand in a side column, not a band
  // (sectionWalker.js drops it from the stack), so charging it height here
  // would report a squeeze that can't happen.
  const kpiSections = theme.sections.filter(s => s.type === "kpi");
  const bandCount = kpiSections.length || 1;
  const slicerBand = vertical ? 0 : theme.slicerHeight + theme.gapSmall;
  const need =
    theme.titleHeight + theme.gapSmall +
    slicerBand +
    bandCount * (theme.kpiMinHeight + theme.gapKpiToCharts) +
    theme.minChartRowHeight;
  if (need > uh) {
    issues.push(issue("warning", "height", { need, available: uh }));
  }

  if (theme.gapSmall > 0 && theme.step > theme.gapSmall) {
    issues.push(issue("warning", "step"));
  }

  if (kpiSections.length > 4) {
    issues.push(issue("warning", "manyBands", { count: kpiSections.length }));
  }

  return issues;
}

export function cloneTheme(theme) {
  return { ...theme, sections: theme.sections.map(s => ({ ...s })) };
}
