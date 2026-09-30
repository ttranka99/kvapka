// assets/js/theme/themeEditor.js
//
// The custom-theme editor: a full-screen dialog with the numeric rules on the
// left and a live, draggable preview of the canvas on the right.
//
// The preview does NOT show one slicer and one KPI. A theme is a set of
// *rules*, so it shows the shape they produce: the whole slicer stripe across
// the usable width split into the default number of cells, the KPI band as a
// band, and the chart area as the leftover rows. Each region shows the numbers
// governing it, and a region tied to one tunable can be dragged to change it.
// Controls and preview are two views of one object; hovering either
// highlights the other.
//
// Motion follows ui/motion.js. A discrete change (reset, band added or
// removed, reorder, another placement) glides the regions to their new boxes.
// An imported layout is new content and fades in (R3). Switchers slide their
// thumb (ui/thumb.js). A slider, typed value or handle drag never eases; it
// follows the input (R5).

import {
  GROUPS,
  FIELD_BY_KEY,
  normalizeTheme,
  resolveDependencies,
  cloneTheme,
  validateTheme,
  issue,
  usableWidth,
  usableHeight,
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
import { icon } from "../ui/icon.js";
import { createSwitch } from "../ui/switch.js";
import { initThumb, syncThumb } from "../ui/thumb.js";
import { leave, durationMs, flashEl, snapshotBoxes, playBoxes, settleBoxes } from "../ui/motion.js";
import { confirmDialog } from "../ui/dialog.js";
import { themeIdsInUse } from "../state/tabs.js";
import { t, onLocaleChange } from "../i18n/i18n.js";

// renderPreview() and renderReadout() call the draft theme `t`, so they use
// this second name for the translator.
const tr = t;

// --- Dialog state ------------------------------------------------------

let root = null;              // the overlay element, built once and reused
let draft = null;             // the theme being edited
let baseTheme = null;         // what it was derived from, for reset
let editingExistingId = null; // non-null when editing a saved custom theme
let onApply = null;           // callback handed in by the opener
let onClose = null;           // fired on every exit path (see closeThemeEditor)
// Preview-only knobs. Orientation is not one: a layout has exactly one shape,
// and a toggle would show the other placement next to controls that can't
// affect it.
let preview = {
  chartRows: 2
};
let highlightedRegion = null;
// "preview" or "controls". Only a hover over the preview lights controls; a
// hovered control already has its own :hover.
let highlightFrom = null;
// The findings on screen, by title, so only a new one fades in. null right
// after opening: the section fades in as a whole then.
let shownFindings = null;

// Cells drawn per preview chart row. Fixed: no theme rule sets how many
// charts fit in a row (that follows from minChartWidth at layout time).
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
 *                                to a new custom theme; a custom one is
 *                                edited in place)
 * @param {(theme: object) => void} options.onApply  called with the saved
 *                                theme when the user confirms
 * @param {() => void} [options.onClose]  called on every way the editor
 *                                closes; the rail uses it to hand the screen
 *                                back to the template section
 */
export function openThemeEditor(options) {
  const source = normalizeTheme(options.theme);
  // Built-ins are read-only baselines, so opening one always forks. `mode:
  // "new"` forks a custom theme too (the sidebar's "new theme" button seeds
  // from the active theme, not a blank one).
  const fork = source.builtin || options.mode === "new";

  if (fork) {
    editingExistingId = null;
    draft = cloneTheme(source);
    draft.builtin = false;
    draft.derivedFrom = source.builtin ? source.id : source.derivedFrom;
    draft.label = t("editor.copyName", { label: source.label });
    draft.id = makeThemeId(draft.label, themeIdsInUse());
  } else {
    editingExistingId = source.id;
    draft = cloneTheme(source);
  }

  // Always a built-in of the draft's own placement. A vertical layout against
  // a horizontal preset would report every slicer field as changed.
  baseTheme = cloneTheme(baselineFor(draft));
  onApply = options.onApply || null;
  onClose = options.onClose || null;

  // Force both to rebuild: the dialog is reused across opens, so the last
  // session's field set and live/locked placement row are still in it.
  controlsPlacement = null;
  placementIsEditable = null;

  if (!root) root = buildDialog();
  root.hidden = false;
  document.body.classList.add("theme-editor-open");
  shownFindings = null;
  render();

  // A read-only peek at the draft's section order, for the test harness.
  // draft is module-private, and the DOM can't tell a raw sections index from
  // a rendered one.
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

// A language switch rebuilds the dialog, since nearly all its text is set once
// at build time. An open editor comes straight back around the same draft, so
// nothing typed is lost. The old overlay is hidden first, which also retires
// its document-level Escape handler (it returns early on a hidden overlay).
onLocaleChange(() => {
  if (!root) return;
  const wasOpen = !root.hidden;
  root.hidden = true;
  root.remove();
  root = null;
  controlsPlacement = null;
  placementIsEditable = null;
  if (!wasOpen) return;
  root = buildDialog();
  root.hidden = false;
  render();
});

// --- Dialog construction ------------------------------------------------

function buildDialog() {
  const overlay = el("div", "theme-editor m-reveal");
  overlay.id = "theme-editor";
  overlay.hidden = true;

  // A section, not a modal: it replaces the sidebar + canvas beside the rail
  // (like #section-prvky), so the rail stays reachable at every width.
  const dialog = el("div", "theme-editor__dialog");
  dialog.setAttribute("role", "region");
  dialog.setAttribute("aria-label", t("editor.region"));

  dialog.appendChild(buildHead());

  const body = el("div", "theme-editor__body");
  body.appendChild(buildControlsPane());
  body.appendChild(buildStagePane());
  dialog.appendChild(body);

  overlay.appendChild(dialog);
  document.querySelector(".app").appendChild(overlay);

  document.addEventListener("keydown", e => {
    if (overlay.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); requestClose(); }
  });

  // The preview is scaled to its frame, so redraw whenever the frame resizes
  // (window resize, or the controls pane's scrollbar appearing).
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
  // The visible box is this <label>, not the input. It holds the name and the
  // pencil, so clicking the pencil focuses the field.
  const box = el("label", "theme-editor__name-box");
  const name = document.createElement("input");
  name.type = "text";
  name.id = "theme-name";
  name.className = "theme-editor__name";
  name.maxLength = 40;
  name.setAttribute("aria-label", t("editor.name"));
  name.addEventListener("input", () => {
    draft.label = name.value;
    if (name.value.trim()) markNameInvalid(false);
    renderMeta();
  });
  box.appendChild(name);
  box.appendChild(iconEl("pencil"));
  identity.appendChild(box);
  head.appendChild(identity);

  const actions = el("div", "theme-editor__head-actions");

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "application/json,.json";
  file.className = "theme-editor__file";
  file.addEventListener("change", handleImportFile);
  actions.appendChild(file);

  actions.appendChild(button(t("editor.import"), "secondary", () => file.click(),
    t("editor.importTitle")));
  actions.appendChild(button(t("editor.export"), "secondary", handleExport,
    t("editor.exportTitle")));
  actions.appendChild(button(t("editor.cancel"), "secondary", requestClose));

  const del = button(t("editor.delete"), "danger", handleDelete, t("editor.deleteTitle"));
  del.classList.add("theme-editor__delete");
  actions.appendChild(del);

  actions.appendChild(button(t("editor.save"), "primary", handleSave));

  head.appendChild(actions);
  return head;
}

/** A sprite icon as an element, for buttons built with DOM calls. */
function iconEl(name) {
  const tpl = document.createElement("template");
  tpl.innerHTML = icon(name);
  return tpl.content.firstElementChild;
}

function button(label, variant, onClick, title, iconName) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn btn-${variant}`;
  // A <span>, not a bare text node, so .btn's gap spaces it from an icon.
  if (iconName) b.appendChild(iconEl(iconName));
  const text = document.createElement("span");
  text.textContent = label;
  b.appendChild(text);
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function buildControlsPane() {
  const pane = el("aside", "theme-editor__controls");

  // Filled by syncPlacementSlot(). Live or locked depends on the draft,
  // unlike the groups below, which are fixed per placement.
  pane.appendChild(el("div", "theme-editor__placement-slot"));

  // Only the fields this layout's shape uses. A control for the other
  // placement would do nothing visible, and its preview region doesn't exist
  // to highlight. Hidden fields' values are still carried and saved.
  const visible = fieldsFor(draft.placement);

  GROUPS.forEach(group => {
    const fields = visible.filter(f => f.group === group.id);
    const extras = group.id === "kpis";

    // A group whose fields are all out of scope would be just a heading, so
    // skip it. None is empty today; this keeps it so as fields are added.
    if (!fields.length && !extras) return;

    const section = el("section", "theme-group");
    section.dataset.group = group.id;

    section.appendChild(el("h3", "theme-group__title", group.label));
    const note = groupNote(group, draft.placement);
    if (note) section.appendChild(el("p", "theme-group__note", note));

    fields.forEach(field => section.appendChild(buildField(field)));

    // The KPI band list sits in its own group, not a separate "advanced" pane.
    if (extras) section.appendChild(buildKpiBandsControl());

    pane.appendChild(section);
  });

  const reset = button(t("editor.resetToBase"), "ghost", () => {
    const before = new Map(fieldsFor(draft.placement).map(f => [f.key, displayValue(f)]));
    draft = { ...cloneTheme(baseTheme), id: draft.id, label: draft.label, builtin: false };
    render({ motion: "move" });
    // R7: each value the reset restored gets a halo so it can be found.
    fieldsFor(draft.placement).forEach(f => {
      if (before.get(f.key) !== displayValue(f)) flashEl(root.querySelector(`.theme-field[data-field="${f.key}"]`));
    });
  });
  reset.classList.add("theme-editor__reset");
  pane.appendChild(reset);

  return pane;
}

function buildField(field) {
  const row = el("div", "theme-field");
  row.dataset.field = field.key;

  // A field in both placements can mean different things (slicerHeight is a
  // band height in a row, a per-slicer floor in a column), so wording and
  // highlighted region come from the draft's placement.
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
    row.addEventListener("mouseenter", () => setHighlight(region, "controls"));
    row.addEventListener("mouseleave", () => setHighlight(null));
    number.addEventListener("focus", () => setHighlight(region, "controls"));
    number.addEventListener("blur", () => setHighlight(null));
  }

  return row;
}

// Where the slicers stand: the property that decides which *layout* this is,
// not how it is tuned. First row of the controls pane, using the same
// segmented control as the sidebar's "Slicery" switch.
//
// Settable only while the layout is new. Flipping it on a saved layout would
// turn one template into another and change every page using it. So an
// existing layout shows the control locked (all options disabled) with the
// reason. For the other orientation, start a new template and pick it here.
function buildPlacementControl() {
  const locked = editingExistingId !== null;
  const row = el("div", "theme-field theme-editor__placement");
  row.appendChild(el("span", "theme-field__label", t("editor.placement")));

  const group = el("div", "segmented segmented--3");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", t("editor.placement"));
  PLACEMENTS.forEach(placement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "template-option";
    b.dataset.placement = placement;
    b.textContent = placementLabel(placement);
    b.disabled = locked;
    b.addEventListener("click", () => {
      if (draft.placement === placement) return;
      // Through normalizeTheme so the baseline follows the new shape. Else a
      // layout flipped to vertical would diff against a horizontal preset.
      draft = normalizeTheme({ ...draft, placement });
      baseTheme = cloneTheme(baselineFor(draft));
      // Same header, bands and gaps, rearranged: they glide to their new
      // places as the slicer stripe becomes a column. This row survives the
      // pane rebuild (syncControlsPane), so the thumb slides and focus stays.
      render({ motion: "move" });
    });
    group.appendChild(b);
  });
  row.appendChild(group);
  // The slate pill slides to the chosen placement (ui/thumb.js).
  initThumb(group);

  if (locked) {
    row.appendChild(el("p", "theme-field__hint",
      t("editor.placementLocked")));
  }

  return row;
}

// A band row's heading. The first `kpi` section is the header band; the
// others name the chart row they follow.
function bandTitle(section, index, g) {
  return index === 0
    ? t("editor.band.header")
    : t("editor.band.afterRow", { n: index + 1, row: afterRowLabel(draft, section, g && g.chartGroups) });
}

// The 1-based chart row a KPI band visually follows, for its preview label.
//
// Every `charts` section above the band adds its rows, not just the nearest.
// With two bands the lower one sits under the *sum*; using only the nearest
// section called row 3 "row 1". `chartGroups` (computeChartGroups, via
// previewLayout) gives each section's real row count, including the
// open-ended one. Without it a fixed `rows` is used and a null counts as one.
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

// Appends a KPI band at the end of the stack, with a fresh open-ended charts
// section taking the remaining rows below it. Only the *last* charts section
// may be open-ended (computeChartGroups() in chartGroups.js resolves
// "whatever's left" only for it), so the current last section is first pinned
// to one row. That row ends up between the existing content and the new band,
// like the old single "second band" default. Ids are placeholders;
// normalizeTheme()'s dedup pass renames any that collide with an earlier "+".
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

const GAP_BEFORE_LABELS = {
  get auto() { return t("editor.band.gapAuto"); },
  get small() { return t("editor.band.gapSmall"); },
  get block() { return t("editor.band.gapBlock"); }
};

// One row per `kpi` section. defaultCount/allowSecondRow/gapBefore are edited
// in place. Removing a row leaves its cards to state.applyTheme's
// reconciliation (reconcileKpiBands in state.js), which rehomes them to the
// nearest surviving band instead of dropping them.
// Replaces one section in the draft with a patched copy. All four band-row
// controls edit one field this way, so they share it.
//
// Addressed by id, never by object identity: normalizeTheme() returns fresh
// section objects every time, while a band row (and its listener) outlives
// many renders (see renderKpiBandsList). Matching by identity made every edit
// after the first patch nothing.
//
// `opts` goes to render(): a switch or choice glides the preview, a typed
// count does not.
function updateSection(sectionId, patch, opts) {
  draft = normalizeTheme({
    ...draft,
    sections: draft.sections.map(s => (s.id === sectionId ? { ...s, ...patch } : s))
  });
  render(opts);
}

function removeSection(sectionId) {
  draft = normalizeTheme({ ...draft, sections: draft.sections.filter(s => s.id !== sectionId) });
  render({ motion: "move" });
}

// A two- or three-way choice as a small toggle. `onPick` gets the option's
// value; render() refreshes the active one via setToggleValue.
function toggle(className, options, onPick) {
  const group = el("div", `theme-toggle ${className}`);
  options.forEach(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle__option";
    b.dataset.value = value;
    b.textContent = label;
    b.addEventListener("click", () => onPick(value));
    group.appendChild(b);
  });
  // The slate pill slides to the chosen option (ui/thumb.js).
  initThumb(group);
  return group;
}

function setToggleValue(group, value) {
  group.querySelectorAll(".theme-toggle__option").forEach(b => {
    b.classList.toggle("is-active", b.dataset.value === String(value));
  });
  syncThumb(group);
}

function bandRow(label, control, title, stack) {
  const row = el("div", "theme-kpi-band__row");
  if (stack) row.classList.add("theme-kpi-band__row--stack");
  if (title) row.title = title;
  row.appendChild(el("span", null, label));
  row.appendChild(control);
  return row;
}

function renderKpiBandsList(g, motion) {
  const list = root.querySelector("#theme-kpi-bands-list");
  if (!list) return;

  const sections = draft.sections.filter(s => s.type === "kpi");

  // Always rebuilding would destroy the control being typed in (render() runs
  // on every keystroke, so "12" couldn't be entered). Rebuild only when the
  // *set* of bands changed; otherwise refresh values in place, skipping the
  // focused control, as renderControls() does for the FIELDS inputs.
  const rendered = [...list.querySelectorAll(".theme-kpi-band")];
  const sameBands = rendered.length === sections.length
    && rendered.every((row, i) => row.dataset.kpiBandId === sections[i].id);

  if (sameBands) {
    rendered.forEach((row, i) => {
      const section = sections[i];
      const count = row.querySelector(".theme-kpi-band__count");
      if (document.activeElement !== count) count.value = String(section.defaultCount);
      row.secondRowSwitch.set(section.allowSecondRow);
      setToggleValue(row.querySelector(".theme-kpi-band__gap"), section.gapBefore);
      row.querySelector(".theme-kpi-band__title").textContent = bandTitle(section, i, g);
    });
    return;
  }

  const before = new Set(rendered.map(row => row.dataset.kpiBandId));
  list.innerHTML = "";

  sections.forEach((section, i) => {
    // The row outlives the `section` object, so listeners use this id.
    const bandId = section.id;
    const row = el("div", "theme-kpi-band");
    row.dataset.kpiBandId = bandId;
    row.dataset.region = "kpi-band2";
    // A band just added enters (R2); the ones already listed stay put.
    if (motion && !before.has(bandId)) row.classList.add("m-enter");

    const head = el("div", "theme-kpi-band__head");
    head.appendChild(el("span", "theme-kpi-band__title", bandTitle(section, i, g)));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-circle theme-kpi-band__remove";
    removeBtn.title = t("editor.band.remove");
    removeBtn.setAttribute("aria-label", t("editor.band.remove"));
    removeBtn.innerHTML = icon("close");
    // The card fades out before the list is rebuilt without it (R2).
    removeBtn.addEventListener("click", () => leave(row, () => removeSection(bandId)));
    head.appendChild(removeBtn);
    row.appendChild(head);

    const count = document.createElement("input");
    count.type = "number";
    count.className = "theme-field__number theme-kpi-band__count";
    count.min = "0";
    count.max = "12";
    count.step = "1";
    count.value = String(section.defaultCount);
    count.setAttribute("aria-label", t("editor.band.count"));
    count.addEventListener("input", () => {
      const v = Number(count.value);
      if (!Number.isFinite(v)) return;
      updateSection(bandId, { defaultCount: Math.max(0, Math.round(v)) });
    });
    row.appendChild(bandRow(t("editor.band.count"), count));

    // On or off: the app's switch (ui/switch.js), kept on the row so the
    // in-place refresh above can set it.
    const secondRow = createSwitch({
      label: t("editor.band.secondRow"),
      onToggle: on => updateSection(bandId, { allowSecondRow: on }, { motion: "move" })
    });
    secondRow.set(section.allowSecondRow);
    row.secondRowSwitch = secondRow;
    row.appendChild(bandRow(t("editor.band.secondRow"), secondRow.node));

    // The gap just above this band. "Auto" uses the layout's usual rule (wide
    // block gap once charts are above it, tight otherwise). The other two pin
    // it whatever surrounds the band.
    const gap = toggle("theme-kpi-band__gap",
      ["auto", "small", "block"].map(value => [value, GAP_BEFORE_LABELS[value]]),
      value => updateSection(bandId, { gapBefore: value }, { motion: "move" }));
    setToggleValue(gap, section.gapBefore);
    row.appendChild(bandRow(t("editor.band.gapBefore"), gap,
      t("editor.band.gapBeforeHint"), true));

    row.addEventListener("mouseenter", () => setHighlight("kpi-band2", "controls"));
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
    t("editor.band.hint")));

  const addBtn = button(t("editor.band.add"), "secondary", () => {
    draft = normalizeTheme({ ...draft, sections: appendKpiBand(draft.sections) });
    render({ motion: "move" });
  }, undefined, "plus");
  addBtn.id = "theme-kpi-band-add";
  wrap.appendChild(addBtn);

  return wrap;
}

function buildStagePane() {
  const stage = el("section", "theme-editor__stage");

  const toolbar = el("div", "theme-stage__toolbar");
  toolbar.appendChild(el("span", "theme-stage__toolbar-label", t("editor.preview.title")));

  const rows = el("label", "theme-stage__rows");
  rows.appendChild(el("span", null, t("editor.preview.rows")));
  const rowsInput = document.createElement("input");
  rowsInput.type = "number";
  rowsInput.min = "1";
  rowsInput.max = "6";
  rowsInput.className = "theme-field__number";
  rowsInput.id = "theme-preview-rows";
  rowsInput.addEventListener("input", () => {
    const v = Number(rowsInput.value);
    if (Number.isFinite(v)) { preview.chartRows = Math.min(6, Math.max(1, Math.round(v))); render({ motion: "move" }); }
  });
  rows.appendChild(rowsInput);
  toolbar.appendChild(rows);

  stage.appendChild(toolbar);

  const frame = el("div", "theme-stage__frame");
  const canvas = el("div", "theme-preview");
  canvas.id = "theme-preview";
  // The canvas fields (width/height) claim region "canvas", and the canvas
  // *is* this node. Without this they would highlight nothing.
  canvas.dataset.region = "canvas";
  frame.appendChild(canvas);
  stage.appendChild(frame);

  stage.appendChild(el("div", "theme-stage__readout"));

  // Passing notices (imported, couldn't read) get their own slot, so the
  // findings below only describe the template.
  const notice = el("div", "theme-stage__notice");
  notice.setAttribute("role", "status");
  stage.appendChild(notice);

  // A polite live region. renderStatus() rebuilds it only when the findings
  // change, so a handle drag doesn't re-announce the list every frame.
  const status = el("div", "theme-stage__status");
  status.setAttribute("role", "status");
  stage.appendChild(status);

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

function setHighlight(region, from = "preview") {
  highlightedRegion = region;
  highlightFrom = from;
  applyHighlight();
}

function applyHighlight() {
  root.querySelectorAll("[data-region]").forEach(node => {
    const isControl = !!node.closest(".theme-editor__controls");
    node.classList.toggle("is-linked", !!highlightedRegion && node.dataset.region === highlightedRegion
      && (!isControl || highlightFrom === "preview"));
  });
}

// --- Rendering ----------------------------------------------------------

// The placement the controls pane was last built for, and whether its
// placement row was built live or locked. The dialog is built once and reused
// across opens, so both must be rebuilt when they change. Unlike other
// controls, *which* controls exist depends on the draft.
let controlsPlacement = null;
let placementIsEditable = null;

function syncControlsPane() {
  if (controlsPlacement === draft.placement) return;
  const previous = controlsPlacement;
  controlsPlacement = draft.placement;
  const body = root.querySelector(".theme-editor__body");
  const old = body.querySelector(".theme-editor__controls");
  // Read before the placement row leaves it, which shortens it.
  const scrollTop = old.scrollTop;
  const pane = buildControlsPane();

  // Another placement in the same session: the clicked placement row moves
  // across as is, so its thumb slides and focus stays. Controls both
  // placements share are rebuilt without flicker; only new ones fade in (R2).
  const oldSlot = old.querySelector(".theme-editor__placement-slot");
  // Moving a node out of the document blurs it, so refocus the option once
  // the row is in the new pane.
  const focused = oldSlot && oldSlot.contains(document.activeElement) ? document.activeElement : null;
  if (previous !== null && placementIsEditable !== null && oldSlot) {
    pane.replaceChild(oldSlot, pane.querySelector(".theme-editor__placement-slot"));
    const had = new Set(fieldsFor(previous).map(f => f.key));
    pane.querySelectorAll(".theme-field[data-field]").forEach(row => {
      if (!had.has(row.dataset.field)) row.classList.add("m-reveal");
    });
  } else {
    // A fresh open: the empty slot is filled by syncPlacementSlot().
    placementIsEditable = null;
  }

  body.replaceChild(pane, old);
  pane.scrollTop = scrollTop;
  if (focused && pane.contains(focused)) focused.focus({ preventScroll: true });
}

// Refilled when the pane was rebuilt or the chooser flips between live and
// locked. renderControls() handles which option is active.
function syncPlacementSlot() {
  const editable = editingExistingId === null;
  if (placementIsEditable === editable) return;
  placementIsEditable = editable;
  const slot = root.querySelector(".theme-editor__placement-slot");
  slot.innerHTML = "";
  slot.appendChild(buildPlacementControl());
}

// `motion` is for renderPreview(). "move" glides regions to their new boxes,
// "swap" fades the preview in, and none (every keystroke, slider and drag
// frame) redraws in place (motion.js R5).
function render({ motion } = {}) {
  draft = resolveDependencies(draft);
  syncControlsPane();
  syncPlacementSlot();
  // One walk per render, shared by the controls, preview and readout, which
  // all describe the same layout. Running the solver per consumer was the most
  // expensive part of a render.
  const g = previewLayout();
  renderMeta();
  renderControls(g, motion);
  renderPreview(g, motion);
  renderReadout(g);
  applyHighlight();
}

function renderMeta() {
  const name = root.querySelector("#theme-name");
  if (document.activeElement !== name) name.value = draft.label;

  root.querySelector(".theme-editor__delete").hidden = editingExistingId === null;
}

function renderControls(g, motion) {
  // The same list buildControlsPane() rendered; a field this placement
  // doesn't show would find nothing.
  fieldsFor(draft.placement).forEach(field => {
    const row = root.querySelector(`.theme-field[data-field="${field.key}"]`);
    if (!row) return;
    const value = displayValue(field);
    const range = row.querySelector(".theme-field__range");
    const number = row.querySelector(".theme-field__number");
    range.value = String(value);
    // Never move the caret while someone is typing.
    if (document.activeElement !== number) number.value = String(value);
  });

  root.querySelectorAll("[data-placement]").forEach(b => {
    b.classList.toggle("active", b.dataset.placement === draft.placement);
  });
  const placementGroup = root.querySelector(".theme-editor__placement .segmented");
  if (placementGroup) syncThumb(placementGroup);

  renderKpiBandsList(g, motion);

  // Same rule as the FIELDS inputs: never rewrite a field being typed in.
  const rows = root.querySelector("#theme-preview-rows");
  if (document.activeElement !== rows) rows.value = String(preview.chartRows);
}

// Feeds sectionWalker.js (the real canvas solver's placement code) a *sample*
// page: the theme's default number of slicers and KPIs, and the chart rows
// being previewed. Using the solver itself means the preview can't disagree
// with the canvas about where a boundary falls.
function previewLayout(themeOverride) {
  const t = themeOverride || draft;
  // Straight from the theme; the preview shows the layout being edited.
  const vertical = isVerticalPlacement(t.placement);
  const chartRowCount = preview.chartRows;

  // Every `kpi` section gets at least one sample card, even at defaultCount 0
  // (the header band's default). The preview shows the band the rules *would*
  // produce, so it must not vanish just because no page has content yet.
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
    // A flat split of the rows' shared budget. Preview rows are sample cells
    // with no locked heights, so computeChartRowHeights has nothing to weigh.
    rowHeightSolver: ({ chartsHeight, chartRowGapCount }) => {
      const rowHeight = chartRowCount > 0
        ? (chartsHeight - chartRowGapCount * t.gapSmall) / chartRowCount
        : 0;
      return new Array(chartRowCount).fill(rowHeight);
    }
  });

  const tooSmall = g.rowHeights.some(h => h < t.hardMinChartHeight);
  // chartGroups is passed along because band labels need each charts
  // section's real row count, including the open-ended one.
  return { ...g, vertical, rowCount: chartRowCount, tooSmall, chartGroups };
}

// --- Section reordering ---------------------------------------------------
//
// A theme's band order lives in draft.sections. The keyboard path and the
// pointer drag (below) both change it through two primitives:
// mapPlacedToRaw() maps a position in the *rendered* stack (what the user
// grabs) to an index in the *raw* sections array (which may hold sections the
// sample content dropped, e.g. an empty KPI band), and
// moveSectionToRawIndex() does the splice. Only "kpi" and "slicers" sections
// get a grip(); "title" and "charts" are the base everything else is placed
// against.

// There is always exactly one `slicers` section (normalizeSections()
// guarantees it). This finds its id, which is the author's own, not
// "slicers".
function slicersSectionId(theme) {
  const s = theme.sections.find(s => s.type === "slicers");
  return s ? s.id : "slicers";
}

// A cheap order+shape fingerprint, to tell a real move from a drop back where
// it started (which must count as no mutation, not a no-op edit).
function sectionsSignature(list) {
  return list.map(s => `${s.type}:${s.id ?? ""}:${s.rows ?? ""}`).join("|");
}

// previewLayout()'s `g.sections` is the rendered stack: the same order as
// `sections` but without zero-space entries (an empty KPI band, a slicer band
// with no slicers). This walks both in lockstep to find each rendered entry's
// raw index, which is all the splice below needs.
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

// Removes the section at `fromRaw` and reinserts it just before whatever now
// sits at `beforeRaw` (an index into the *original* array; the splice
// accounts for the shift from the removal).
function moveSectionToRawIndex(sections, fromRaw, beforeRaw) {
  const list = sections.slice();
  const [item] = list.splice(fromRaw, 1);
  const insertAt = fromRaw < beforeRaw ? beforeRaw - 1 : beforeRaw;
  list.splice(insertAt, 0, item);
  return list;
}

// The keyboard path: Ctrl+ArrowUp/Down on a grip moves its section past the
// rendered neighbour on that side, the same "one slot" a pointer drag snaps
// to. Deterministic, so the pointer drag's mutations are tested against it.
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
  render({ motion: "move" });

  // render() rebuilt every node, including the focused grip. Refocus the same
  // grip in its new spot so another Ctrl+ArrowUp/Down works without tabbing.
  const node = root.querySelector(
    `.theme-grip[data-section-type="${sectionType}"][data-section-id="${sectionId}"]`
  );
  if (node) node.focus();
}

// Six-dot grab handle in a movable region's top-left corner. It is neither
// the region body (the hover-highlight target) nor its edges (the resize
// `dragHandle`s), so resize and reorder drags never compete for a pointerdown.
// The handle IS the region's label chip, with the grip dots as its leading
// glyph, so you grab the label of the band you want to move. (Separate
// elements overlapped in the top-left corner, the only spot where a short
// label reads cleanly, and the dots looked hidden under the text.)
// Non-movable regions (header, chart rows, gap rulers) keep a plain tag()
// chip with no dots, so "has dots" means "this one moves".
function grip(sectionType, sectionId, text, extra) {
  const handle = el("span", `theme-tag theme-grip${extra ? " " + extra : ""}`);
  handle.dataset.sectionType = sectionType;
  handle.dataset.sectionId = sectionId;
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", t("editor.preview.moveBand", { label: text }));
  handle.title = t("editor.preview.moveBandHint");

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

// The pointer drag itself, implemented below as its own function so grip()
// only needs to call it on pointerdown.
// Every place the dragged section could land, computed ONCE at pointerdown
// and frozen for the gesture. pointermove only picks the nearest one and
// moves a ghost; it never touches `draft` or re-renders.
//
//   "boundary"  — every gap in the *rendered* stack (above the first entry,
//                 between each pair, below the last). Always valid to try;
//                 whether it changes anything is decided up front and
//                 cached as `invalid`.
//   "split"     — a chart-row boundary strictly *inside* a charts group.
//                 Dropping there splits that theme section in two, with the
//                 dragged section between the row it claims and the rest.
//
// There used to be a third kind, "gutter" (strips beside the usable area that
// turned the slicers band into a column). It is gone: docking by drag changed
// the layout's *identity* and every page using it. Placement is now chosen
// once, when a template is created. Reordering only reorders.
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
          // A placeholder id. normalizeTheme()'s dedup pass renames it on a
          // collision; it only needs to differ from `first`.
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
// vertical stack, so the cursor's x is ignored.
function pickSlot(slots, cursorY) {
  let best = null;
  let bestDist = Infinity;
  slots.forEach(s => {
    const d = Math.abs(cursorY - s.y);
    if (d < bestDist) { bestDist = d; best = s; }
  });
  return best;
}

// Writes a projected walkSections() result onto the region nodes on screen.
// No innerHTML rebuild, so the CSS transition on .theme-region's top/height
// animates the other bands sliding into place. `excludeNode` is the dragged
// region; it follows the pointer via its own transform (see startSectionDrag),
// and repositioning it here would fight that.
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
  // A running glide would be measured mid-flight, and a fading ghost would
  // be shuffled with the live bands.
  settleBoxes(stage, ".theme-region");
  const stageRect = stage.getBoundingClientRect();
  const scale = Number(stage.style.getPropertyValue("--preview-scale")) || 1;

  const theme = draft;
  const g = previewLayout();
  const sections = draft.sections;
  const rawIndex = mapPlacedToRaw(sections, g.sections);
  // A docked (vertical) slicers section sits *beside* the rendered stack.
  // sectionWalker.js's buildEffectiveStack() skips it, so it isn't in
  // g.sections. Take its raw index straight from `sections`, or its grip
  // would find nothing to drag.
  const draggedRaw = sections.findIndex(s => s.type === sectionType && s.id === sectionId);
  if (draggedRaw === -1) return;

  const slots = buildDropSlots(theme, g, rawIndex, sections, sectionType, draggedRaw);

  const regionEl = event.currentTarget.closest("[data-region]");
  const regionRect = regionEl.getBoundingClientRect();
  const startClientX = event.clientX;
  const startClientY = event.clientY;

  // Live displacement is safe in every layout: a drag can't change the
  // placement, so it is always a plain reorder within one stack and the
  // projection only moves nodes, never rebuilds them into another kind.
  regionEl.classList.add("theme-region--dragging");
  document.body.classList.add("theme-editor-reordering");

  let chosenSlot = null;
  let projectedSlot = null;   // the slot the live layout currently reflects
  let rafId = null;
  let latestEvent = null;

  // Applies (or clears) the live-shuffled layout for `slot`. Skipped when
  // the nearest slot is unchanged, so a still pointer doesn't re-run
  // walkSections() and rewrite a dozen inline styles every frame.
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

    // The lifted band moves up and down the stack only. Every band spans the
    // full content width, so sideways travel would just look detached.
    //
    // Vertically the band stays on the canvas; off in the backdrop it would
    // look like a rendering glitch, not something being held.
    const liftY = clamp(dy, stageRect.top - regionRect.top, stageRect.bottom - regionRect.bottom);

    // No transition: it must track the pointer 1:1 every frame, or the band
    // stops feeling held.
    regionEl.style.transform = `translate(0px, ${liftY}px) scale(1.03)`;

    const cursorThemeY = (e.clientY - stageRect.top) / scale;
    chosenSlot = pickSlot(slots, cursorThemeY);

    applyProjectionFor(chosenSlot);
  };

  const move = e => {
    latestEvent = e;
    if (rafId === null) rafId = requestAnimationFrame(processFrame);
  };

  // Animates every displaced band (and the lifted one) back to its start.
  // Only an aborted drag needs it; a successful drop hands off to render(),
  // which rebuilds every node at its final position.
  const revertVisualState = () => {
    applyProjectedLayout(stage, g, scale, regionEl);
    regionEl.classList.remove("theme-region--dragging");
    regionEl.classList.add("theme-region--returning");
    regionEl.style.transform = "";
    setTimeout(() => regionEl.classList.remove("theme-region--returning"), durationMs("--base"));
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
    // The other bands already stand where the live shuffle put them, so they
    // stay put; the lifted band glides from where it was held into its slot.
    render({ motion: "move" });
  };

  const cancel = () => { cleanup(); revertVisualState(); };   // aborts with zero mutation

  // Capture phase, and propagation stopped. The dialog has a document-level
  // Escape handler that closes the whole editor (bubble phase, so it would
  // otherwise run first). A drag's Escape must abort only the drag.
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

// Every region is keyed (data-key) by what it stands for, not its DOM place,
// so a rebuild can be replayed as movement (motion.js playBoxes).
const REGION = ".theme-region[data-key]";
const regionKey = node => node.dataset.key;

// A region that is gone fades out as a picture only. Nothing on it may be
// hovered, grabbed or found by the next snapshot or applyHighlight().
function cleanRegion(node) {
  node.classList.remove("is-linked", "theme-region--dragging", "theme-region--returning");
  node.style.transform = "";
  node.removeAttribute("data-key");
  node.removeAttribute("data-region");
  node.querySelectorAll(".theme-handle, .theme-grip").forEach(c => c.remove());
}

function renderPreview(g, motion) {
  // Exposed for the test harness: a reorder drag must call render() once (on
  // a successful drop), never on every pointermove.
  window.__themeRenderPreviewCalls = (window.__themeRenderPreviewCalls || 0) + 1;

  const stage = root.querySelector("#theme-preview");
  const frame = root.querySelector(".theme-stage__frame");
  const snap = motion ? snapshotBoxes(stage, REGION, regionKey) : null;
  stage.innerHTML = "";

  const t = draft;
  const availW = Math.max(120, frame.clientWidth - 32);
  const availH = Math.max(120, frame.clientHeight - 32);
  const scale = Math.min(availW / t.canvasWidth, availH / t.canvasHeight) || 0.2;

  stage.style.width = `${t.canvasWidth * scale}px`;
  stage.style.height = `${t.canvasHeight * scale}px`;
  stage.style.setProperty("--preview-scale", String(scale));

  const px = v => `${v * scale}px`;

  // The usable-area outline: context only, no region. It is nearly the whole
  // preview, so highlighting it would read as "everything", not one setting.
  const usable = el("div", "theme-region theme-region--usable");
  usable.dataset.key = "usable";
  usable.style.left = px(t.margin);
  usable.style.top = px(t.margin);
  usable.style.width = px(usableWidth(t));
  usable.style.height = px(usableHeight(t));
  usable.appendChild(tag(tr("editor.preview.usable", { width: usableWidth(t), height: usableHeight(t) }), "theme-tag--usable"));
  stage.appendChild(usable);

  // The margin, drawn as the four bands of outer space it is. Without them
  // the margin control governs empty canvas, with nothing to highlight or to
  // hover. All four share one region name and value; dragging any inner edge
  // moves the margin on every side.
  const inner = usableHeight(t);
  [
    { side: "top", box: { left: 0, top: 0, width: t.canvasWidth, height: t.margin }, axis: "y", sign: 1 },
    { side: "bottom", box: { left: 0, top: t.canvasHeight - t.margin, width: t.canvasWidth, height: t.margin }, axis: "y", sign: -1, edge: "top" },
    { side: "left", box: { left: 0, top: t.margin, width: t.margin, height: inner }, axis: "x", sign: 1 },
    { side: "right", box: { left: t.canvasWidth - t.margin, top: t.margin, width: t.margin, height: inner }, axis: "x", sign: -1, edge: "left" }
  ].forEach(band => {
    const node = region("margin", `theme-region theme-region--margin theme-region--margin-${band.side}`, band.box, px, `margin-${band.side}`);
    // The label fits only once the band is a few real pixels tall; below that
    // it would spill over the header. The drag handle stays either way, so a
    // margin dragged to 0 can be dragged back out.
    if (band.side === "top" && t.margin * scale >= 11) {
      node.appendChild(el("span", "theme-margin__value", tr("editor.preview.margin", { value: t.margin })));
    }
    node.appendChild(dragHandle("margin", band.axis, band.sign, scale, band.edge));
    stage.appendChild(node);
  });

  // Header
  const title = region("title", "theme-region theme-region--title", {
    left: t.margin, top: g.TITLE_Y, width: usableWidth(t), height: t.titleHeight
  }, px);
  title.appendChild(tag(tr("editor.preview.header", { height: t.titleHeight })));
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
    // (buildEffectiveStack drops it), so it has no slot to move to and
    // reordering it in `sections` would change nothing on screen.
    // A tall narrow column has no room for a one-line chip, so this one wraps.
    column.appendChild(tag(
      tr("editor.preview.slicerColumn", { width: t.slicerColumnWidth, min: t.minSlicerColumnWidth, max: t.maxSlicerColumnWidth }),
      "theme-tag--wrap"));
    stage.appendChild(column);
  } else {
    const stripe = region("slicer", "theme-region theme-region--slicer", {
      left: t.margin, top: g.slicersTop, width: usableWidth(t), height: t.slicerHeight
    }, px);
    stackCells(stripe, t.defaultSlicersPerRow, t.gapSmall * scale, "row");
    stripe.appendChild(dragHandle("slicerHeight", "y", 1, scale));
    stripe.appendChild(grip("slicers", slicersSectionId(t),
      tr("editor.preview.slicers", {
        count: t.defaultSlicersPerRow,
        width: cellWidth(usableWidth(t), t.defaultSlicersPerRow, t.gapSmall),
        min: t.minSlicerWidth,
        height: t.slicerHeight
      })));
    stage.appendChild(stripe);
  }

  // KPI bands. The walker's `placed` list gives each showing kpi section its
  // real top/height (previewLayout() seeds one sample card, so that is every
  // kpi section), so nothing is recomputed here. The header band is the
  // first; a theme may define any number of others interrupting the chart
  // area, all rendered the same way below.
  const kpiEntries = g.sections.filter(s => s.type === "kpi");
  const headerKpi = kpiEntries[0] || null;
  const extraKpis = kpiEntries.slice(1);

  if (headerKpi) {
    const kpi = region("kpi", "theme-region theme-region--kpi", {
      left: g.contentLeft, top: headerKpi.top, width: g.contentWidth, height: headerKpi.height
    }, px, `kpi:${headerKpi.id}`);
    kpi.dataset.sectionId = headerKpi.id;
    stackCells(kpi, t.defaultKpisPerRow, t.gapSmall * scale, "row");
    kpi.appendChild(dragHandle("kpiMinHeight", "y", 1, scale));
    kpi.appendChild(grip("kpi", headerKpi.id,
      tr("editor.preview.kpi", {
        count: t.defaultKpisPerRow,
        width: cellWidth(g.contentWidth, t.defaultKpisPerRow, t.gapSmall),
        height: t.kpiMinHeight
      })));
    stage.appendChild(kpi);
  }

  // Chart rows. g.rowTops/g.rowHeights already account for a middle band
  // taking space between two rows, as on the real canvas.
  for (let i = 0; i < g.rowCount; i++) {
    const top = g.rowTops[i];
    const height = g.rowHeights[i];
    const row = region("charts", "theme-region theme-region--chart", {
      left: g.contentLeft, top, width: g.contentWidth, height
    }, px, `charts:${i}`);
    if (i === 0) {
      row.appendChild(tag(
        tr("editor.preview.charts", { height: Math.round(height), min: t.minChartRowHeight, width: t.minChartWidth })
      ));
    }
    if (g.tooSmall) row.classList.add("is-too-small");
    stackCells(row, PREVIEW_CHART_COLS, t.gapSmall * scale, "row");
    stage.appendChild(row);
  }

  extraKpis.forEach(entry => {
    const section = t.sections.find(s => s.type === "kpi" && s.id === entry.id);
    const rowLabel = afterRowLabel(t, section, g.chartGroups);
    const band = region("kpi-band2", "theme-region theme-region--kpi", {
      left: g.contentLeft, top: entry.top, width: g.contentWidth, height: entry.height
    }, px, `kpi:${entry.id}`);
    band.dataset.sectionId = entry.id;
    stackCells(band, entry.defaultCount, t.gapSmall * scale, "row");
    band.appendChild(grip("kpi", entry.id,
      tr("editor.preview.band", {
        count: entry.defaultCount,
        width: cellWidth(g.contentWidth, entry.defaultCount, t.gapSmall),
        row: rowLabel
      })));
    stage.appendChild(band);
  });

  // Gap rulers. The two spacing values are otherwise invisible space, so each
  // gets a measured, draggable strip. Which gap goes where swaps with the
  // orientation, as in the real solver: horizontally the small gap separates
  // slicers from the title and the block gap separates KPIs from charts;
  // vertically the block gap separates the content block from the title and
  // the small gap separates charts from KPIs.
  //
  // The boundary is not fixed: it follows band order and any per-band
  // `gapBefore` override. So each strip is drawn at a boundary the walk really
  // applied that value to (each placed box records its gap as `gapAbove`),
  // not where the default title -> slicers -> kpi -> charts order would put
  // it. A value nothing uses gets no ruler, which beats a strip across an
  // unrelated band. Each strip spans the band below it.
  const takenBoundaries = new Set();
  [
    ["gap-small", "gapSmall", t.gapSmall],
    ["gap-block", "gapKpiToCharts", t.gapKpiToCharts]
  ].forEach(([regionName, fieldKey, value]) => {
    if (value <= 0) return;
    // Two gaps can share a number; giving each its own boundary stops the
    // second strip stacking invisibly on the first.
    const i = g.sections.findIndex((s, k) => s.gapAbove === value && !takenBoundaries.has(k));
    if (i === -1) return;
    takenBoundaries.add(i);

    const entry = g.sections[i];
    // The strip spans the usable width when it separates full-width bands.
    // In a vertical layout it also does for the block gap under the title,
    // where the slicer column starts at the same boundary. It must cover the
    // column too, or the space above the column reads as nothing.
    const spansUsable = entry.type === "title" || entry.type === "slicers"
      || (g.vertical && entry.top === g.slicerColumnTop && value === t.gapKpiToCharts);
    stage.appendChild(gapRuler(regionName, fieldKey, value, {
      left: spansUsable ? t.margin : g.contentLeft,
      top: entry.top - value,
      width: spansUsable ? usableWidth(t) : g.contentWidth,
      height: value
    }, px, scale));
  });

  // The block gap also separates a slicer column from the content block
  // sideways (contentBoxFor() in sectionWalker.js). The stack walk never
  // visits that boundary, so it gets its own upright strip on the column's
  // side. Same region as the horizontal strip: both are one value.
  if (g.vertical && t.gapKpiToCharts > 0) {
    const right = g.slicerColumnLeft > g.contentLeft;
    stage.appendChild(gapRuler("gap-block", "gapKpiToCharts", t.gapKpiToCharts, {
      left: right ? g.contentLeft + g.contentWidth : g.slicerColumnLeft + t.slicerColumnWidth,
      top: g.slicerColumnTop,
      width: t.gapKpiToCharts,
      height: g.slicerColumnHeight
    }, px, scale, right ? { axis: "x", sign: -1, side: "left" } : { axis: "x", sign: 1 }));
  }

  playBoxes(stage, snap, { selector: REGION, keyOf: regionKey, motion, clean: cleanRegion });
}

function cellWidth(total, count, gap) {
  if (count <= 0) return 0;
  return Math.max(0, Math.floor((total - (count - 1) * gap) / count));
}

// `key` names the region for the motion replay. It defaults to the region
// name, enough wherever a theme draws only one.
function region(regionName, className, box, px, key = regionName) {
  const node = el("div", className);
  node.dataset.region = regionName;
  node.dataset.key = key;
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

// Draws the region's cells, so a stripe reads as "the slicers that will sit
// here", not one big block.
function stackCells(parent, count, gapPx, direction) {
  const grid = el("div", `theme-cells theme-cells--${direction}`);
  grid.style.gap = `${Math.max(1, gapPx)}px`;
  for (let i = 0; i < Math.max(1, count); i++) grid.appendChild(el("div", "theme-cell"));
  parent.appendChild(grid);
}

// `handle` picks the draggable edge. A horizontal strip grows downward by
// default. An upright one ({ axis: "x", sign, side }) grows sideways and gets
// the modifier that turns its value pill along the strip.
function gapRuler(regionName, fieldKey, value, box, px, scale, handle = { axis: "y", sign: 1 }) {
  const upright = handle.axis === "x";
  const node = region(regionName, `theme-region theme-region--gap${upright ? " theme-region--gap-x" : ""}`, box, px,
    upright ? `${regionName}-x` : regionName);
  // Same guard as the margin label: below a few real pixels the pill would
  // spill over its neighbours.
  if (!upright || value * scale >= 11) {
    node.appendChild(el("span", "theme-gap__value", t("editor.preview.gap", { value })));
  }
  node.appendChild(dragHandle(fieldKey, handle.axis, handle.sign, scale, handle.side));
  return node;
}

// A grab strip on a region edge that edits one field directly. `sign` is +1
// when dragging away from the origin grows the value, -1 when it shrinks it
// (the margin's top edge moves down as the margin grows, so it is inverted).
function dragHandle(fieldKey, axis, sign, scale, side) {
  const field = FIELD_BY_KEY[fieldKey];
  const handle = el("div", `theme-handle theme-handle--${axis}${side ? " theme-handle--" + side : ""}`);
  handle.title = t("editor.dragToAdjust", { field: field.label });

  handle.addEventListener("pointerdown", event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const start = axis === "x" ? event.clientX : event.clientY;
    const startValue = draft[fieldKey];
    setHighlight(field.region);

    // render() rebuilds every control and the whole preview, so one per
    // pointer event is more than the screen shows. Coalesce to one per frame,
    // as the reorder drag does.
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
      // Land on the pointer's last position, not the last rendered frame.
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
    [tr("editor.stat.canvas"), tr("editor.stat.size", { width: t.canvasWidth, height: t.canvasHeight })],
    [tr("editor.stat.usable"), tr("editor.stat.size", { width: usableWidth(t), height: usableHeight(t) })],
    [tr("editor.stat.rowHeight"), tr("editor.stat.px", { value: Math.max(0, Math.round(g.rowHeights[0] ?? 0)) })],
    [tr("editor.stat.contentWidth"), tr("editor.stat.px", { value: g.contentWidth })],
    [tr("editor.stat.step"), tr("editor.stat.px", { value: t.step })]
  ];

  stats.forEach(([label, value]) => {
    const item = el("div", "theme-stat");
    item.appendChild(el("span", "theme-stat__label", label));
    item.appendChild(el("span", "theme-stat__value", value));
    readout.appendChild(item);
  });

  const issues = validateTheme(t);
  if (g.tooSmall) {
    issues.push(issue("warning", "rowsTooSmall", { rows: g.rowCount, min: t.hardMinChartHeight }));
  }

  renderStatus(issues);
  root.querySelector(".theme-editor__head-actions .btn-primary").disabled = issues.some(i => i.severity === "error");
}

// All clear is one quiet line. Otherwise a count (which also explains why
// Save is off), then each finding as a headline with its fix beneath.
function renderStatus(issues) {
  const status = root.querySelector(".theme-stage__status");
  const key = JSON.stringify(issues);
  if (status.dataset.key === key) return;
  status.dataset.key = key;
  status.innerHTML = "";

  // Only a new finding fades in (R2). The rest are rebuilt in place, so a
  // drag that keeps changing the list doesn't flicker.
  const before = shownFindings;
  shownFindings = new Set(issues.map(i => i.title));
  const isNew = title => before !== null && !before.has(title);

  if (issues.length === 0) {
    const ok = el("p", "theme-status theme-status--ok");
    if (before && before.size) ok.classList.add("m-reveal");
    ok.appendChild(iconEl("check"));
    ok.appendChild(el("span", null, tr("editor.status.ok")));
    status.appendChild(ok);
    return;
  }

  const errors = issues.filter(i => i.severity === "error").length;
  const warnings = issues.length - errors;
  const counts = [];
  if (errors) counts.push(tr("editor.status.errors", { count: errors }));
  if (warnings) counts.push(tr("editor.status.warnings", { count: warnings }));

  const summary = el("p", "theme-status");
  summary.appendChild(el("span", "theme-status__count", counts.join(" · ")));
  if (errors) summary.appendChild(el("span", "theme-status__note", tr("editor.status.saveBlocked")));
  status.appendChild(summary);

  const list = el("ul", "theme-issues");
  issues.forEach(({ severity, title, hint }) => {
    const item = el("li", `theme-issue theme-issue--${severity}`);
    if (isNew(title)) item.classList.add("m-reveal");
    const badge = el("span", "theme-issue__badge");
    badge.appendChild(iconEl(severity));
    item.appendChild(badge);
    const body = el("div", "theme-issue__body");
    body.appendChild(el("span", "theme-issue__title", title));
    if (hint) body.appendChild(el("span", "theme-issue__hint", hint));
    item.appendChild(body);
    list.appendChild(item);
  });
  status.appendChild(list);
}

// --- Actions ------------------------------------------------------------

function requestClose() {
  closeThemeEditor();
}

function handleSave() {
  const label = String(draft.label || "").trim();
  if (!label) {
    flash(t("editor.nameRequired"), "error");
    markNameInvalid(true);
    // R7, refusal: point at the field that blocked it.
    flashEl(root.querySelector(".theme-editor__name-box"));
    root.querySelector("#theme-name").focus();
    return;
  }

  const theme = { ...normalizeTheme({ ...draft, label }), builtin: false };

  // A theme created from a built-in gets its id at save time, from the final
  // name. An id made at open time would keep the throwaway "FULL HD – vlastní"
  // wording forever.
  if (editingExistingId === null) theme.id = makeThemeId(label, themeIdsInUse());
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

async function handleDelete() {
  if (editingExistingId === null) return;
  const inUse = getAllThemes().find(t => t.id === editingExistingId);
  if (!inUse) return;

  const id = editingExistingId;
  const confirmed = await confirmDialog({
    title: t("editor.confirmDeleteTitle", { label: draft.label }),
    message: t("editor.confirmDelete"),
    confirmLabel: t("editor.delete"),
    danger: true
  });
  // The editor may have changed while the question was open.
  if (!confirmed || editingExistingId !== id || !root || root.hidden) return;

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
  const safe = label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || t("editor.exportFallbackName");
  downloadJson(t("editor.exportFileName", { name: safe }), exportThemeJson(draft));
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

    // One theme in the file loads into the editor for review. A collection
    // is saved wholesale, since a single-theme editor can't show five.
    if (parsed.themes.length === 1) {
      draft = { ...parsed.themes[0], builtin: false, id: draft.id, label: parsed.themes[0].label };
      editingExistingId = null;
      render({ motion: "swap" });
      flash(t("editor.imported", { label: draft.label }), "ok");
      return;
    }

    const result = importThemes(parsed.themes, themeIdsInUse());
    if (!result.ok) {
      flash(result.error, "error");
      return;
    }
    closeThemeEditor();
    if (onApply) onApply(result.imported[result.imported.length - 1]);
  };
  reader.onerror = () => flash(t("editor.readFailed"), "error");
  reader.readAsText(file);
}

function flash(text, severity) {
  const kind = severity === "ok" ? "ok" : "error";
  const node = el("p", `theme-notice theme-notice--${kind} m-reveal`);
  node.appendChild(iconEl(kind === "ok" ? "check" : "error"));
  node.appendChild(el("span", null, text));
  // One notice at a time; a newer one replaces the old.
  root.querySelector(".theme-stage__notice").replaceChildren(node);
  setTimeout(() => leave(node, () => node.remove()), 4000);
}

function markNameInvalid(invalid) {
  const name = root.querySelector("#theme-name");
  name.closest(".theme-editor__name-box").classList.toggle("is-invalid", invalid);
  if (invalid) name.setAttribute("aria-invalid", "true");
  else name.removeAttribute("aria-invalid");
}
