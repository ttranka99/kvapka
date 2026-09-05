// assets/js/theme/themeModel.js
//
// A *theme* is the complete set of layout constants the solvers used to read
// as hardcoded module-level values (margins, gaps, the title band height, the
// slicer/KPI minimums, the per-row caps, the 5px grid step) plus the two
// structural switches that used to be implicit: whether slicers stand in a
// left column, and whether a second KPI band exists inside the chart area.
//
// Themes are plain JSON — that's what makes them exportable to a file, kept
// in localStorage, and pasted between machines without a build step. The
// single source of truth for what a theme *contains* is FIELDS below: state
// applies it, the editor renders its controls from it, and validation clamps
// against it. Adding a tunable means adding one entry here, nothing else.

export const THEME_SCHEMA = "kb-layout-theme@1";

// Every editable numeric constant, in the order the editor shows it.
//   key    — property name on the theme object
//   group  — editor section it belongs to
//   label  — Czech UI label (the whole app is Czech)
//   min/max/step — the input's own bounds
//   region — the preview region this control highlights, so hovering either
//            side of the editor lights up the other
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
  { key: "slicerHeight", group: "slicers", label: "Výška sliceru", unit: "px", min: 20, max: 400, step: 1, region: "slicer",
    hint: "V řádku pevná výška, ve sloupci minimální (a výchozí) výška." },
  { key: "minSlicerWidth", group: "slicers", label: "Min. šířka sliceru", unit: "px", min: 20, max: 600, step: 5, region: "slicer" },
  { key: "slicerColumnWidth", group: "slicers", label: "Šířka sloupce", unit: "px", min: 60, max: 900, step: 5, region: "slicer-column",
    hint: "Výchozí šířka svislého sloupce slicerů vlevo." },
  { key: "minSlicerColumnWidth", group: "slicers", label: "Min. šířka sloupce", unit: "px", min: 40, max: 900, step: 5, region: "slicer-column" },
  { key: "maxSlicerColumnWidth", group: "slicers", label: "Max. šířka sloupce", unit: "px", min: 60, max: 1200, step: 5, region: "slicer-column" },
  { key: "slicerFillThreshold", group: "slicers", label: "Práh dopnění sloupce", unit: "%", min: 0, max: 100, step: 5, region: "slicer-column",
    percent: true,
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
  { key: "minPerRow", group: "limits", label: "Min. slicerů / KPI na řádek", min: 1, max: 12, step: 1, region: null },
  { key: "maxPerRow", group: "limits", label: "Max. slicerů / KPI na řádek", min: 1, max: 12, step: 1, region: null },
  { key: "secondRowMaxItems", group: "limits", label: "Max. slicerů / KPI na 2. řádku", min: 0, max: 12, step: 1, region: null,
    hint: "Kolik se jich vejde na druhý řádek, když je první plný. Součet s limitem na řádek je absolutní strop, 0 druhý řádek úplně vypne. Prostředního pásu KPI se to netýká — ten je vždy jednořádkový." },
  { key: "defaultSlicersPerRow", group: "limits", label: "Výchozí slicery na řádek", min: 1, max: 12, step: 1, region: "slicer",
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
    // deliberately leave alone.
    note: "První dvě hodnoty určují rozsah, který nabídnou pole „Slicery na řádek“ a „KPI na řádek“ v postranním panelu. Počet grafů v řadě tím omezen není — ten vychází z minimální šířky grafu."
  },
  { id: "grid", label: "Mřížka" }
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map(f => [f.key, f]));

// The KPI band that can sit *inside* the chart area rather than under the
// header. `afterRow` is a 0-based chart-row index: the band is drawn below
// that row, so 0 puts it between the first and second row of charts.
export const DEFAULT_KPI_BAND_2 = Object.freeze({
  enabled: false,
  afterRow: 0,
  defaultCount: 4
});

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
  defaultSlicerOrientation: "horizontal",
  step: 5,
  kpiBand2: { ...DEFAULT_KPI_BAND_2 }
};

export const BUILTIN_THEMES = [
  { ...BASE, id: "FULL_HD", label: "FULL HD", builtin: true, derivedFrom: "FULL_HD" },
  {
    ...BASE,
    id: "HD",
    label: "HD",
    builtin: true,
    derivedFrom: "HD",
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
  }
];

export function getBuiltinTheme(id) {
  return BUILTIN_THEMES.find(t => t.id === id) || null;
}

function num(value, fallback) {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Turns anything (a partial object, a parsed JSON file, a half-edited draft)
// into a theme every solver can safely consume. Unknown keys are dropped
// rather than carried along, so an imported file cannot smuggle state in.
export function normalizeTheme(raw) {
  const src = raw || {};
  const out = { ...BASE, kpiBand2: { ...DEFAULT_KPI_BAND_2 } };

  out.schema = THEME_SCHEMA;
  out.id = String(src.id == null ? BASE.id : src.id).trim() || BASE.id;
  out.label = String(src.label == null ? out.id : src.label).trim().slice(0, 40) || out.id;
  out.builtin = src.builtin === true;
  out.derivedFrom = getBuiltinTheme(src.derivedFrom) ? src.derivedFrom : BASE.derivedFrom;

  FIELDS.forEach(field => {
    let value = src[field.key];
    // Thresholds are stored 0–1 but edited as a percentage; accept both.
    if (field.percent && value != null && num(value, 0) > 1) value = num(value, 0) / 100;
    const lo = field.percent ? field.min / 100 : field.min;
    const hi = field.percent ? field.max / 100 : field.max;
    const clamped = Math.min(hi, Math.max(lo, num(value, BASE[field.key])));
    out[field.key] = field.percent ? clamped : Math.round(clamped);
  });

  out.defaultSlicerOrientation = src.defaultSlicerOrientation === "vertical" ? "vertical" : "horizontal";

  const band = src.kpiBand2 || {};
  out.kpiBand2 = {
    enabled: band.enabled === true,
    afterRow: Math.max(0, Math.round(num(band.afterRow, 0))),
    defaultCount: Math.min(12, Math.max(1, Math.round(num(band.defaultCount, 4))))
  };

  return resolveDependencies(out);
}

// Cross-field rules the per-field clamps cannot express. Applied after every
// normalize *and* after every editor keystroke, so the theme in hand is never
// internally contradictory — e.g. a max that has slipped below its min.
export function resolveDependencies(theme) {
  const t = { ...theme, kpiBand2: { ...theme.kpiBand2 } };

  t.maxPerRow = Math.max(t.minPerRow, t.maxPerRow);
  t.defaultSlicersPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultSlicersPerRow));
  t.defaultKpisPerRow = Math.min(t.maxPerRow, Math.max(t.minPerRow, t.defaultKpisPerRow));

  t.maxSlicerColumnWidth = Math.max(t.minSlicerColumnWidth, t.maxSlicerColumnWidth);
  t.slicerColumnWidth = Math.min(t.maxSlicerColumnWidth, Math.max(t.minSlicerColumnWidth, t.slicerColumnWidth));

  t.hardMinChartHeight = Math.min(t.hardMinChartHeight, t.minChartRowHeight);

  // The margin can never eat the whole canvas — leave at least a 100px box.
  const marginCap = Math.floor((Math.min(t.canvasWidth, t.canvasHeight) - 100) / 2);
  t.margin = Math.max(0, Math.min(t.margin, marginCap));

  t.kpiBand2.defaultCount = Math.min(t.maxPerRow, Math.max(1, t.kpiBand2.defaultCount));

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

  if (uw < 200) issues.push({ severity: "error", text: "Použitelná šířka je menší než 200 px — zmenšete okraj nebo zvětšete plátno." });
  if (uh < 200) issues.push({ severity: "error", text: "Použitelná výška je menší než 200 px — zmenšete okraj nebo zvětšete plátno." });

  if (theme.minSlicerColumnWidth > uw - theme.minChartWidth - theme.gapKpiToCharts) {
    issues.push({ severity: "warning", text: "Sloupec slicerů zabere skoro celou šířku — pro graf vedle něj nezbude minimální šířka." });
  }

  const perRowMin = theme.maxPerRow * theme.minSlicerWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (perRowMin > uw) {
    issues.push({ severity: "warning", text: `Řádek ${theme.maxPerRow} slicerů potřebuje při minimální šířce ${perRowMin} px, k dispozici je ${uw} px.` });
  }

  const chartRowMin = theme.maxPerRow * theme.minChartWidth + (theme.maxPerRow - 1) * theme.gapSmall;
  if (chartRowMin > uw) {
    issues.push({ severity: "warning", text: `Řada ${theme.maxPerRow} grafů se při minimální šířce do plátna nevejde.` });
  }

  // Vertical budget: header + slicer band + KPI band(s) + one chart row.
  const bandCount = theme.kpiBand2.enabled ? 2 : 1;
  const need =
    theme.titleHeight + theme.gapSmall +
    theme.slicerHeight + theme.gapSmall +
    bandCount * (theme.kpiMinHeight + theme.gapKpiToCharts) +
    theme.minChartRowHeight;
  if (need > uh) {
    issues.push({ severity: "warning", text: `Hlavička, slicery a KPI potřebují ${need} px výšky, plátno jich nabízí ${uh} — grafy se zmáčknou pod minimum.` });
  }

  if (theme.gapSmall > 0 && theme.step > theme.gapSmall) {
    issues.push({ severity: "warning", text: "Krok mřížky je větší než mezera mezi prvky — rozměry mohou vycházet hrubě." });
  }

  return issues;
}

export function cloneTheme(theme) {
  return { ...theme, kpiBand2: { ...theme.kpiBand2 } };
}

// Which fields differ between two themes — used to tell the user how far a
// custom theme has drifted from the preset it was derived from.
export function diffFromTheme(theme, base) {
  const keys = FIELDS.map(f => f.key).concat("defaultSlicerOrientation");
  const changed = keys.filter(k => theme[k] !== base[k]);

  const a = theme.kpiBand2;
  const b = base.kpiBand2;
  const bandDiffers = a.enabled !== b.enabled ||
    (a.enabled && (a.afterRow !== b.afterRow || a.defaultCount !== b.defaultCount));
  if (bandDiffers) changed.push("kpiBand2");

  return changed;
}
