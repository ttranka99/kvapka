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
  GROUPS,
  FIELD_BY_KEY,
  normalizeTheme,
  resolveDependencies,
  cloneTheme,
  validateTheme,
  usableWidth,
  usableHeight,
  diffFromTheme,
  PLACEMENTS,
  placementLabel,
  isVerticalPlacement,
  sideOfPlacement,
  baselineFor,
  fieldsFor,
  fieldLabel,
  fieldHint,
  fieldRegion,
  groupNote
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
let onClose = null;           // fired on every exit path (see closeThemeEditor)
// Preview-only knobs. Orientation is deliberately NOT one of them any more:
// the preview shows the layout being edited, and a layout has exactly one
// shape. A toggle here would put a picture of the other placement next to
// controls that cannot affect it.
let preview = {
  chartRows: 2
};
let highlightedRegion = null;

// How many cells a preview chart row is drawn as. Fixed: the preview shows
// the shape a theme's rules produce, and nothing in a theme governs how many
// charts end up in a row (that follows from minChartWidth at layout time).
const PREVIEW_CHART_COLS = 2;

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
 * @param {() => void} [options.onClose]  called whenever the editor closes,
 *                                however it closes — the rail uses it to
 *                                hand the screen back to the template section
 */
export function openThemeEditor(options) {
  const source = normalizeTheme(options.theme);
  // Built-ins are read-only baselines, so opening one always forks. `mode:
  // "new"` forks a custom theme too — that is the sidebar's "new theme"
  // button, which seeds from whatever is active rather than starting blank.
  const fork = source.builtin || options.mode === "new";

  if (fork) {
    editingExistingId = null;
    draft = cloneTheme(source);
    draft.builtin = false;
    draft.derivedFrom = source.builtin ? source.id : source.derivedFrom;
    draft.label = `${source.label} – kopie`;
    draft.id = makeThemeId(draft.label);
  } else {
    editingExistingId = source.id;
    draft = cloneTheme(source);
  }

  // Always a built-in of the draft's own placement — comparing a vertical
  // layout against a horizontal preset would report every slicer field as a
  // change the user never made.
  baseTheme = cloneTheme(baselineFor(draft));
  onApply = options.onApply || null;
  onClose = options.onClose || null;

  // Force both to rebuild for this draft: the dialog is reused across opens,
  // so last session's field set and chooser/badge choice are still in it.
  controlsPlacement = null;
  placementIsEditable = null;

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
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove("theme-editor-open");
  if (onClose) onClose();
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
      requestAnimationFrame(() => { queued = false; renderPreview(previewLayout()); });
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

  // Rebuilt by render(), since it switches between a chooser and a badge and
  // its options track the draft — unlike the rest of the head, which is
  // static once built.
  head.appendChild(el("div", "theme-editor__placement-slot"));

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

  // Only the fields this layout's shape actually uses. A control that governs
  // the other placement would sit here doing nothing visible — worse than not
  // being offered — and its preview region doesn't exist to highlight either.
  // The values behind the hidden fields are still carried and still saved.
  const visible = fieldsFor(draft.placement);

  GROUPS.forEach(group => {
    const fields = visible.filter(f => f.group === group.id);
    const extras = group.id === "kpis";

    // A group whose fields are all out of scope contributes nothing but a
    // heading. None empties today; the rule keeps that true as fields are
    // added later.
    if (!fields.length && !extras) return;

    const section = el("section", "theme-group");
    section.dataset.group = group.id;

    section.appendChild(el("h3", "theme-group__title", group.label));
    const note = groupNote(group, draft.placement);
    if (note) section.appendChild(el("p", "theme-group__note", note));

    fields.forEach(field => section.appendChild(buildField(field)));

    // The KPI band list rides along with the group it belongs to, rather than
    // living in a separate "advanced" pane the user has to go hunting for.
    if (extras) section.appendChild(buildKpiBandsControl());

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

  // A field that survives into both placements can still mean different
  // things in each (slicerHeight is a band height in a row and a per-slicer
  // floor in a column), so both the wording and the region it lights up come
  // from the draft's placement.
  const region = fieldRegion(field, draft.placement);
  if (region) row.dataset.region = region;

  const label = el("label", "theme-field__label", fieldLabel(field, draft.placement));
  label.htmlFor = `theme-input-${field.key}`;
  const hint = fieldHint(field, draft.placement);
  if (hint) label.title = hint;
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
  if (hint) row.appendChild(el("p", "theme-field__hint", hint));

  if (region) {
    row.addEventListener("mouseenter", () => setHighlight(region));
    row.addEventListener("mouseleave", () => setHighlight(null));
    number.addEventListener("focus", () => setHighlight(region));
    number.addEventListener("blur", () => setHighlight(null));
  }

  return row;
}

// Where the slicers stand — the one property that decides which *layout*
// this is, rather than how it is tuned. It sits in the dialog head next to
// the name for that reason: both identify the template, neither adjusts it.
//
// It is settable only while the layout is new. Flipping it on a saved layout
// would silently turn one template into another — every page using it would
// change shape — so an existing layout shows the placement as a badge and
// offers no way to change it. Building the other orientation is a separate
// act: start a new template and choose its placement here.
function buildPlacementControl() {
  const row = el("div", "theme-editor__placement");
  row.appendChild(el("span", "theme-editor__placement-label", "Slicery"));

  if (editingExistingId !== null) {
    const badge = el("span", "theme-editor__placement-badge", placementLabel(draft.placement));
    badge.title = "Umístění slicerů je součástí šablony a po uložení se už nemění. Jinou variantu vytvoříte jako novou šablonu.";
    row.appendChild(badge);
    return row;
  }

  const group = el("div", "theme-toggle theme-toggle--sm");
  PLACEMENTS.forEach(placement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle__option";
    b.dataset.placement = placement;
    b.textContent = placementLabel(placement);
    b.addEventListener("click", () => {
      if (draft.placement === placement) return;
      // Straight through normalizeTheme so the baseline follows the new
      // shape too — otherwise a layout flipped to vertical would keep
      // diffing itself against a horizontal preset.
      draft = normalizeTheme({ ...draft, placement });
      baseTheme = cloneTheme(baselineFor(draft));
      render();
    });
    group.appendChild(b);
  });

  row.appendChild(group);
  return row;
}

// A band row's heading — the first `kpi` section is the header band; every
// other one names the chart row it follows.
function bandTitle(section, index, g) {
  return index === 0
    ? "Pás KPI (hlavička)"
    : `Pás KPI ${index + 1} · pod ${afterRowLabel(draft, section, g && g.chartGroups)}. řadou`;
}

// The 1-based chart row a KPI band visually follows, for its preview label.
//
// Every `charts` section above the band contributes its rows, not just the
// nearest one — with two bands the lower one sits under the *sum*, and
// labelling it by its immediate neighbour alone called row 3 "row 1".
// `chartGroups` (from computeChartGroups, via previewLayout) is what says how
// many rows each section actually got, including the open-ended one; without
// it a fixed `rows` is the best available answer and a null counts as one.
function afterRowLabel(theme, section, chartGroups) {
  const countFor = s => {
    const group = chartGroups && chartGroups.find(g => g.sectionId === s.id);
    return group ? group.count : (s.rows ?? 1);
  };

  const idx = theme.sections.indexOf(section);
  const rows = theme.sections
    .slice(0, idx < 0 ? 0 : idx)
    .filter(s => s.type === "charts")
    .reduce((sum, s) => sum + countFor(s), 0);

  return Math.max(1, rows);
}

// Appends a new KPI band at the end of the stack, with a fresh open-ended
// charts section absorbing whatever rows are left below it. Exactly one
// charts section may stay open-ended — computeChartGroups() (chartGroups.js)
// only resolves "whatever's left" correctly for the *last* one — so the
// theme's current last section (until now the absorber) is pinned to a
// single fixed row first; that single row is what ends up sitting between
// the existing content and the new band, mirroring the previous single
// "second band"'s default placement. Ids are placeholders; normalizeTheme()'s
// dedup pass renames them if they collide with anything a previous "+"
// already added.
function appendKpiBand(sections) {
  const list = sections.map(s => ({ ...s }));
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === "charts") {
      list[i].rows = list[i].rows ?? 1;
      break;
    }
  }
  list.push(
    { type: "kpi", id: "kpi-new", defaultCount: 4, allowSecondRow: false, gapBefore: "auto" },
    { type: "charts", id: "charts-new", rows: null, gapBefore: "auto" }
  );
  return list;
}

const GAP_BEFORE_LABELS = { auto: "Auto", small: "Malá", block: "Velká" };

// One row per `kpi` section — replaces the old fixed "header band + one
// optional second band" checkbox with a list that scales to however many a
// theme actually defines. defaultCount/allowSecondRow/gapBefore are edited
// in place; removing a row leaves its cards to state.applyTheme's own
// reconciliation (reconcileKpiBands in state.js), which rehomes them to
// the nearest surviving band rather than dropping them.
// Replaces one section in the draft with a patched copy of itself. All four
// band-row controls edit exactly one field this way, so they share it rather
// than each spelling out the same map-over-sections.
//
// Addressed by id, never by object identity: normalizeTheme() returns fresh
// section objects every time, while a band row (and the listener closing over
// it) outlives any number of renders — see renderKpiBandsList. Matching on
// identity meant every edit after the first silently patched nothing.
function updateSection(sectionId, patch) {
  draft = normalizeTheme({
    ...draft,
    sections: draft.sections.map(s => (s.id === sectionId ? { ...s, ...patch } : s))
  });
  render();
}

function removeSection(sectionId) {
  draft = normalizeTheme({ ...draft, sections: draft.sections.filter(s => s.id !== sectionId) });
  render();
}

function renderKpiBandsList(g) {
  const list = root.querySelector("#theme-kpi-bands-list");
  if (!list) return;

  const sections = draft.sections.filter(s => s.type === "kpi");

  // Rebuilding these rows unconditionally would destroy whichever control the
  // user is typing in — render() runs on every keystroke, so "12" could never
  // be entered into a count field. Only rebuild when the *set* of bands has
  // actually changed; otherwise refresh the values in place, skipping the
  // focused control, exactly as renderControls() does for the FIELDS inputs.
  const rendered = [...list.querySelectorAll(".theme-kpi-band")];
  const sameBands = rendered.length === sections.length
    && rendered.every((row, i) => row.dataset.kpiBandId === sections[i].id);

  if (sameBands) {
    rendered.forEach((row, i) => {
      const section = sections[i];
      const count = row.querySelector(".theme-kpi-band__count");
      const secondRow = row.querySelector(".theme-check");
      const gapSelect = row.querySelector(".theme-kpi-band__gap");
      if (document.activeElement !== count) count.value = String(section.defaultCount);
      if (document.activeElement !== secondRow) secondRow.checked = section.allowSecondRow;
      if (document.activeElement !== gapSelect) gapSelect.value = section.gapBefore;
      row.querySelector(".theme-kpi-band__title").textContent = bandTitle(section, i, g);
    });
    return;
  }

  list.innerHTML = "";

  sections.forEach((section, i) => {
    // The row outlives the `section` object it was built from, so every
    // listener below closes over this id rather than that object.
    const bandId = section.id;
    const row = el("div", "theme-kpi-band");
    row.dataset.kpiBandId = bandId;
    row.dataset.region = "kpi-band2";

    row.appendChild(el("span", "theme-kpi-band__title", bandTitle(section, i, g)));

    const countField = el("label", "theme-kpi-band__field");
    countField.appendChild(el("span", null, "Počet KPI"));
    const count = document.createElement("input");
    count.type = "number";
    count.className = "theme-kpi-band__count";
    count.min = "0";
    count.max = "12";
    count.step = "1";
    count.value = String(section.defaultCount);
    count.addEventListener("input", () => {
      const v = Number(count.value);
      if (!Number.isFinite(v)) return;
      updateSection(bandId, { defaultCount: Math.max(0, Math.round(v)) });
    });
    countField.appendChild(count);
    row.appendChild(countField);

    const secondRowField = el("label", "theme-kpi-band__field theme-kpi-band__field--check");
    const secondRow = document.createElement("input");
    secondRow.type = "checkbox";
    secondRow.className = "theme-check";
    secondRow.checked = section.allowSecondRow;
    secondRow.addEventListener("change", () => {
      updateSection(bandId, { allowSecondRow: secondRow.checked });
    });
    secondRowField.appendChild(secondRow);
    secondRowField.appendChild(el("span", null, "2. řádek"));
    row.appendChild(secondRowField);

    // The gap immediately above this band. "Auto" derives it from the
    // layout's usual rule (a wide block gap once charts are involved
    // above it, a tight one otherwise); the other two pin it regardless
    // of what ends up around it.
    const gapField = el("label", "theme-kpi-band__field");
    gapField.title = "Auto: mezera se odvozuje z rozvržení. Malá/velká: mezera je pevně daná bez ohledu na okolí.";
    gapField.appendChild(el("span", null, "Mezera před"));
    const gapSelect = document.createElement("select");
    gapSelect.className = "theme-kpi-band__gap";
    ["auto", "small", "block"].forEach(value => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = GAP_BEFORE_LABELS[value];
      if (section.gapBefore === value) opt.selected = true;
      gapSelect.appendChild(opt);
    });
    gapSelect.addEventListener("change", () => {
      updateSection(bandId, { gapBefore: gapSelect.value });
    });
    gapField.appendChild(gapSelect);
    row.appendChild(gapField);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-btn theme-kpi-band__remove";
    removeBtn.title = "Odstranit tento pás KPI";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeSection(bandId));
    row.appendChild(removeBtn);

    row.addEventListener("mouseenter", () => setHighlight("kpi-band2"));
    row.addEventListener("mouseleave", () => setHighlight(null));

    list.appendChild(row);
  });
}

function buildKpiBandsControl() {
  const wrap = el("div", "theme-kpi-bands");

  const list = el("div", "theme-kpi-bands__list");
  list.id = "theme-kpi-bands-list";
  wrap.appendChild(list);

  wrap.appendChild(el("p", "theme-field__hint",
    "Každý pás KPI je vlastní úsek v rozvržení — první pod hlavičkou, každý další uvnitř plochy grafů."));

  const addBtn = button("+ přidat pás KPI", "ghost", () => {
    draft = normalizeTheme({ ...draft, sections: appendKpiBand(draft.sections) });
    render();
  });
  addBtn.id = "theme-kpi-band-add";
  wrap.appendChild(addBtn);

  return wrap;
}

function buildStagePane() {
  const stage = el("section", "theme-editor__stage");

  const toolbar = el("div", "theme-stage__toolbar");
  toolbar.appendChild(el("span", "theme-stage__toolbar-label", "Náhled pravidel"));

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
  // The canvas fields (width/height) claim region "canvas", and the canvas
  // *is* this node — nothing inside the preview stands for it. Without this
  // they were the one pair of controls that highlighted nothing at all.
  canvas.dataset.region = "canvas";
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

// The placement the controls pane was last built for, and whether the head
// last showed a chooser or a badge. The dialog itself is built once and
// reused across opens, so both have to be rebuilt when the answer changes —
// unlike every other control, *which* controls exist now depends on the
// draft.
let controlsPlacement = null;
let placementIsEditable = null;

function syncControlsPane() {
  if (controlsPlacement === draft.placement) return;
  controlsPlacement = draft.placement;
  const body = root.querySelector(".theme-editor__body");
  body.replaceChild(buildControlsPane(), body.querySelector(".theme-editor__controls"));
}

// Rebuilt only when it switches between chooser and badge — never merely
// because the placement changed, or clicking an option would tear out the
// button that was clicked and drop focus with it. Which option reads as
// active is handled by renderControls().
function syncPlacementSlot() {
  const editable = editingExistingId === null;
  if (placementIsEditable === editable) return;
  placementIsEditable = editable;
  const slot = root.querySelector(".theme-editor__placement-slot");
  slot.innerHTML = "";
  slot.appendChild(buildPlacementControl());
}

function render() {
  draft = resolveDependencies(draft);
  syncControlsPane();
  syncPlacementSlot();
  // One walk per render, shared by everything below: the controls, the
  // preview and the readout all describe the same layout, and running the
  // solver once per consumer was the most expensive thing a render did.
  const g = previewLayout();
  renderMeta();
  renderControls(g);
  renderPreview(g);
  renderReadout(g);
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

function renderControls(g) {
  // The same list buildControlsPane() rendered — asking for a field this
  // placement doesn't show would only find nothing.
  fieldsFor(draft.placement).forEach(field => {
    const row = root.querySelector(`.theme-field[data-field="${field.key}"]`);
    if (!row) return;
    const value = displayValue(field);
    const range = row.querySelector(".theme-field__range");
    const number = row.querySelector(".theme-field__number");
    range.value = String(value);
    // Never yank the caret out from under someone mid-typing.
    if (document.activeElement !== number) number.value = String(value);
  });

  root.querySelectorAll("[data-placement]").forEach(b => {
    b.classList.toggle("is-active", b.dataset.placement === draft.placement);
  });

  renderKpiBandsList(g);

  // Same rule as the FIELDS inputs above: never rewrite a field the user is
  // currently typing into.
  const rows = root.querySelector("#theme-preview-rows");
  if (document.activeElement !== rows) rows.value = String(preview.chartRows);
}

// Feeds sectionWalker.js — the same placement code the real canvas solver
// uses — a *sample* page: the theme's default number of slicers and KPIs,
// and however many chart rows the user is previewing. This used to be a
// hand-rolled reimplementation of the solver's band maths; now it's the
// solver itself, so the preview can never disagree with the canvas about
// where a boundary falls.
function previewLayout(themeOverride) {
  const t = themeOverride || draft;
  // Straight from the theme: the preview shows the layout being edited, so
  // there is nothing to choose here.
  const vertical = isVerticalPlacement(t.placement);
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
    slicerSide: sideOfPlacement(t.placement),
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
  // chartGroups rides along because the band labels need to know how many
  // rows each charts section actually got, including the open-ended one.
  return { ...g, vertical, rowCount: chartRowCount, tooSmall, chartGroups };
}

// --- Section reordering ---------------------------------------------------
//
// A theme's band order lives entirely in draft.sections, and both the
// keyboard path and the pointer drag (below) mutate it through the same two
// primitives: mapPlacedToRaw() translates a position in the *rendered*
// stack (what the user actually sees and grabs) back to an index in the
// *raw* sections array (which may hold sections the current sample content
// dropped — an empty KPI band, say), and moveSectionToRawIndex() performs
// the splice. Only "kpi" and "slicers" sections get a grip() — "title" and
// "charts" are the substrate everything else is placed against.

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
// The drag handle IS the region's label chip, with the grip dots as its
// leading glyph — not a separate widget sitting on top of one.
//
// Both wanted the same spot (a region's top-left corner, the only place a
// short label reads cleanly against the cell decoration), so as two elements
// they overlapped and the dots appeared to sit underneath the text. Merging
// them removes the collision by construction, and it puts the affordance on
// the one thing in the region that already names it: you grab the label of
// the band you want to move. Non-movable regions (the header, chart rows,
// the gap rulers) keep a plain tag() chip with no dots and no grab cursor,
// so "has dots" reads as "this one moves".
function grip(sectionType, sectionId, text, extra) {
  const handle = el("span", `theme-tag theme-grip${extra ? " " + extra : ""}`);
  handle.dataset.sectionType = sectionType;
  handle.dataset.sectionId = sectionId;
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", `Přesunout pás: ${text}`);
  handle.title = "Táhnutím, nebo Ctrl+šipkou nahoru/dolů, přesunete tento pás.";

  const dots = el("span", "theme-grip__dots");
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 6; i++) dots.appendChild(el("span", "theme-grip__dot"));
  handle.appendChild(dots);
  handle.appendChild(el("span", "theme-grip__label", text));

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
//
// There used to be a third kind, "gutter": two strips beside the usable area
// that turned the slicers band into a vertical column when it was dropped
// there. It is gone, because docking by drag changed the layout's *identity*
// — a horizontal template silently became a vertical one, taking every page
// using it along. Placement is now chosen once, when a template is created.
// Reordering only ever reorders.
function buildDropSlots(theme, g, rawIndex, sections, draggedType, draggedRaw) {
  const slots = [];
  const originalSignature = sectionsSignature(sections);

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
    slots.push({
      kind: "boundary",
      y: boundaryY(k),
      invalid: !changesOrder,
      apply: () => ({ sections: nextSections })
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
          return { sections: list };
        }
      });
    }
  });

  return slots;
}

// Nearest slot by |cursorY - slot.y|. Every slot is a boundary in the
// vertical stack now that gutter docking is gone, so the cursor's x plays no
// part in the choice.
function pickSlot(slots, cursorY) {
  let best = null;
  let bestDist = Infinity;
  slots.forEach(s => {
    const d = Math.abs(cursorY - s.y);
    if (d < bestDist) { bestDist = d; best = s; }
  });
  return best;
}

// Writes a projected walkSections() result onto the region nodes already on
// screen — no innerHTML rebuild, so the CSS transition on .theme-region's
// top/height is what actually animates the other bands sliding into place.
// `excludeNode` is the dragged region itself: it tracks the pointer via its
// own transform (see startSectionDrag) rather than being repositioned here,
// or the two would fight over where it is.
function applyProjectedLayout(stage, g, scale, excludeNode) {
  const px = v => `${v * scale}px`;

  g.sections.filter(s => s.type === "kpi").forEach(entry => {
    const node = stage.querySelector(`.theme-region--kpi[data-section-id="${entry.id}"]`);
    if (!node || node === excludeNode) return;
    node.style.top = px(entry.top);
    node.style.height = px(entry.height);
  });

  const slicerNode = stage.querySelector('[data-region="slicer"]');
  if (slicerNode && slicerNode !== excludeNode) {
    const slicerEntry = g.sections.find(s => s.type === "slicers");
    if (slicerEntry) {
      slicerNode.style.top = px(slicerEntry.top);
      slicerNode.style.height = px(slicerEntry.height);
    }
  }

  const chartNodes = [...stage.querySelectorAll('[data-region="charts"]')];
  chartNodes.forEach((node, i) => {
    if (node === excludeNode || g.rowTops[i] === undefined) return;
    node.style.top = px(g.rowTops[i]);
    node.style.height = px(g.rowHeights[i]);
  });
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
  // A docked (vertical) slicers section sits *beside* the rendered stack,
  // not inside it — sectionWalker.js's buildEffectiveStack() deliberately
  // skips it there, so it never appears in g.sections. Its raw index has
  // to come straight from `sections` instead, or dragging the docked
  // column's grip would silently find nothing to drag.
  const draggedRaw = sections.findIndex(s => s.type === sectionType && s.id === sectionId);
  if (draggedRaw === -1) return;

  const slots = buildDropSlots(theme, g, rawIndex, sections, sectionType, draggedRaw);

  const regionEl = event.currentTarget.closest("[data-region]");
  const regionRect = regionEl.getBoundingClientRect();
  const startClientX = event.clientX;
  const startClientY = event.clientY;

  // Live displacement used to be switched off in a vertical layout, because a
  // drag could dock the band into a column mid-gesture and the projection
  // would have had to rebuild region nodes of a different kind (a column vs a
  // stripe) rather than just moving them. A drag can no longer change the
  // placement at all, so every drag is now a plain reorder within one stack
  // and the live shuffle is always safe to run.
  regionEl.classList.add("theme-region--dragging");
  document.body.classList.add("theme-editor-reordering");

  let chosenSlot = null;
  let projectedSlot = null;   // the slot the live layout currently reflects
  let rafId = null;
  let latestEvent = null;

  // Applies (or clears) the live-shuffled layout for `slot`, skipping the
  // work entirely when the nearest slot hasn't changed since the last
  // frame — walkSections() is cheap, but there is no reason to re-run it
  // and rewrite a dozen inline styles every frame the pointer sits still.
  const applyProjectionFor = slot => {
    if (slot === projectedSlot) return;
    projectedSlot = slot;

    if (!slot || slot.invalid) {
      applyProjectedLayout(stage, g, scale, regionEl);   // back to the original layout
      return;
    }

    const patch = slot.apply();
    const projectedTheme = { ...theme, sections: patch.sections || theme.sections };
    applyProjectedLayout(stage, previewLayout(projectedTheme), scale, regionEl);
  };

  const processFrame = () => {
    rafId = null;
    if (!latestEvent) return;
    const e = latestEvent;

    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    // The lifted band slides up and down the stack only. Every band already
    // spans the full content width, so sideways travel conveys nothing and
    // just makes it look detached from the layout. (The slicer band used to
    // keep its x axis, because moving sideways was how you aimed at a gutter
    // dock — with that gone, there is nothing left to aim at.)
    //
    // Vertically the whole band is kept on the canvas — off in the backdrop
    // it reads as a rendering glitch rather than as something being held.
    const liftY = clamp(dy, stageRect.top - regionRect.top, stageRect.bottom - regionRect.bottom);

    // No transition on this — it has to track the pointer 1:1, every frame,
    // or lifting the band stops feeling like holding it.
    regionEl.style.transform = `translate(0px, ${liftY}px) scale(1.03)`;

    const cursorThemeY = (e.clientY - stageRect.top) / scale;
    chosenSlot = pickSlot(slots, cursorThemeY);

    applyProjectionFor(chosenSlot);
  };

  const move = e => {
    latestEvent = e;
    if (rafId === null) rafId = requestAnimationFrame(processFrame);
  };

  // Animates every displaced band (and the lifted original) back to where
  // they started. Only an aborted drag needs this — a successful drop hands
  // off to render(), which rebuilds every node fresh at its final position.
  const revertVisualState = () => {
    applyProjectedLayout(stage, g, scale, regionEl);
    regionEl.classList.remove("theme-region--dragging");
    regionEl.classList.add("theme-region--returning");
    regionEl.style.transform = "";
    setTimeout(() => regionEl.classList.remove("theme-region--returning"), 220);
  };

  const cleanup = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", drop);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onKeydown, true);
    document.body.classList.remove("theme-editor-reordering");
  };

  const drop = () => {
    cleanup();
    if (!chosenSlot || chosenSlot.invalid) { revertVisualState(); return; }   // no-op: nothing to mutate
    const patch = chosenSlot.apply();
    draft = normalizeTheme({ ...draft, ...patch });
    // render() rebuilds every node fresh at its final position — nothing to
    // transition *from* on a brand-new element — so the committed layout
    // simply appears already equal to the last live-previewed frame, with
    // no separate suppression needed.
    render();
  };

  const cancel = () => { cleanup(); revertVisualState(); };   // aborts with zero mutation

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

function renderPreview(g) {
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
    stackCells(column, Math.max(2, Math.floor(g.slicerColumnHeight / (t.slicerHeight + t.gapSmall))),
      t.gapSmall * scale, "column");
    column.appendChild(dragHandle("slicerColumnWidth", "x", 1, scale));
    // A plain chip, not a grip: the column stands outside the vertical stack
    // (buildEffectiveStack drops it), so there is no slot for it to move to
    // and reordering it in `sections` would change nothing on screen. It used
    // to be draggable because dragging it out of the gutter turned the layout
    // horizontal — which is precisely the identity change a template no
    // longer permits.
    // A tall narrow column has no room for a one-line chip, so this one wraps.
    column.appendChild(tag(
      `Sloupec slicerů · ${t.slicerColumnWidth} px (${t.minSlicerColumnWidth}–${t.maxSlicerColumnWidth})`,
      "theme-tag--wrap"));
    stage.appendChild(column);
  } else {
    const stripe = region("slicer", "theme-region theme-region--slicer", {
      left: t.margin, top: g.slicersTop, width: usableWidth(t), height: t.slicerHeight
    }, px);
    stackCells(stripe, t.defaultSlicersPerRow, t.gapSmall * scale, "row");
    stripe.appendChild(dragHandle("slicerHeight", "y", 1, scale));
    stripe.appendChild(grip("slicers", slicersSectionId(t),
      `Slicery · ${t.defaultSlicersPerRow}× ${cellWidth(usableWidth(t), t.defaultSlicersPerRow, t.gapSmall)} px` +
      ` · min ${t.minSlicerWidth} px · výška ${t.slicerHeight} px`));
    stage.appendChild(stripe);
  }

  // KPI bands — the walker's `placed` list gives every kpi section actually
  // showing (thanks to previewLayout()'s at-least-one-sample-card seeding,
  // that's every kpi section the theme defines) its real top/height, so
  // there is nothing left to recompute here. The header band is the first
  // of them; a theme may define any number of others interrupting the
  // chart area, each rendered generically below (there used to be exactly
  // one, hardcoded — "the second band" — before bands became a list).
  const kpiEntries = g.sections.filter(s => s.type === "kpi");
  const headerKpi = kpiEntries[0] || null;
  const extraKpis = kpiEntries.slice(1);

  if (headerKpi) {
    const kpi = region("kpi", "theme-region theme-region--kpi", {
      left: g.contentLeft, top: headerKpi.top, width: g.contentWidth, height: headerKpi.height
    }, px);
    kpi.dataset.sectionId = headerKpi.id;
    stackCells(kpi, t.defaultKpisPerRow, t.gapSmall * scale, "row");
    kpi.appendChild(dragHandle("kpiMinHeight", "y", 1, scale));
    kpi.appendChild(grip("kpi", headerKpi.id,
      `KPI · ${t.defaultKpisPerRow}× ${cellWidth(g.contentWidth, t.defaultKpisPerRow, t.gapSmall)} px · výška ${t.kpiMinHeight} px`));
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
    stackCells(row, PREVIEW_CHART_COLS, t.gapSmall * scale, "row");
    stage.appendChild(row);
  }

  extraKpis.forEach(entry => {
    const section = t.sections.find(s => s.type === "kpi" && s.id === entry.id);
    const rowLabel = afterRowLabel(t, section, g.chartGroups);
    const band = region("kpi-band2", "theme-region theme-region--kpi theme-region--band2", {
      left: g.contentLeft, top: entry.top, width: g.contentWidth, height: entry.height
    }, px);
    band.dataset.sectionId = entry.id;
    stackCells(band, entry.defaultCount, t.gapSmall * scale, "row");
    band.appendChild(grip("kpi", entry.id,
      `Pás KPI · ${entry.defaultCount}× ${cellWidth(g.contentWidth, entry.defaultCount, t.gapSmall)} px · pod ${rowLabel}. řadou`));
    stage.appendChild(band);
  });

  // Gap rulers — the two spacing values are otherwise invisible negative
  // space, so each gets a measured, draggable strip of its own. Which gap
  // falls where swaps with the orientation, exactly as the real solver does:
  // horizontally the slicer band is separated from the title by the small
  // gap and the KPIs from the charts by the block gap, while vertically the
  // content block hangs off the title by the block gap and the charts follow
  // the KPIs at the small one.
  //
  // Which boundary carries which gap is not fixed — it follows the band
  // order and any per-band `gapBefore` override — so each strip is drawn at
  // a boundary the walk genuinely applied that value to (every placed box
  // records the gap it got as `gapAbove`), rather than at the position the
  // default title -> slicers -> kpi -> charts order would put it. A theme in
  // which nothing uses a value simply gets no ruler for it, which beats a
  // strip lying across a band it has nothing to do with. Each strip spans
  // the band below it, so it is always as wide as the thing it separates.
  const takenBoundaries = new Set();
  [
    ["gap-small", "gapSmall", t.gapSmall],
    ["gap-block", "gapKpiToCharts", t.gapKpiToCharts]
  ].forEach(([regionName, fieldKey, value]) => {
    if (value <= 0) return;
    // Two gaps can be set to the same number; giving each its own boundary
    // keeps the second strip from stacking invisibly on the first.
    const i = g.sections.findIndex((s, k) => s.gapAbove === value && !takenBoundaries.has(k));
    if (i === -1) return;
    takenBoundaries.add(i);

    const entry = g.sections[i];
    const spansUsable = entry.type === "title" || entry.type === "slicers";
    stage.appendChild(gapRuler(regionName, fieldKey, value, {
      left: spansUsable ? t.margin : g.contentLeft,
      top: entry.top - value,
      width: spansUsable ? usableWidth(t) : g.contentWidth,
      height: value
    }, px, scale));
  });
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
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const start = axis === "x" ? event.clientX : event.clientY;
    const startValue = draft[fieldKey];
    setHighlight(field.region);

    // A render() tears down every control and rebuilds the whole preview, so
    // one per pointer event is far more than the screen can show. Coalesce
    // to one per frame, the same way the reorder drag does.
    let rafId = null;
    let latest = null;

    const processFrame = () => {
      rafId = null;
      const now = axis === "x" ? latest.clientX : latest.clientY;
      const delta = ((now - start) / scale) * sign;
      setFieldValue(field, startValue + delta);
      render();
    };

    const move = e => {
      latest = e;
      if (rafId === null) rafId = requestAnimationFrame(processFrame);
    };
    const up = () => {
      // Land on the last position the pointer reached, not on the frame
      // that happened to render before the release.
      if (rafId !== null) { cancelAnimationFrame(rafId); processFrame(); }
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

function renderReadout(g) {
  const t = draft;
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
