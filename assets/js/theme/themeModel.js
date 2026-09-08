// assets/js/theme/themeModel.js
//
// A *theme* is the complete set of layout constants the solvers used to read
// as hardcoded module-level values (margins, gaps, the title band height, the
// slicer/KPI minimums, the per-row caps, the 5px grid step) plus the band
// stack (`sections`) and the one structural decision that defines the layout's
// shape: its `placement`.
//
// A theme is ONE layout, in ONE placement. It used to be both at once — a
// single object carrying `defaultSlicerOrientation` as a mere starting
// position, which the sidebar could flip at any time, reusing every one of
// the theme's numbers for a shape they were never authored for. Horizontal
// and vertical are different layouts with different budgets (a slicer band
// costs height, a slicer column costs width), so they are now different
// themes: "FULL HD" horizontal and "FULL HD" vertical are two records the
// user edits separately. The sidebar still compacts them behind one switch,
// but that switch now *chooses a layout* rather than bending one.
//
// Themes are plain JSON — that's what makes them exportable to a file, kept
// in localStorage, and pasted between machines without a build step. The
// single source of truth for what a theme *contains* is FIELDS below: state
// applies it, the editor renders its controls from it, and validation clamps
// against it. Adding a tunable means adding one entry here, nothing else.

export const THEME_SCHEMA = "kb-layout-theme@3";

// The three shapes a layout can have, in the order the UI offers them. A
// vertical column's side is part of the layout's identity, not a toggle on
// top of it — "slicers left" and "slicers right" hand the content box to
// opposite sides of the canvas, which is a different layout, not a mirrored
// view of one.
export const PLACEMENTS = ["horizontal", "vertical-left", "vertical-right"];

const PLACEMENT_LABELS = {
  "horizontal": "Nahoře",
  "vertical-left": "Vlevo",
  "vertical-right": "Vpravo"
};

export const isVerticalPlacement = p => p === "vertical-left" || p === "vertical-right";

/** The side a vertical column stands on. Horizontal layouts have no column;
 *  they answer "left" so callers never have to special-case a null. */
export const sideOfPlacement = p => (p === "vertical-right" ? "right" : "left");

export const placementLabel = p => PLACEMENT_LABELS[p] || PLACEMENT_LABELS.horizontal;

// Every editable numeric constant, in the order the editor shows it.
//   key    — property name on the theme object
//   group  — editor section it belongs to
//   label  — Czech UI label (the whole app is Czech)
//   min/max/step — the input's own bounds
//   region — the preview region this control highlights, so hovering either
//            side of the editor lights up the other
//   scope  — the placement this field governs, when it governs only one.
//            Omitted means both. A field out of scope is hidden by the editor
//            (a control with no visible effect is worse than no control) but
//            still normalized and still stored, so a round trip through the
//            editor never destroys the other placement's values.
//   verticalLabel / verticalHint / verticalRegion — for a field that survives
//            into a vertical layout but means something different there. A
//            single label that tries to describe both at once ends up
//            describing neither, now that only one is ever on screen — and
//            the region it highlights moves too, since the shape it governs
//            is drawn as a different part of the preview.
export const FIELDS = [
  // --- Plátno ---
  { key: "canvasWidth", group: "canvas", label: "Šířka plátna", unit: "px", min: 480, max: 7680, step: 10, region: "canvas" },
  { key: "canvasHeight", group: "canvas", label: "Výška plátna", unit: "px", min: 320, max: 4320, step: 10, region: "canvas" },

  // --- Okraje a mezery ---
  { key: "margin", group: "spacing", label: "Okraj plátna", unit: "px", min: 0, max: 200, step: 1, region: "margin",
    hint: "Volný pás mezi okrajem plátna a použitelnou plochou — nahoře, dole i po stranách." },
  { key: "gapSmall", group: "spacing", label: "Mezera mezi prvky", unit: "px", min: 0, max: 100, step: 1, region: "gap-small",
    hint: "Základní rozestup mezi sousedními prvky v řádku i mezi řadami grafů." },
  { key: "gapKpiToCharts", group: "spacing", label: "Mezera mezi bloky", unit: "px", min: 0, max: 200, step: 1, region: "gap-block",
    hint: "Širší mezera oddělující bloky: slicery od obsahu, KPI od grafů." },

  // --- Hlavička ---
  { key: "titleHeight", group: "header", label: "Výška hlavičky", unit: "px", min: 0, max: 400, step: 1, region: "title" },

  // --- Slicery ---
  //
  // slicerHeight is the one field both placements keep, and it means a
  // different thing in each: the band's fixed height in a row, the per-slicer
  // floor the stack grows from in a column.
  { key: "slicerHeight", group: "slicers", label: "Výška sliceru", unit: "px", min: 20, max: 400, step: 1, region: "slicer",
    hint: "Pevná výška slicerů ve vodorovném pásu.",
    verticalLabel: "Min. výška sliceru",
    verticalHint: "Minimální (a výchozí) výška jednoho sliceru ve sloupci — od ní se odvíjí, kolik se jich do sloupce vejde.",
    // The horizontal band is drawn as "slicer"; the column as "slicer-column".
    // Same field, two different things on screen to point at.
    verticalRegion: "slicer-column" },
  { key: "minSlicerWidth", group: "slicers", label: "Min. šířka sliceru", unit: "px", min: 20, max: 600, step: 5, region: "slicer",
    scope: "horizontal" },
  { key: "slicerColumnWidth", group: "slicers", label: "Šířka sloupce", unit: "px", min: 60, max: 900, step: 5, region: "slicer-column",
    scope: "vertical",
    hint: "Výchozí šířka svislého sloupce slicerů." },
  { key: "minSlicerColumnWidth", group: "slicers", label: "Min. šířka sloupce", unit: "px", min: 40, max: 900, step: 5, region: "slicer-column",
    scope: "vertical" },
  { key: "maxSlicerColumnWidth", group: "slicers", label: "Max. šířka sloupce", unit: "px", min: 60, max: 1200, step: 5, region: "slicer-column",
    scope: "vertical" },
  { key: "slicerFillThreshold", group: "slicers", label: "Práh dopnění sloupce", unit: "%", min: 0, max: 100, step: 5, region: "slicer-column",
    percent: true,
    scope: "vertical",
    hint: "Jakmile slicery při minimální výšce zaplní alespoň tuto část sloupce, roztáhnou se přesně na jeho výšku." },

  // --- KPI ---
  { key: "kpiMinHeight", group: "kpis", label: "Výška KPI", unit: "px", min: 20, max: 500, step: 1, region: "kpi" },

  // --- Grafy ---
  { key: "minChartRowHeight", group: "charts", label: "Min. výška řady", unit: "px", min: 30, max: 800, step: 5, region: "charts" },
  { key: "minChartWidth", group: "charts", label: "Min. šířka grafu", unit: "px", min: 30, max: 900, step: 5, region: "charts" },
  { key: "hardMinChartHeight", group: "charts", label: "Absolutní min. výška", unit: "px", min: 10, max: 400, step: 5, region: "charts",
    hint: "Tvrdé dno, na které smí graf zmenšit, když se řady jinak na plátno nevejdou." },

  // --- Počty slicerů a KPI ---
  //
  // These bound slicers and KPI cards only. Charts have no per-row count
  // limit at all — how many fit in a row follows from minChartWidth — so the
  // labels name the two things they actually govern rather than "prvky".
  //
  // In a vertical layout the slicers stand in a single column, so these bound
  // KPI cards alone — hence the vertical wording, which drops the half of the
  // label that no longer applies.
  { key: "minPerRow", group: "limits", label: "Min. slicerů / KPI na řádek", min: 1, max: 12, step: 1, region: null,
    verticalLabel: "Min. KPI na řádek" },
  { key: "maxPerRow", group: "limits", label: "Max. slicerů / KPI na řádek", min: 1, max: 12, step: 1, region: null,
    verticalLabel: "Max. KPI na řádek" },
  { key: "secondRowMaxItems", group: "limits", label: "Max. slicerů / KPI na 2. řádku", min: 0, max: 12, step: 1, region: null,
    hint: "Kolik se jich vejde na druhý řádek, když je první plný. Součet s limitem na řádek je absolutní strop, 0 druhý řádek úplně vypne. Prostředního pásu KPI se to netýká — ten je vždy jednořádkový.",
    verticalLabel: "Max. KPI na 2. řádku",
    verticalHint: "Kolik KPI se vejde na druhý řádek, když je první plný. Součet s limitem na řádek je absolutní strop, 0 druhý řádek úplně vypne. Prostředního pásu KPI se to netýká — ten je vždy jednořádkový." },
  { key: "defaultSlicersPerRow", group: "limits", label: "Výchozí slicery na řádek", min: 1, max: 12, step: 1, region: "slicer",
    scope: "horizontal",
    hint: "Hodnota, na které stránka s touto šablonou začíná. V postranním panelu ji lze kdykoli změnit." },
  { key: "defaultKpisPerRow", group: "limits", label: "Výchozí KPI na řádek", min: 1, max: 12, step: 1, region: "kpi" },

  // --- Mřížka ---
  { key: "step", group: "grid", label: "Krok mřížky", unit: "px", min: 1, max: 50, step: 1, region: null,
    hint: "Všechny dopočítané i ručně zadané rozměry přiléhají na násobek této hodnoty." }
];

export const GROUPS = [
  { id: "canvas", label: "Plátno" },
  { id: "spacing", label: "Okraje a mezery" },
  { id: "header", label: "Hlavička" },
  { id: "slicers", label: "Slicery" },
  { id: "kpis", label: "KPI" },
  { id: "charts", label: "Grafy" },
  {
    id: "limits",
    label: "Počty slicerů a KPI",
    // These two settings only ever fill a dropdown — they read like layout
    // constraints, so the group says outright what they do and what they
    // deliberately leave alone. The vertical wording points at the one
    // dropdown that still exists there: the sidebar collapses "Slicery na
    // řádek" entirely for a column (see app.js), so naming it would send the
    // user looking for a control that isn't on screen.
    note: "První dvě hodnoty určují rozsah, který nabídnou pole „Slicery na řádek“ a „KPI na řádek“ v postranním panelu. Počet grafů v řadě tím omezen není — ten vychází z minimální šířky grafu.",
    verticalNote: "První dvě hodnoty určují rozsah, který nabídne pole „KPI na řádek“ v postranním panelu. Slicery stojí ve sloupci, takže se jich netýkají. Počet grafů v řadě tím omezen není — ten vychází z minimální šířky grafu."
  },
  { id: "grid", label: "Mřížka" }
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map(f => [f.key, f]));

// --- Placement-aware presentation ---------------------------------------
//
// Three tiny resolvers so the editor never has to ask "is this vertical?"
// itself. They exist here, next to the table they read, because the wording
// and the scoping are properties of the field — the editor just renders
// whatever they hand back.

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

// The generalised title/slicer/KPI/charts stack: the ordered list of bands
// the editor lets the user reorder and repeat (charts sections may occur
// more than once — that's how "a KPI band between two chart rows" is
// expressed). A function, not a shared array literal, so every theme that
// falls back to this default gets its own objects instead of aliasing
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
  // Which built-in preset this theme started life as. Purely informational —
  // it drives the editor's "N changes from FULL HD" readout and its reset
  // button, and nothing in the layout reads it.
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
  // Which shape this layout is. Not a default and not a starting position —
  // the layout's identity. Changing it makes a different layout, which is
  // why the editor only lets it be chosen when a theme is created.
  placement: "horizontal",
  step: 5,
  sections: DEFAULT_SECTIONS()
};

// Everything that makes HD an HD rather than a FULL HD — the canvas and the
// proportions that follow from it. Shared by both of its placements, so the
// pair still reads as one resolution.
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

// What changes when a resolution is authored vertically instead. Only
// `slicerHeight`, because it is the one field that genuinely means something
// different in a column: a band's fixed height becomes the floor a stacked
// slicer may shrink to, and a shorter floor is what lets a full column hold a
// useful number of them. The column widths each placement's theme carries are
// already the right ones (they were always authored for the column — the
// horizontal layouts simply never rendered them), so restating them here
// would be two copies of one number waiting to drift apart.
//
// That these deltas are small is the point: the pair starts out alike and is
// now *separately editable*, rather than one set of numbers stretched over
// two shapes.
const VERTICAL_FULL_HD = { slicerHeight: 70 };
const VERTICAL_HD = { slicerHeight: 60 };

// The four built-ins. The horizontal two keep the ids they have always had
// (`FULL_HD`, `HD`), so a stored default-theme id and any page authored
// before this change still resolve to exactly the layout they named. Each
// pair shares a label — the placement switch is what tells them apart, and
// the chip list only ever shows one placement at a time.
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
 * Matching is by *orientation*, not by exact placement: a built-in of the
 * other orientation would diff two different shapes and call every slicer
 * field changed, but a vertical-left built-in is a perfectly good baseline
 * for a vertical-right layout — the two differ by which side the column
 * stands on, which is exactly the one difference worth reporting. That
 * matters because no right-side built-in ships, so a right-side layout would
 * otherwise fall all the way back to a horizontal one.
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
// (strings, negatives, zero) collapses to null — the "absorb everything"
// state — rather than being rejected, since a merge or the final "last
// charts section must be open-ended" rule needs *some* answer either way.
function rowsValue(v) {
  if (v === null || v === undefined) return null;
  const n = Math.round(num(v, NaN));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

// Repairs an arbitrary array into a valid sections list rather than
// rejecting it outright — this runs on every localStorage read, so a bug
// here silently destroys saved layouts. See the numbered rules in the
// module's design notes; each step below corresponds to one of them.
function normalizeSections(rawSections) {
  // 1. Keep only objects whose type is one of the four known kinds.
  let list = (Array.isArray(rawSections) ? rawSections : [])
    .filter(s => s && typeof s === "object" && SECTION_TYPES.includes(s.type))
    .map(s => ({ ...s }));

  // 2. Exactly one title, pinned to index 0.
  const titles = list.filter(s => s.type === "title");
  list = list.filter(s => s.type !== "title");
  list.unshift(titles[0] || { type: "title" });

  // 3. At most one slicers band, kept wherever it already sits — the drag
  // reorder (themeEditor.js) relies on that: moving it past a KPI band
  // must not have this normalize pass snap it straight back afterward. A
  // theme that dropped it entirely still gets a default one right after
  // the title, since every layout needs somewhere for the slicer controls
  // to live even if nobody has touched this section.
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
  // 8 (cont.): at least one charts section must be open-ended, so a fixed
  // count can never accidentally swallow the rest of the canvas — and at
  // most one, since computeChartGroups() (chartGroups.js) only resolves
  // "whatever's left" for the *last* one; an earlier null left over from a
  // hand-edited or merged theme would silently claim zero rows there
  // instead. Pin every null but the last to a single row rather than
  // rejecting the theme outright.
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

// Turns anything (a partial object, a parsed JSON file, a half-edited draft)
// into a theme every solver can safely consume. Unknown keys are dropped
// rather than carried along, so an imported file cannot smuggle state in.
export function normalizeTheme(raw) {
  const src = raw || {};
  const out = { ...BASE };

  out.schema = THEME_SCHEMA;
  out.id = String(src.id == null ? BASE.id : src.id).trim() || BASE.id;
  out.label = String(src.label == null ? out.id : src.label).trim().slice(0, 40) || out.id;
  out.builtin = src.builtin === true;

  // Placement, and with it the @2 -> @3 migration. This module has no
  // versioned migration machinery and doesn't need any: normalizeTheme is
  // what every stored, imported and hand-edited theme passes through, so an
  // older shape is repaired here or nowhere. A @2 theme carried the pair
  // `defaultSlicerOrientation` + `slicerSide`; both collapse into one token.
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

  // A theme that arrives with no sections of its own (never saved through
  // this schema at all) falls back to the default single-band shape, never
  // to an empty one.
  out.sections = normalizeSections(
    Array.isArray(src.sections) ? src.sections : DEFAULT_SECTIONS()
  );

  return resolveDependencies(out);
}

// Cross-field rules the per-field clamps cannot express. Applied after every
// normalize *and* after every editor keystroke, so the theme in hand is never
// internally contradictory — e.g. a max that has slipped below its min.
export function resolveDependencies(theme) {
  const t = { ...theme, sections: theme.sections.map(s => ({ ...s })) };

  t.maxPerRow = Math.max(t.minPerRow, t.maxPerRow);
  t.defaultSlicersPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultSlicersPerRow));
  t.defaultKpisPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultKpisPerRow));

  t.maxSlicerColumnWidth = Math.max(t.minSlicerColumnWidth, t.maxSlicerColumnWidth);
  t.slicerColumnWidth = Math.min(t.maxSlicerColumnWidth, Math.max(t.minSlicerColumnWidth, t.slicerColumnWidth));

  t.hardMinChartHeight = Math.min(t.hardMinChartHeight, t.minChartRowHeight);

  // The margin can never eat the whole canvas — leave at least a 100px box.
  const marginCap = Math.floor((Math.min(t.canvasWidth, t.canvasHeight) - 100) / 2);
  t.margin = Math.max(0, Math.min(t.margin, marginCap));

  // No KPI band's seed count may exceed the row it has to fit in.
  t.sections = t.sections.map(s => s.type === "kpi"
    ? { ...s, defaultCount: Math.min(t.maxPerRow, Math.max(0, s.defaultCount)) }
    : s);

  return t;
}

export const usableWidth = t => t.canvasWidth - 2 * t.margin;
export const usableHeight = t => t.canvasHeight - 2 * t.margin;

// Problems worth telling the user about. Severity "error" blocks saving;
// "warning" is advisory — the theme still works, it just squeezes something.
export function validateTheme(theme) {
  const issues = [];
  const uw = usableWidth(theme);
  const uh = usableHeight(theme);
  const vertical = isVerticalPlacement(theme.placement);

  if (uw < 200) issues.push({ severity: "error", text: "Použitelná šířka je menší než 200 px — zmenšete okraj nebo zvětšete plátno." });
  if (uh < 200) issues.push({ severity: "error", text: "Použitelná výška je menší než 200 px — zmenšete okraj nebo zvětšete plátno." });

  // Both of the next two warn about a field the *other* placement doesn't
  // show. Reporting them anyway would point the user at a control that isn't
  // on screen, so each is asked only of the layout it applies to.
  if (vertical && theme.minSlicerColumnWidth > uw - theme.minChartWidth - theme.gapKpiToCharts) {
    issues.push({ severity: "warning", text: "Sloupec slicerů zabere skoro celou šířku — pro graf vedle něj nezbude minimální šířka." });
  }

  const perRowMin = theme.maxPerRow * theme.minSlicerWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (!vertical && perRowMin > uw) {
    issues.push({ severity: "warning", text: `Řádek ${theme.maxPerRow} slicerů potřebuje při minimální šířce ${perRowMin} px, k dispozici je ${uw} px.` });
  }

  const chartRowMin = theme.maxPerRow * theme.minChartWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (chartRowMin > uw) {
    issues.push({ severity: "warning", text: `Řada ${theme.maxPerRow} grafů se při minimální šířce do plátna nevejde.` });
  }

  // Vertical budget: header + slicer band + KPI band(s) + one chart row.
  // A vertical theme's slicers stand in a side column that occupies no
  // vertical band at all (sectionWalker.js drops it from the stack), so
  // charging it height here would invent a squeeze that cannot happen.
  const kpiSections = theme.sections.filter(s => s.type === "kpi");
  const bandCount = kpiSections.length || 1;
  const slicerBand = vertical ? 0 : theme.slicerHeight + theme.gapSmall;
  const need =
    theme.titleHeight + theme.gapSmall +
    slicerBand +
    bandCount * (theme.kpiMinHeight + theme.gapKpiToCharts) +
    theme.minChartRowHeight;
  if (need > uh) {
    issues.push({ severity: "warning", text: `Hlavička, slicery a KPI potřebují ${need} px výšky, plátno jich nabízí ${uh} — grafy se zmáčknou pod minimum.` });
  }

  if (theme.gapSmall > 0 && theme.step > theme.gapSmall) {
    issues.push({ severity: "warning", text: "Krok mřížky je větší než mezera mezi prvky — rozměry mohou vycházet hrubě." });
  }

  if (kpiSections.length > 4) {
    issues.push({ severity: "warning", text: `Rozvržení má ${kpiSections.length} pásů KPI — tolik bandů ztěžuje orientaci.` });
  }

  return issues;
}

export function cloneTheme(theme) {
  return { ...theme, sections: theme.sections.map(s => ({ ...s })) };
}

// Which fields differ between two themes — used to tell the user how far a
// custom theme has drifted from the preset it was derived from. Only the
// fields the placement actually uses count: a horizontal layout's column
// widths are carried along untouched, and reporting them as "changes" would
// inflate the count with values the editor never showed.
export function diffFromTheme(theme, base) {
  const keys = fieldsFor(theme.placement).map(f => f.key).concat("placement");
  const changed = keys.filter(k => theme[k] !== base[k]);

  if (JSON.stringify(theme.sections) !== JSON.stringify(base.sections)) changed.push("sections");

  return changed;
}
