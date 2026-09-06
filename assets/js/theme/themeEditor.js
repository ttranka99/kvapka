// assets/js/theme/themeEditor.js
//
// The custom-theme editor: a full-screen dialog with the numeric rules on the
// left and a live, draggable preview of the canvas on the right.
//
// The preview deliberately does NOT show one slicer and one KPI. A theme is a
// set of *rules*, so what it shows is the shape those rules produce: the whole
// slicer stripe spanning the usable width, split into the theme's default
// number of cells; the KPI band as a band; the chart area as the rows that are
// left over. Every region carries the numbers it is governed by, and every
// region that maps to a single tunable can be dragged to change it — so the
// controls on the left and the picture on the right are two views of one
// object, and hovering either highlights the other.

import {
  FIELDS,
  GROUPS,
  FIELD_BY_KEY,
  normalizeTheme,
  resolveDependencies,
  cloneTheme,
  validateTheme,
  usableWidth,
  usableHeight,
  diffFromTheme,
  getBuiltinTheme,
  BUILTIN_THEMES
} from "./themeModel.js";
import {
  getAllThemes,
  saveTheme,
  deleteTheme,
  makeThemeId,
  exportThemeJson,
  parseThemeFile,
  importThemes,
  downloadJson
} from "./themeStore.js";
import { walkSections } from "../layout/sectionWalker.js";
import { computeChartGroups } from "../layout/chartGroups.js";

// --- Dialog state ------------------------------------------------------

let root = null;              // the overlay element, built once and reused
let draft = null;             // the theme being edited
let baseTheme = null;         // what it was derived from, for the diff readout
let editingExistingId = null; // non-null when editing a saved custom theme
let onApply = null;           // callback handed in by the opener
let preview = {
  orientation: "horizontal",
  chartRows: 2,
  chartCols: 2
};
let highlightedRegion = null;
let dragSession = null;       // non-null only for the duration of a pointer reorder drag

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// --- Public API --------------------------------------------------------

/**
 * Opens the editor.
 * @param {object} options
 * @param {object} options.theme  theme to start from (a built-in is copied
 *                                into a new custom theme; a custom one is
 *                                edited in place)
 * @param {(theme: object) => void} options.onApply  called with the saved
 *                                theme when the user confirms
 */
export function openThemeEditor(options) {
  const source = normalizeTheme(options.theme);
  // Built-ins are read-only baselines, so opening one always forks. `mode:
  // "new"` forks a custom theme too — that is the sidebar's "new theme"
  // button, which seeds from whatever is active rather than starting blank.
  const fork = source.builtin || options.mode === "new";

  if (fork) {
    baseTheme = cloneTheme(getBuiltinTheme(source.derivedFrom) || source);
    editingExistingId = null;
    draft = cloneTheme(source);
    draft.builtin = false;
    draft.derivedFrom = source.builtin ? source.id : source.derivedFrom;
    draft.label = `${source.label} – kopie`;
    draft.id = makeThemeId(draft.label);
  } else {
    baseTheme = cloneTheme(getBuiltinTheme(source.derivedFrom) || BUILTIN_THEMES[0]);
    editingExistingId = source.id;
    draft = cloneTheme(source);
  }

  preview.orientation = draft.defaultSlicerOrientation;
  onApply = options.onApply || null;

  if (!root) root = buildDialog();
  root.hidden = false;
  document.body.classList.add("theme-editor-open");
  render();

  // A read-only peek at the draft's section order, for the test harness —
  // draft itself is module-private, and the DOM alone can't tell a raw
  // sections index from a rendered one.
  window.__themeDraftSectionsForTest = () => draft.sections.map(s => ({ ...s }));

  const nameInput = root.querySelector("#theme-name");
  nameInput.focus();
  nameInput.select();
}

export function closeThemeEditor() {
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove("theme-editor-open");
}

// --- Dialog construction ------------------------------------------------

function buildDialog() {
  const overlay = el("div", "theme-editor");
  overlay.id = "theme-editor";
  overlay.hidden = true;

  const backdrop = el("div", "theme-editor__backdrop");
  backdrop.addEventListener("click", requestClose);
  overlay.appendChild(backdrop);

  const dialog = el("div", "theme-editor__dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Editor vlastní šablony");

  dialog.appendChild(buildHead());

  const body = el("div", "theme-editor__body");
  body.appendChild(buildControlsPane());
  body.appendChild(buildStagePane());
  dialog.appendChild(body);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  document.addEventListener("keydown", e => {
    if (overlay.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); requestClose(); }
  });

  // The preview is scaled to the frame it is measured against, so it has to
  // be redrawn whenever that frame changes size — a window resize, or the
  // controls pane's scrollbar appearing.
  const frame = overlay.querySelector(".theme-stage__frame");
  if (typeof ResizeObserver === "function") {
    let queued = false;
    new ResizeObserver(() => {
      if (overlay.hidden || queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; renderPreview(); });
    }).observe(frame);
  }

  return overlay;
}

function buildHead() {
  const head = el("header", "theme-editor__head");

  const identity = el("div", "theme-editor__identity");
  const name = document.createElement("input");
  name.type = "text";
  name.id = "theme-name";
  name.className = "theme-editor__name";
  name.maxLength = 40;
  name.setAttribute("aria-label", "Název šablony");
  name.addEventListener("input", () => {
    draft.label = name.value;
    renderMeta();
  });
  identity.appendChild(name);
  identity.appendChild(el("p", "theme-editor__meta"));
  head.appendChild(identity);

  const actions = el("div", "theme-editor__head-actions");

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "application/json,.json";
  file.className = "theme-editor__file";
  file.addEventListener("change", handleImportFile);
  actions.appendChild(file);

  actions.appendChild(button("Importovat", "ghost", () => file.click(),
    "Načíst šablonu ze souboru JSON"));
  actions.appendChild(button("Exportovat", "ghost", handleExport,
    "Uložit tuto šablonu jako soubor JSON"));
  actions.appendChild(button("Zrušit", "ghost", requestClose));

  const del = button("Smazat", "danger", handleDelete, "Smazat tuto šablonu");
  del.classList.add("theme-editor__delete");
  actions.appendChild(del);

  actions.appendChild(button("Uložit a použít", "primary", handleSave));

  head.appendChild(actions);
  return head;
}

function button(label, variant, onClick, title) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `theme-btn theme-btn--${variant}`;
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function buildControlsPane() {
  const pane = el("aside", "theme-editor__controls");

  GROUPS.forEach(group => {
    const section = el("section", "theme-group");
    section.dataset.group = group.id;

    section.appendChild(el("h3", "theme-group__title", group.label));
    if (group.note) section.appendChild(el("p", "theme-group__note", group.note));

    FIELDS.filter(f => f.group === group.id).forEach(field => {
      section.appendChild(buildField(field));
    });

    // The structural switches ride along with the group they belong to,
    // rather than living in a separate "advanced" pane the user has to go
    // hunting for — orientation is a slicer decision, the middle band a KPI
    // one.
    if (group.id === "slicers") section.appendChild(buildOrientationControl());
    if (group.id === "kpis") section.appendChild(buildBand2Controls());

    pane.appendChild(section);
  });

  const reset = button("Vrátit na výchozí předlohu", "ghost", () => {
    draft = { ...cloneTheme(baseTheme), id: draft.id, label: draft.label, builtin: false };
    render();
  });
  reset.classList.add("theme-editor__reset");
  pane.appendChild(reset);

  return pane;
}

function buildField(field) {
  const row = el("div", "theme-field");
  row.dataset.field = field.key;
  if (field.region) row.dataset.region = field.region;

  const label = el("label", "theme-field__label", field.label);
  label.htmlFor = `theme-input-${field.key}`;
  if (field.hint) label.title = field.hint;
  row.appendChild(label);

  const controls = el("div", "theme-field__controls");

  const range = document.createElement("input");
  range.type = "range";
  range.className = "theme-field__range";
  range.min = String(field.min);
  range.max = String(field.max);
  range.step = String(field.step);
  range.tabIndex = -1;               // the number input is the keyboard path
  range.setAttribute("aria-hidden", "true");
  controls.appendChild(range);

  const number = document.createElement("input");
  number.type = "number";
  number.id = `theme-input-${field.key}`;
  number.className = "theme-field__number";
  number.min = String(field.min);
  number.max = String(field.max);
  number.step = String(field.step);
  controls.appendChild(number);

  if (field.unit) controls.appendChild(el("span", "theme-field__unit", field.unit));

  const commit = value => {
    setFieldValue(field, value);
    render();
  };
  range.addEventListener("input", () => commit(range.value));
  number.addEventListener("input", () => commit(number.value));

  row.appendChild(controls);
  if (field.hint) row.appendChild(el("p", "theme-field__hint", field.hint));

  if (field.region) {
    row.addEventListener("mouseenter", () => setHighlight(field.region));
    row.addEventListener("mouseleave", () => setHighlight(null));
    number.addEventListener("focus", () => setHighlight(field.region));
    number.addEventListener("blur", () => setHighlight(null));
  }

  return row;
}

function buildOrientationControl() {
  const row = el("div", "theme-field theme-field--switch");
  row.appendChild(el("span", "theme-field__label", "Výchozí umístění slicerů"));

  const group = el("div", "theme-toggle");
  // "Vlevo" and "Vpravo" both set orientation to vertical — only their side
  // differs — so a side is carried alongside the orientation rather than a
  // second control of its own; setting one always implies the other.
  [["horizontal", null, "Nahoře"], ["vertical", "left", "Vlevo"], ["vertical", "right", "Vpravo"]]
    .forEach(([orientation, side, text]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-toggle__option";
      b.dataset.orientation = orientation;
      if (side) b.dataset.side = side;
      b.textContent = text;
      b.addEventListener("click", () => {
        draft.defaultSlicerOrientation = orientation;
        draft.slicerSide = side || draft.slicerSide;
        preview.orientation = orientation;
        render();
      });
      group.appendChild(b);
    });

  row.appendChild(group);
  return row;
}

// The middle band is represented purely as sections: a `kpi` section (id
// "kpi-2") wedged between two `charts` sections. This reads that shape back
// out of draft.sections rather than a dedicated field — there is no
// dedicated field any more — so the checkbox and its two number inputs have
// something to show and to edit.
function band2Info(theme) {
  const kpiSections = theme.sections.filter(s => s.type === "kpi");
  const section = kpiSections[1] || null;
  if (!section) return { enabled: false, defaultCount: 4, afterRow: 0, section: null, precedingCharts: null };

  const idx = theme.sections.indexOf(section);
  let precedingCharts = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (theme.sections[i].type === "charts") { precedingCharts = theme.sections[i]; break; }
  }
  const rows = precedingCharts ? (precedingCharts.rows ?? 1) : 1;
  return { enabled: true, defaultCount: section.defaultCount, afterRow: Math.max(0, rows - 1), section, precedingCharts };
}

// Inserts the "kpi-2 between two charts sections" shape right after the
// theme's first charts section, splitting it at row 1 (afterRow 0) by
// default — the same split synthesizeSectionsFromLegacy used to produce.
function addBand2Section(sections) {
  const list = sections.map(s => ({ ...s }));
  const firstChartsIdx = list.findIndex(s => s.type === "charts");
  if (firstChartsIdx === -1) return list;

  list[firstChartsIdx] = { ...list[firstChartsIdx], rows: 1 };
  list.splice(firstChartsIdx + 1, 0,
    { type: "kpi", id: "kpi-2", defaultCount: 4, allowSecondRow: false, gapBefore: "auto" },
    { type: "charts", id: "charts-2", rows: null, gapBefore: "auto" }
  );
  return list;
}

// Removes the kpi-2/charts-2 split, reopening the charts section before it
// so the chart area goes back to absorbing every row on its own.
function removeBand2Section(sections) {
  const list = sections.map(s => ({ ...s }));
  const kpi2Idx = list.findIndex(s => s.type === "kpi" && s.id === "kpi-2");
  if (kpi2Idx === -1) return list;

  for (let i = kpi2Idx - 1; i >= 0; i--) {
    if (list[i].type === "charts") { list[i] = { ...list[i], rows: null }; break; }
  }
  return list
    .filter((s, i) => i !== kpi2Idx)
    .filter(s => !(s.type === "charts" && s.id === "charts-2"));
}

function buildBand2Controls() {
  const wrap = el("div", "theme-band2");

  const toggleRow = el("div", "theme-field theme-field--switch");
  toggleRow.appendChild(el("span", "theme-field__label", "Druhý pás KPI"));

  const check = document.createElement("input");
  check.type = "checkbox";
  check.id = "theme-band2-enabled";
  check.className = "theme-check";
  check.addEventListener("change", () => {
    draft = {
      ...draft,
      sections: check.checked ? addBand2Section(draft.sections) : removeBand2Section(draft.sections)
    };
    render();
  });
  toggleRow.appendChild(check);
  wrap.appendChild(toggleRow);

  wrap.appendChild(el("p", "theme-field__hint",
    "Samostatný pás KPI uvnitř plochy grafů — například jeden pás pod hlavičkou a druhý uprostřed stránky."));

  const detail = el("div", "theme-band2__detail");
  detail.appendChild(numberRow("kpiExtraBand.afterRow", "Umístit pod řadu grafů", 1, 12, 1,
    value => {
      const info = band2Info(draft);
      if (!info.precedingCharts) return;
      draft = {
        ...draft,
        sections: draft.sections.map(s => s === info.precedingCharts ? { ...s, rows: Math.max(1, value) } : s)
      };
      render();
    },
    () => band2Info(draft).afterRow + 1));
  detail.appendChild(numberRow("kpiExtraBand.defaultCount", "Počet KPI v pásu", 1, 12, 1,
    value => {
      const info = band2Info(draft);
      if (!info.section) return;
      draft = {
        ...draft,
        sections: draft.sections.map(s => s === info.section ? { ...s, defaultCount: value } : s)
      };
      render();
    },
    () => band2Info(draft).defaultCount));
  wrap.appendChild(detail);

  return wrap;
}

// A plain labelled number input for the handful of values that aren't part of
// the FIELDS table (the band's own two settings, which live on a sub-object).
function numberRow(key, label, min, max, step, onCommit, read) {
  const row = el("div", "theme-field");
  row.dataset.subfield = key;
  row.dataset.region = "kpi-band2";

  const lab = el("label", "theme-field__label", label);
  lab.htmlFor = `theme-input-${key}`;
  row.appendChild(lab);

  const controls = el("div", "theme-field__controls");
  const number = document.createElement("input");
  number.type = "number";
  number.id = `theme-input-${key}`;
  number.className = "theme-field__number";
  number.min = String(min);
  number.max = String(max);
  number.step = String(step);
  number.addEventListener("input", () => {
    const v = Number(number.value);
    if (Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, Math.round(v))));
  });
  controls.appendChild(number);
  row.appendChild(controls);

  row._read = read;
  row._input = number;

  row.addEventListener("mouseenter", () => setHighlight("kpi-band2"));
  row.addEventListener("mouseleave", () => setHighlight(null));

  return row;
}

function buildStagePane() {
  const stage = el("section", "theme-editor__stage");

  const toolbar = el("div", "theme-stage__toolbar");
  toolbar.appendChild(el("span", "theme-stage__toolbar-label", "Náhled pravidel"));

  const orientation = el("div", "theme-toggle theme-toggle--sm");
  [["horizontal", "Slicery nahoře"], ["vertical", "Slicery vlevo"]].forEach(([value, text]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle__option";
    b.dataset.previewOrientation = value;
    b.textContent = text;
    b.title = "Přepne jen náhled — výchozí umístění nastavíte v panelu vlevo.";
    b.addEventListener("click", () => { preview.orientation = value; render(); });
    orientation.appendChild(b);
  });
  toolbar.appendChild(orientation);

  const rows = el("label", "theme-stage__rows");
  rows.appendChild(el("span", null, "Ukázkové řady grafů"));
  const rowsInput = document.createElement("input");
  rowsInput.type = "number";
  rowsInput.min = "1";
  rowsInput.max = "6";
  rowsInput.className = "theme-field__number";
  rowsInput.id = "theme-preview-rows";
  rowsInput.addEventListener("input", () => {
    const v = Number(rowsInput.value);
    if (Number.isFinite(v)) { preview.chartRows = Math.min(6, Math.max(1, Math.round(v))); render(); }
  });
  rows.appendChild(rowsInput);
  toolbar.appendChild(rows);

  stage.appendChild(toolbar);

  const frame = el("div", "theme-stage__frame");
  const canvas = el("div", "theme-preview");
  canvas.id = "theme-preview";
  frame.appendChild(canvas);
  stage.appendChild(frame);

  stage.appendChild(el("div", "theme-stage__readout"));
  stage.appendChild(el("ul", "theme-stage__issues"));

  return stage;
}

// --- Value plumbing -----------------------------------------------------

function setFieldValue(field, rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return;

  const value = field.percent
    ? Math.min(field.max, Math.max(field.min, n)) / 100
    : Math.min(field.max, Math.max(field.min, Math.round(n)));

  draft = resolveDependencies({ ...draft, [field.key]: value });
}

function displayValue(field) {
  return field.percent
    ? Math.round(draft[field.key] * 100)
    : draft[field.key];
}

function setHighlight(region) {
  highlightedRegion = region;
  applyHighlight();
}

function applyHighlight() {
  root.querySelectorAll("[data-region]").forEach(node => {
    node.classList.toggle("is-linked", !!highlightedRegion && node.dataset.region === highlightedRegion);
  });
}

// --- Rendering ----------------------------------------------------------

function render() {
  draft = resolveDependencies(draft);
  renderMeta();
  renderControls();
  renderPreview();
  renderReadout();
  applyHighlight();
}

function renderMeta() {
  const name = root.querySelector("#theme-name");
  if (document.activeElement !== name) name.value = draft.label;

  const changed = diffFromTheme(draft, baseTheme);
  const meta = root.querySelector(".theme-editor__meta");
  meta.textContent = changed.length === 0
    ? `Odvozeno z „${baseTheme.label}" — zatím beze změn`
    : `Odvozeno z „${baseTheme.label}" — ${changed.length} ${plural(changed.length, "změna", "změny", "změn")}`;

  root.querySelector(".theme-editor__delete").hidden = editingExistingId === null;
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function renderControls() {
  FIELDS.forEach(field => {
    const row = root.querySelector(`.theme-field[data-field="${field.key}"]`);
    if (!row) return;
    const value = displayValue(field);
    const range = row.querySelector(".theme-field__range");
    const number = row.querySelector(".theme-field__number");
    range.value = String(value);
    // Never yank the caret out from under someone mid-typing.
    if (document.activeElement !== number) number.value = String(value);
  });

  root.querySelectorAll("[data-orientation]").forEach(b => {
    const matchesOrientation = b.dataset.orientation === draft.defaultSlicerOrientation;
    const matchesSide = !b.dataset.side || b.dataset.side === draft.slicerSide;
    b.classList.toggle("is-active", matchesOrientation && matchesSide);
  });
  root.querySelectorAll("[data-preview-orientation]").forEach(b => {
    b.classList.toggle("is-active", b.dataset.previewOrientation === preview.orientation);
  });

  const band2 = band2Info(draft);
  const check = root.querySelector("#theme-band2-enabled");
  check.checked = band2.enabled;
  root.querySelector(".theme-band2__detail").hidden = !band2.enabled;
  root.querySelectorAll("[data-subfield]").forEach(row => {
    if (document.activeElement !== row._input) row._input.value = String(row._read());
  });

  root.querySelector("#theme-preview-rows").value = String(preview.chartRows);
}

// Feeds sectionWalker.js — the same placement code the real canvas solver
// uses — a *sample* page: the theme's default number of slicers and KPIs,
// and however many chart rows the user is previewing. This used to be a
// hand-rolled reimplementation of the solver's band maths; now it's the
// solver itself, so the preview can never disagree with the canvas about
// where a boundary falls.
function previewLayout() {
  const t = draft;
  const vertical = preview.orientation === "vertical";
  const chartRowCount = preview.chartRows;

  // Every `kpi` section gets at least one sample card, even at
  // defaultCount 0 (the header band's own default) — the preview exists to
  // show the band the rules *would* produce, not to vanish because no page
  // has put anything in it yet.
  const kpiCardsBySectionId = new Map();
  t.sections.filter(s => s.type === "kpi").forEach(s => {
    const count = Math.max(1, s.defaultCount);
    kpiCardsBySectionId.set(s.id, Array.from({ length: count }, () => ({ height: null })));
  });

  const chartsSections = t.sections.filter(s => s.type === "charts");
  const chartGroups = computeChartGroups(chartsSections, chartRowCount);

  const g = walkSections(t, {
    slicerCount: t.defaultSlicersPerRow,
    slicersPerRow: t.defaultSlicersPerRow,
    kpisPerRow: t.defaultKpisPerRow,
    kpiCardsBySectionId,
    chartRowCount,
    chartGroups,
    orientation: vertical ? "vertical" : "horizontal",
    slicerSide: t.slicerSide,
    columnWidth: t.slicerColumnWidth,
    // A flat split across the rows' shared budget — the preview's rows are
    // sample cells, not real charts with their own locked heights, so there
    // is nothing for a real solver like computeChartRowHeights to weigh.
    rowHeightSolver: ({ chartsHeight, chartRowGapCount }) => {
      const rowHeight = chartRowCount > 0
        ? (chartsHeight - chartRowGapCount * t.gapSmall) / chartRowCount
        : 0;
      return new Array(chartRowCount).fill(rowHeight);
    }
  });

  const tooSmall = g.rowHeights.some(h => h < t.hardMinChartHeight);
  return { ...g, vertical, rowCount: chartRowCount, tooSmall };
}

// --- Section reordering ---------------------------------------------------
//
// A theme's band order lives entirely in draft.sections, and both the
// keyboard path and the pointer drag (below) mutate it through the same two
// primitives: mapPlacedToRaw() translates a position in the *rendered*
// stack (what the user actually sees and grabs) back to an index in the
// *raw* sections array (which may hold sections the current sample content
// dropped — an empty KPI band, say), and moveSectionToRawIndex() performs
// the splice. Only "kpi" and "slicers" sections are grabbable — "title" and
// "charts" are the substrate everything else is placed against.
const MOVABLE_SECTION_TYPES = ["kpi", "slicers"];

// There is always exactly one `slicers` section (normalizeSections()
// guarantees it) — this just finds its id, since every id is the theme
// author's own rather than a hardcoded "slicers".
function slicersSectionId(theme) {
  const s = theme.sections.find(s => s.type === "slicers");
  return s ? s.id : "slicers";
}

// A cheap order+shape fingerprint, used to tell a real move from a drop
// that lands back where it started (which must count as no mutation at
// all, not a no-op edit).
function sectionsSignature(list) {
  return list.map(s => `${s.type}:${s.id ?? ""}:${s.rows ?? ""}`).join("|");
}

// previewLayout()'s `g.sections` is the rendered stack, in the same
// relative order as `sections` but with every zero-space entry (an empty
// KPI band, a slicer band with no slicers) dropped. This walks both in
// lockstep to recover, for each rendered entry, which raw index it came
// from — the only thing the splice below actually needs to know.
function mapPlacedToRaw(sections, placed) {
  const rawIndex = [];
  let pi = 0;
  sections.forEach((s, i) => {
    if (pi >= placed.length) return;
    const p = placed[pi];
    if (p.type === s.type && p.id === s.id) { rawIndex.push(i); pi++; }
  });
  return rawIndex;
}

// Removes the section at `fromRaw` and reinserts it immediately before
// whatever now sits at `beforeRaw` (an index into the *original* array —
// the splice below accounts for the shift the removal causes).
function moveSectionToRawIndex(sections, fromRaw, beforeRaw) {
  const list = sections.slice();
  const [item] = list.splice(fromRaw, 1);
  const insertAt = fromRaw < beforeRaw ? beforeRaw - 1 : beforeRaw;
  list.splice(insertAt, 0, item);
  return list;
}

// The keyboard path: Ctrl+ArrowUp/Down on a grip moves its section past
// whichever rendered neighbour sits on that side — the same "one slot" a
// pointer drag would snap to, just without a pointer stream to hit-test.
// Deterministic, so it's also what the pointer drag's own mutations are
// proven against.
function moveSectionOneSlot(sectionType, sectionId, direction) {
  const g = previewLayout();
  const sections = draft.sections;
  const rawIndex = mapPlacedToRaw(sections, g.sections);
  const gi = g.sections.findIndex(s => s.type === sectionType && s.id === sectionId);
  if (gi === -1) return;

  const neighborGi = gi + direction;
  if (neighborGi < 0 || neighborGi >= g.sections.length) return;

  const fromRaw = rawIndex[gi];
  const neighborRaw = rawIndex[neighborGi];
  const beforeRaw = direction < 0 ? neighborRaw : neighborRaw + 1;

  const nextSections = moveSectionToRawIndex(sections, fromRaw, beforeRaw);
  if (sectionsSignature(nextSections) === sectionsSignature(sections)) return;

  draft = normalizeTheme({ ...draft, sections: nextSections });
  render();

  // render() tore down and rebuilt every node, including the grip that had
  // focus — put focus back on the (same conceptual) grip in its new spot so
  // a second Ctrl+ArrowUp/Down keeps working without the user having to
  // tab back to it.
  const node = root.querySelector(
    `.theme-grip[data-section-type="${sectionType}"][data-section-id="${sectionId}"]`
  );
  if (node) node.focus();
}

// Six-dot grab handle, inset into a movable region's top-left corner. Not
// the region body (already the hover-highlight target) and not its edges
// (the resize `dragHandle`s) — its own small hit area, so a resize drag and
// a reorder drag can never fight over the same pointerdown.
function grip(sectionType, sectionId) {
  const handle = el("div", "theme-grip");
  handle.dataset.sectionType = sectionType;
  handle.dataset.sectionId = sectionId;
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Přesunout pás");
  handle.title = "Táhnutím, nebo Ctrl+šipkou nahoru/dolů, přesunete tento pás.";
  for (let i = 0; i < 6; i++) handle.appendChild(el("span", "theme-grip__dot"));

  handle.addEventListener("keydown", e => {
    if (!e.ctrlKey) return;
    if (e.key === "ArrowUp") { e.preventDefault(); moveSectionOneSlot(sectionType, sectionId, -1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveSectionOneSlot(sectionType, sectionId, 1); }
  });

  handle.addEventListener("pointerdown", e => startSectionDrag(e, sectionType, sectionId));

  return handle;
}

// The pointer drag itself — implemented separately below; kept as its own
// function so grip() (and its keyboard path) don't need to know anything
// about it beyond "call this on pointerdown".
// Every place the dragged section could land, computed ONCE at pointerdown
// and then frozen for the rest of the gesture — pointermove only has to
// pick the nearest one and move a ghost, never touch `draft` or re-render.
//
//   "boundary"  — every gap in the *rendered* stack (above the first
//                 entry, between each pair, below the last). Always valid
//                 to try; whether it actually changes anything is decided
//                 once, up front, and cached as `invalid`.
//   "split"     — a chart-row boundary strictly *inside* a charts group.
//                 Dropping there splits that theme section into two,
//                 sandwiching the dragged section between the row it
//                 claims and the rows that are left.
//   "gutter"    — the two vertical strips beside the usable area, offered
//                 only while dragging the slicers section; they turn it
//                 into the vertical column instead of reordering it.
function buildDropSlots(theme, g, rawIndex, sections, draggedType, draggedRaw) {
  const slots = [];
  const originalSignature = sectionsSignature(sections);
  const originalOrientation = theme.defaultSlicerOrientation;
  const originalSide = theme.slicerSide;

  const boundaryY = k => {
    if (g.sections.length === 0) return theme.margin;
    if (k === 0) return g.sections[0].top;
    if (k === g.sections.length) return g.sections[g.sections.length - 1].bottom;
    return (g.sections[k - 1].bottom + g.sections[k].top) / 2;
  };

  for (let k = 0; k <= g.sections.length; k++) {
    const beforeRaw = k < rawIndex.length ? rawIndex[k] : sections.length;
    const nextSections = moveSectionToRawIndex(sections, draggedRaw, beforeRaw);
    const changesOrder = sectionsSignature(nextSections) !== originalSignature;
    // A slicer dragged out of its vertical column and dropped on an
    // ordinary stack slot always flips it back to horizontal, even when
    // that slot happens to leave the array order unchanged.
    const flipsOrientation = draggedType === "slicers" && originalOrientation !== "horizontal";
    slots.push({
      kind: "boundary",
      y: boundaryY(k),
      invalid: !changesOrder && !flipsOrientation,
      apply: () => ({
        sections: nextSections,
        ...(draggedType === "slicers" ? { defaultSlicerOrientation: "horizontal" } : {})
      })
    });
  }

  g.sections.forEach((entry, gi) => {
    if (entry.type !== "charts") return;
    const { startRow, count } = entry.group;
    const groupRaw = rawIndex[gi];
    for (let r = 1; r < count; r++) {
      const y = (g.rowTops[startRow + r - 1] + g.rowHeights[startRow + r - 1] + g.rowTops[startRow + r]) / 2;
      slots.push({
        kind: "split",
        y,
        invalid: false,
        apply: () => {
          const orig = sections[groupRaw];
          const secondRows = orig.rows === null ? null : orig.rows - r;
          const first = { ...orig, rows: r };
          // A placeholder id — normalizeTheme()'s dedup pass renames it if
          // it collides with anything, so there is nothing to get right
          // here beyond "not the same id as `first`".
          const second = { ...orig, rows: secondRows, id: `${orig.id}-split` };
          const list = sections.slice();
          const [dragged] = list.splice(draggedRaw, 1);
          const insertAt = groupRaw > draggedRaw ? groupRaw - 1 : groupRaw;
          list.splice(insertAt, 1, first, dragged, second);
          return {
            sections: list,
            ...(draggedType === "slicers" ? { defaultSlicerOrientation: "horizontal" } : {})
          };
        }
      });
    }
  });

  if (draggedType === "slicers") {
    const zones = [
      { side: "left", x0: 0, x1: theme.margin + theme.slicerColumnWidth },
      { side: "right", x0: theme.canvasWidth - theme.margin - theme.slicerColumnWidth, x1: theme.canvasWidth }
    ];
    zones.forEach(zone => {
      slots.push({
        kind: "gutter",
        side: zone.side,
        x0: zone.x0,
        x1: zone.x1,
        y: theme.canvasHeight / 2,
        invalid: originalOrientation === "vertical" && originalSide === zone.side,
        // The slicers section itself never moves in the array — dragging
        // it back out of the column is what stays lossless.
        apply: () => ({ sections, defaultSlicerOrientation: "vertical", slicerSide: zone.side })
      });
    });
  }

  return slots;
}

// Nearest slot by |cursorY - slot.y|, except a gutter always wins on pure
// x-containment while dragging the slicers section — the point of a gutter
// is to be droppable without having to line the cursor up with any
// particular row.
function pickSlot(slots, cursorX, cursorY, draggedType) {
  if (draggedType === "slicers") {
    const gutter = slots.find(s => s.kind === "gutter" && cursorX >= s.x0 && cursorX <= s.x1);
    if (gutter) return gutter;
  }
  let best = null;
  let bestDist = Infinity;
  slots.forEach(s => {
    if (s.kind === "gutter") return;
    const d = Math.abs(cursorY - s.y);
    if (d < bestDist) { bestDist = d; best = s; }
  });
  return best;
}

function startSectionDrag(event, sectionType, sectionId) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  try { event.target.setPointerCapture(event.pointerId); } catch { /* not every target supports it */ }

  const stage = root.querySelector("#theme-preview");
  const stageRect = stage.getBoundingClientRect();
  const scale = Number(stage.style.getPropertyValue("--preview-scale")) || 1;

  const theme = draft;
  const g = previewLayout();
  const sections = draft.sections;
  const rawIndex = mapPlacedToRaw(sections, g.sections);
  const draggedGi = g.sections.findIndex(s => s.type === sectionType && s.id === sectionId);
  if (draggedGi === -1) return;
  const draggedRaw = rawIndex[draggedGi];

  const slots = buildDropSlots(theme, g, rawIndex, sections, sectionType, draggedRaw);

  const regionEl = event.currentTarget.closest("[data-region]");
  const regionRect = regionEl.getBoundingClientRect();
  const offsetX = regionRect.left - event.clientX;
  const offsetY = regionRect.top - event.clientY;

  const ghost = el("div", "theme-ghost");
  ghost.style.width = `${regionRect.width}px`;
  ghost.style.height = `${regionRect.height}px`;
  ghost.style.left = `${regionRect.left - stageRect.left}px`;
  ghost.style.top = `${regionRect.top - stageRect.top}px`;
  stage.appendChild(ghost);

  const line = el("div", "theme-insertion-line theme-insertion-line--h");
  line.hidden = true;
  stage.appendChild(line);

  document.body.classList.add("theme-editor-reordering");

  let chosenSlot = null;

  const showLine = slot => {
    if (!slot || slot.invalid) { line.hidden = true; return; }
    line.hidden = false;
    if (slot.kind === "gutter") {
      line.className = "theme-insertion-line theme-insertion-line--v";
      const x = slot.side === "right"
        ? theme.canvasWidth - theme.margin - theme.slicerColumnWidth
        : theme.margin + theme.slicerColumnWidth;
      line.style.left = `${x * scale}px`;
      line.style.top = "0px";
      line.style.height = `${theme.canvasHeight * scale}px`;
    } else {
      line.className = "theme-insertion-line theme-insertion-line--h";
      line.style.top = `${slot.y * scale}px`;
      line.style.left = "0px";
      line.style.width = `${theme.canvasWidth * scale}px`;
    }
  };

  const move = e => {
    ghost.style.left = `${e.clientX + offsetX - stageRect.left}px`;
    ghost.style.top = `${e.clientY + offsetY - stageRect.top}px`;

    const cursorThemeX = (e.clientX - stageRect.left) / scale;
    const cursorThemeY = (e.clientY - stageRect.top) / scale;
    chosenSlot = pickSlot(slots, cursorThemeX, cursorThemeY, sectionType);
    showLine(chosenSlot);
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", drop);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onKeydown, true);
    document.body.classList.remove("theme-editor-reordering");
    ghost.remove();
    line.remove();
  };

  const drop = () => {
    cleanup();
    if (!chosenSlot || chosenSlot.invalid) return;   // no-op: nothing to mutate
    const patch = chosenSlot.apply();
    draft = normalizeTheme({ ...draft, ...patch });
    // The preview's own orientation toggle is deliberately independent of
    // the theme's default (it's how you preview a horizontal theme's
    // vertical shape without committing to it) — but a drag that changes
    // the default orientation is the user setting it, same as the toggle
    // in the controls pane, so the preview should follow it here too.
    if (patch.defaultSlicerOrientation) preview.orientation = patch.defaultSlicerOrientation;
    render();
  };

  const cancel = () => cleanup();   // aborts with zero mutation

  // Capture phase, and stopped from propagating further: the dialog itself
  // has its own document-level Escape handler that closes the whole editor
  // (bubble phase, so it would otherwise run *first*, since document sits
  // between the event's target and window) — a drag's Escape must abort
  // the drag, not the dialog underneath it.
  const onKeydown = e => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", drop);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", onKeydown, true);
}

function renderPreview() {
  // Exposed for the test harness: a reorder drag must call render() exactly
  // once (on a successful drop), never on every pointermove.
  window.__themeRenderPreviewCalls = (window.__themeRenderPreviewCalls || 0) + 1;

  const stage = root.querySelector("#theme-preview");
  const frame = root.querySelector(".theme-stage__frame");
  stage.innerHTML = "";

  const t = draft;
  const availW = Math.max(120, frame.clientWidth - 32);
  const availH = Math.max(120, frame.clientHeight - 32);
  const scale = Math.min(availW / t.canvasWidth, availH / t.canvasHeight) || 0.2;

  stage.style.width = `${t.canvasWidth * scale}px`;
  stage.style.height = `${t.canvasHeight * scale}px`;
  stage.style.setProperty("--preview-scale", String(scale));

  const g = previewLayout();
  const px = v => `${v * scale}px`;

  // The usable-area outline — context only, no region of its own: it marks
  // where content may go, and it is nearly the size of the whole preview, so
  // highlighting it would read as "everything" rather than as one setting.
  const usable = el("div", "theme-region theme-region--usable");
  usable.style.left = px(t.margin);
  usable.style.top = px(t.margin);
  usable.style.width = px(usableWidth(t));
  usable.style.height = px(usableHeight(t));
  usable.appendChild(tag(`Použitelná plocha ${usableWidth(t)} × ${usableHeight(t)}`, "theme-tag--usable"));
  stage.appendChild(usable);

  // The margin itself, drawn as the four bands of outer space it actually is.
  // Without these the one thing the margin control governs is empty canvas
  // with no element in it, so there is nothing to highlight when the control
  // is hovered and nothing to hover to find the control. All four carry the
  // same region name and edit the same single value — dragging any inner edge
  // moves the margin on every side at once, which is what one margin means.
  const inner = usableHeight(t);
  [
    { side: "top", box: { left: 0, top: 0, width: t.canvasWidth, height: t.margin }, axis: "y", sign: 1 },
    { side: "bottom", box: { left: 0, top: t.canvasHeight - t.margin, width: t.canvasWidth, height: t.margin }, axis: "y", sign: -1, edge: "top" },
    { side: "left", box: { left: 0, top: t.margin, width: t.margin, height: inner }, axis: "x", sign: 1 },
    { side: "right", box: { left: t.canvasWidth - t.margin, top: t.margin, width: t.margin, height: inner }, axis: "x", sign: -1, edge: "left" }
  ].forEach(band => {
    const node = region("margin", `theme-region theme-region--margin theme-region--margin-${band.side}`, band.box, px);
    // The label only fits once the band is a few real pixels tall; below that
    // it would spill over the header. The drag handle stays either way, so a
    // margin dragged down to 0 can always be dragged back out.
    if (band.side === "top" && t.margin * scale >= 11) {
      node.appendChild(el("span", "theme-margin__value", `Okraj plátna · ${t.margin} px`));
    }
    node.appendChild(dragHandle("margin", band.axis, band.sign, scale, band.edge));
    stage.appendChild(node);
  });

  // Header
  const title = region("title", "theme-region theme-region--title", {
    left: t.margin, top: g.TITLE_Y, width: usableWidth(t), height: t.titleHeight
  }, px);
  title.appendChild(tag(`Hlavička · ${t.titleHeight} px`));
  title.appendChild(dragHandle("titleHeight", "y", 1, scale));
  stage.appendChild(title);

  // Slicers — a whole stripe, not one card.
  if (g.vertical) {
    const column = region("slicer-column", "theme-region theme-region--slicer", {
      left: g.slicerColumnLeft, top: g.slicerColumnTop,
      width: t.slicerColumnWidth, height: g.slicerColumnHeight
    }, px);
    column.appendChild(tag(
      `Sloupec slicerů · ${t.slicerColumnWidth} px (${t.minSlicerColumnWidth}–${t.maxSlicerColumnWidth})`,
      // A tall narrow column has no room for a one-line tag, so this one wraps.
      "theme-tag--wrap"
    ));
    stackCells(column, Math.max(2, Math.floor(g.slicerColumnHeight / (t.slicerHeight + t.gapSmall))),
      t.gapSmall * scale, "column");
    column.appendChild(dragHandle("slicerColumnWidth", "x", 1, scale));
    column.appendChild(grip("slicers", slicersSectionId(t)));
    stage.appendChild(column);
  } else {
    const stripe = region("slicer", "theme-region theme-region--slicer", {
      left: t.margin, top: g.slicersTop, width: usableWidth(t), height: t.slicerHeight
    }, px);
    stripe.appendChild(tag(
      `Slicery · ${t.defaultSlicersPerRow}× ${cellWidth(usableWidth(t), t.defaultSlicersPerRow, t.gapSmall)} px` +
      ` · min ${t.minSlicerWidth} px · výška ${t.slicerHeight} px`
    ));
    stackCells(stripe, t.defaultSlicersPerRow, t.gapSmall * scale, "row");
    stripe.appendChild(dragHandle("slicerHeight", "y", 1, scale));
    stripe.appendChild(grip("slicers", slicersSectionId(t)));
    stage.appendChild(stripe);
  }

  // KPI bands — the walker's `placed` list gives every kpi section actually
  // showing (thanks to previewLayout()'s at-least-one-sample-card seeding,
  // that's every kpi section the theme defines) its real top/height, so
  // there is nothing left to recompute here. The header band is the first
  // of them; the classic "second" band, if the theme has one, is the second.
  const kpiEntries = g.sections.filter(s => s.type === "kpi");
  const headerKpi = kpiEntries[0] || null;
  const band2Kpi = kpiEntries[1] || null;

  if (headerKpi) {
    const kpi = region("kpi", "theme-region theme-region--kpi", {
      left: g.contentLeft, top: headerKpi.top, width: g.contentWidth, height: headerKpi.height
    }, px);
    kpi.appendChild(tag(
      `KPI · ${t.defaultKpisPerRow}× ${cellWidth(g.contentWidth, t.defaultKpisPerRow, t.gapSmall)} px · výška ${t.kpiMinHeight} px`
    ));
    stackCells(kpi, t.defaultKpisPerRow, t.gapSmall * scale, "row");
    kpi.appendChild(dragHandle("kpiMinHeight", "y", 1, scale));
    kpi.appendChild(grip("kpi", headerKpi.id));
    stage.appendChild(kpi);
  }

  // Chart rows — g.rowTops/g.rowHeights already account for a middle band
  // carving space out between two of them, exactly as the real canvas does.
  for (let i = 0; i < g.rowCount; i++) {
    const top = g.rowTops[i];
    const height = g.rowHeights[i];
    const row = region("charts", "theme-region theme-region--chart", {
      left: g.contentLeft, top, width: g.contentWidth, height
    }, px);
    if (i === 0) {
      row.appendChild(tag(
        `Grafy · řada ${Math.round(height)} px (min ${t.minChartRowHeight}) · min šířka ${t.minChartWidth} px`
      ));
    }
    if (g.tooSmall) row.classList.add("is-too-small");
    stackCells(row, preview.chartCols, t.gapSmall * scale, "row");
    stage.appendChild(row);
  }

  if (band2Kpi) {
    const afterRow = band2Info(t).afterRow;
    const band = region("kpi-band2", "theme-region theme-region--kpi theme-region--band2", {
      left: g.contentLeft, top: band2Kpi.top, width: g.contentWidth, height: band2Kpi.height
    }, px);
    band.appendChild(tag(
      `Druhý pás KPI · ${band2Kpi.defaultCount}× ${cellWidth(g.contentWidth, band2Kpi.defaultCount, t.gapSmall)} px · pod ${afterRow + 1}. řadou`
    ));
    stackCells(band, band2Kpi.defaultCount, t.gapSmall * scale, "row");
    band.appendChild(grip("kpi", band2Kpi.id));
    stage.appendChild(band);
  }

  // Gap rulers — the two spacing values are otherwise invisible negative
  // space, so each gets a measured, draggable strip of its own. Which gap
  // falls where swaps with the orientation, exactly as the real solver does:
  // horizontally the slicer band is separated from the title by the small
  // gap and the KPIs from the charts by the block gap, while vertically the
  // content block hangs off the title by the block gap and the charts follow
  // the KPIs at the small one.
  const smallGapTop = g.vertical ? g.chartsTop - t.gapSmall : g.slicersTop - t.gapSmall;
  const blockGapTop = g.vertical ? g.kpiTop - t.gapKpiToCharts : g.chartsTop - t.gapKpiToCharts;

  stage.appendChild(gapRuler("gap-small", "gapSmall", t.gapSmall, {
    left: g.vertical ? g.contentLeft : t.margin,
    top: smallGapTop,
    width: g.vertical ? g.contentWidth : usableWidth(t),
    height: t.gapSmall
  }, px, scale));

  stage.appendChild(gapRuler("gap-block", "gapKpiToCharts", t.gapKpiToCharts, {
    left: g.vertical ? t.margin : g.contentLeft,
    top: blockGapTop,
    width: g.vertical ? usableWidth(t) : g.contentWidth,
    height: t.gapKpiToCharts
  }, px, scale));
}

function cellWidth(total, count, gap) {
  if (count <= 0) return 0;
  return Math.max(0, Math.floor((total - (count - 1) * gap) / count));
}

function region(regionName, className, box, px) {
  const node = el("div", className);
  node.dataset.region = regionName;
  node.style.left = px(box.left);
  node.style.top = px(box.top);
  node.style.width = px(box.width);
  node.style.height = px(box.height);
  node.addEventListener("mouseenter", () => setHighlight(regionName));
  node.addEventListener("mouseleave", () => setHighlight(null));
  return node;
}

function tag(text, extra) {
  const node = el("span", `theme-tag${extra ? " " + extra : ""}`, text);
  return node;
}

// Draws the region's internal division into cells, so a stripe reads as "the
// slicers that will sit here", not as one big block.
function stackCells(parent, count, gapPx, direction) {
  const grid = el("div", `theme-cells theme-cells--${direction}`);
  grid.style.gap = `${Math.max(1, gapPx)}px`;
  for (let i = 0; i < Math.max(1, count); i++) grid.appendChild(el("div", "theme-cell"));
  parent.appendChild(grid);
}

function gapRuler(regionName, fieldKey, value, box, px, scale) {
  const node = region(regionName, "theme-region theme-region--gap", box, px);
  node.appendChild(el("span", "theme-gap__value", `${value} px`));
  node.appendChild(dragHandle(fieldKey, "y", 1, scale));
  return node;
}

// A grab strip on a region edge that edits one field directly. `sign` is +1
// when dragging away from the origin grows the value and -1 when it shrinks
// it (the margin's top edge moves down as the margin grows, so its own handle
// is inverted).
function dragHandle(fieldKey, axis, sign, scale, side) {
  const field = FIELD_BY_KEY[fieldKey];
  const handle = el("div", `theme-handle theme-handle--${axis}${side ? " theme-handle--" + side : ""}`);
  handle.title = `Táhnutím upravíte: ${field.label}`;

  handle.addEventListener("pointerdown", event => {
    event.preventDefault();
    event.stopPropagation();

    const start = axis === "x" ? event.clientX : event.clientY;
    const startValue = draft[fieldKey];
    setHighlight(field.region);

    const move = e => {
      const now = axis === "x" ? e.clientX : e.clientY;
      const delta = ((now - start) / scale) * sign;
      setFieldValue(field, startValue + delta);
      render();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("theme-editor-dragging");
      setHighlight(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.body.classList.add("theme-editor-dragging");
  });

  return handle;
}

function renderReadout() {
  const t = draft;
  const g = previewLayout();
  const readout = root.querySelector(".theme-stage__readout");
  readout.innerHTML = "";

  const stats = [
    ["Plátno", `${t.canvasWidth} × ${t.canvasHeight}`],
    ["Použitelná plocha", `${usableWidth(t)} × ${usableHeight(t)}`],
    ["Výška řady grafů", `${Math.max(0, Math.round(g.rowHeights[0] ?? 0))} px`],
    ["Šířka obsahu", `${g.contentWidth} px`],
    ["Krok mřížky", `${t.step} px`]
  ];

  stats.forEach(([label, value]) => {
    const item = el("div", "theme-stat");
    item.appendChild(el("span", "theme-stat__label", label));
    item.appendChild(el("span", "theme-stat__value", value));
    readout.appendChild(item);
  });

  const issues = validateTheme(t);
  if (g.tooSmall) {
    issues.push({
      severity: "warning",
      text: `Při ${g.rowCount} řadách vychází výška řady pod absolutní minimum ${t.hardMinChartHeight} px.`
    });
  }

  const list = root.querySelector(".theme-stage__issues");
  list.innerHTML = "";
  if (issues.length === 0) {
    const ok = el("li", "theme-issue theme-issue--ok", "Šablona je v pořádku.");
    list.appendChild(ok);
  } else {
    issues.forEach(issue => {
      list.appendChild(el("li", `theme-issue theme-issue--${issue.severity}`, issue.text));
    });
  }

  root.querySelector(".theme-btn--primary").disabled = issues.some(i => i.severity === "error");
}

// --- Actions ------------------------------------------------------------

function requestClose() {
  closeThemeEditor();
}

function handleSave() {
  const label = String(draft.label || "").trim();
  if (!label) {
    flash("Zadejte název šablony.", "error");
    root.querySelector("#theme-name").focus();
    return;
  }

  const theme = { ...normalizeTheme({ ...draft, label }), builtin: false };

  // A theme created from a built-in gets its id at save time, from the name
  // the user settled on — an id minted at open time would carry the throwaway
  // "FULL HD – vlastní" wording forever.
  if (editingExistingId === null) theme.id = makeThemeId(label);
  else theme.id = editingExistingId;

  const result = saveTheme(theme);
  if (!result.ok) {
    flash(result.error, "error");
    return;
  }

  editingExistingId = result.theme.id;
  draft = cloneTheme(result.theme);

  closeThemeEditor();
  if (onApply) onApply(result.theme);
}

function handleDelete() {
  if (editingExistingId === null) return;
  const inUse = getAllThemes().find(t => t.id === editingExistingId);
  if (!inUse) return;

  if (!window.confirm(`Smazat šablonu „${draft.label}"? Stránky, které ji používají, si ponechají její současné nastavení.`)) return;

  const result = deleteTheme(editingExistingId);
  if (!result.ok) {
    flash(result.error, "error");
    return;
  }

  closeThemeEditor();
  if (onApply) onApply(null);
}

function handleExport() {
  const label = String(draft.label || "theme").trim();
  const safe = label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sablona";
  downloadJson(`kb-sablona-${safe}.json`, exportThemeJson(draft));
}

function handleImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";           // so re-picking the same file still fires
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseThemeFile(String(reader.result));
    if (!parsed.ok) {
      flash(parsed.error, "error");
      return;
    }

    // One theme in the file loads straight into the editor for review; a
    // collection is saved wholesale, since there is nothing sensible to show
    // in a single-theme editor for five themes at once.
    if (parsed.themes.length === 1) {
      draft = { ...parsed.themes[0], builtin: false, id: draft.id, label: parsed.themes[0].label };
      editingExistingId = null;
      render();
      flash(`Načtena šablona „${draft.label}".`, "ok");
      return;
    }

    const result = importThemes(parsed.themes);
    if (!result.ok) {
      flash(result.error, "error");
      return;
    }
    closeThemeEditor();
    if (onApply) onApply(result.imported[result.imported.length - 1]);
  };
  reader.onerror = () => flash("Soubor se nepodařilo přečíst.", "error");
  reader.readAsText(file);
}

function flash(text, severity) {
  const list = root.querySelector(".theme-stage__issues");
  const node = el("li", `theme-issue theme-issue--${severity === "ok" ? "ok" : "error"}`, text);
  list.prepend(node);
  setTimeout(() => node.remove(), 4000);
}
