// assets/js/elements/elementsSection.js
//
// The rail's "Customize Elements" section: the styles of slicers, KPI cards
// and charts, for every page of the project and for the Power BI export.
//
// Controls on the left and a live mock on the right, like the layout editor
// (theme/themeEditor.js), and the two are one object: hovering a control
// outlines the part of the mock it changes, hovering a part of the mock
// lights its controls. Every edit shows as it happens — a slider writes CSS
// variables on the mock each frame (elementPreview.js applyStyles) and draws
// a guide explaining the value (the radius arcs, the padding bands, the
// text-size rulers…). "Highlight changes" marks everything that differs from
// the defaults, and holding "Compare" shows the defaults in place.
//
// Edits go into a draft (elementStyles.js): Save & Apply hands it to the
// project (canvas, export, project file), Discard drops it, and leaving the
// section with one unsaved asks which. The draft has its own undo history:
// while this section is open, the top bar's undo / redo and Ctrl+Z / Ctrl+Y
// act on it (state/history.js setHistoryDelegate).
//
// Motion follows ui/motion.js: a discrete change (a switch, a choice, a
// reset, undo) eases the mock to its new look; a drag never does, it follows
// the pointer frame by frame (R5).

import {
  ELEMENT_TYPES,
  FONTS,
  THEME_COLORS,
  SHADOW_PRESETS,
  fieldsFor,
  fieldFor,
  groupsFor,
  groupLabel,
  fieldLabel,
  typeLabel,
  changedKeys,
  defaultElementStyles,
  resolveColor
} from "./elementStyleModel.js";
import {
  getDraftStyles,
  hasUnsavedDraft,
  unsavedTypes,
  saveDraft,
  discardDraft,
  setField,
  setFields,
  commitStyles,
  resetStyles,
  undoStyles,
  redoStyles,
  canUndoStyles,
  canRedoStyles,
  onStylesChange
} from "./elementStyles.js";
import { buildFrame, applyStyles, frameSize, showGuide, hideGuides, pulse } from "./elementPreview.js";
import { setHistoryDelegate, syncHistoryButtons } from "../state/history.js";
import { icon } from "../ui/icon.js";
import { createSwitch } from "../ui/switch.js";
import { durationMs, leave } from "../ui/motion.js";
import { choiceDialog } from "../ui/dialog.js";
import { setRailDot } from "../ui/rail.js";
import { addWarning } from "../ui/warnings.js";
import { t, onLocaleChange } from "../i18n/i18n.js";

let root = null;
let activeType = "slicer";
let zoomMode = "fit";              // "fit" | one of ZOOM_STEPS
let showChanges = false;
let comparing = false;
let highlightedPart = null;
const collapsed = new Set();       // group ids folded by the user, this session
const paddingLinked = {};          // type → whether padding is edited as one value

// Rebuilt per type: the field rows, keyed by field key.
let rows = new Map();
let stageFrame = null;
let stripFrames = {};

const PADDING_SIDES = ["top", "right", "bottom", "left"];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const values = () => getDraftStyles()[activeType];
const isOpen = () => document.body.classList.contains("section-prvky");

// --- Public API ---------------------------------------------------------------

export function initElementsSection() {
  root = document.getElementById("section-prvky");
  if (!root) return;

  onStylesChange(info => {
    if (!root.firstChild) return;
    if (info.all) {
      // Undo, redo, reset, discard, a project opened: everything may have
      // moved, so the values are re-read and the mock eases to them.
      tween();
      syncAll();
    } else if (info.type) {
      // A drag's frames are instant; a click's change eases.
      if (!info.transient) tween();
      syncField(info.type, info.key);
    }
    syncHead();
    syncHistoryButtons();
  });

  setHistoryDelegate({
    active: isOpen,
    undo: undoStyles,
    redo: redoStyles,
    canUndo: canUndoStyles,
    canRedo: canRedoStyles
  });

  onLocaleChange(() => {
    if (root.firstChild) build();
  });

  window.addEventListener("resize", () => { if (isOpen()) fitZoom(); });
}

/**
 * Before the rail leaves this section: with an unsaved draft, asks whether to
 * save it, discard it or stay. Resolves whether to go ahead.
 */
export async function confirmLeaveElements() {
  commitStyles();
  if (!hasUnsavedDraft()) return true;
  const answer = await choiceDialog({
    title: t("elements.leave.title"),
    message: t("elements.leave.text"),
    cancelLabel: t("elements.leave.stay"),
    choices: [
      { label: t("elements.leave.discard"), value: "discard", danger: true },
      { label: t("elements.leave.save"), value: "save", primary: true }
    ]
  });
  if (answer === "save") save();
  else if (answer === "discard") discardDraft();
  return answer !== null;
}

function save() {
  if (!saveDraft()) return;
  addWarning(t("elements.saved"), "info");
  // A ring breathes out of the mock: the look it shows is now the project's
  // (motion.js R7).
  if (stageFrame) pulse(stageFrame, "container");
}

/** Called by the rail when the section comes on screen. */
export function openElementsSection() {
  if (!root) return;
  if (!root.firstChild) build();
  else fitZoom();
  syncHistoryButtons();
}

// --- Building -----------------------------------------------------------------

function build() {
  root.innerHTML = "";
  const card = el("div", "elements__card");
  card.appendChild(buildHead());

  const body = el("div", "elements__body");
  const controls = el("div", "elements__controls");
  controls.setAttribute("aria-label", t("elements.controls"));
  controls.setAttribute("role", "region");
  body.appendChild(controls);
  body.appendChild(buildStage());
  card.appendChild(body);
  root.appendChild(card);

  selectType(activeType, { force: true });
}

function buildHead() {
  // The layout editor's head: what is being edited on the left, the commit
  // buttons at the right end, Save & Apply last (theme/themeEditor.js).
  const head = el("div", "elements__head");

  const heading = el("div", "elements__heading");
  heading.appendChild(el("h2", "elements__title", t("elements.title")));
  heading.appendChild(el("p", "elements__lead", t("elements.lead")));
  head.appendChild(heading);

  const types = el("div", "segmented segmented--3 elements__types");
  types.setAttribute("role", "tablist");
  types.setAttribute("aria-label", t("elements.typesLabel"));
  ELEMENT_TYPES.forEach(type => {
    const button = el("button", "template-option elements__type");
    button.type = "button";
    button.dataset.type = type;
    button.setAttribute("role", "tab");
    button.appendChild(el("span", "elements__type-label", typeLabel(type)));
    // Lit while this type has edits that aren't saved yet.
    button.appendChild(el("span", "elements__type-dot"));
    button.addEventListener("click", () => selectType(type));
    types.appendChild(button);
  });
  head.appendChild(types);
  // The thumb only slides once it has landed, so the first build doesn't
  // show it travelling in from the first tab.
  requestAnimationFrame(() => requestAnimationFrame(() => { types.dataset.ready = ""; }));

  const actions = el("div", "elements__head-actions");
  const discard = el("button", "btn btn-secondary elements__discard");
  discard.type = "button";
  discard.appendChild(el("span", null, t("elements.discard")));
  discard.addEventListener("click", () => discardDraft());
  actions.appendChild(discard);

  // Unsaved edits show as a dot on the button that saves them (and on the
  // rail and the type tabs) rather than as a line of text.
  const saveBtn = el("button", "btn btn-primary elements__save");
  saveBtn.type = "button";
  saveBtn.appendChild(el("span", null, t("elements.save")));
  saveBtn.appendChild(el("span", "elements__save-dot"));
  saveBtn.addEventListener("click", save);
  actions.appendChild(saveBtn);

  head.appendChild(actions);
  return head;
}

const RESET_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const TOOL_ICONS = {
  highlight: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 6v12" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 6H12v12H6.5A2.5 2.5 0 0 1 4 15.5v-7A2.5 2.5 0 0 1 6.5 6Z" fill="currentColor" opacity="0.3"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  fit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// An icon-only button in the voice of the top bar's undo / redo.
function toolButton(iconSvg, label, className) {
  const b = el("button", `btn btn-ghost elements__tool ${className}`);
  b.type = "button";
  b.innerHTML = iconSvg;
  b.title = label;
  b.setAttribute("aria-label", label);
  return b;
}

// The zoom levels − and + step through; "Fit" fills the viewport.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2];

function buildStage() {
  const stage = el("div", "elements__stage");

  // The layout editor's stage toolbar: a label, then its tools on the right.
  const toolbar = el("div", "elements__toolbar");
  toolbar.appendChild(el("span", "elements__toolbar-label", t("elements.preview")));
  const tools = el("div", "elements__tools");

  const highlight = toolButton(TOOL_ICONS.highlight, t("elements.highlightTitle"), "elements__highlight");
  highlight.setAttribute("aria-pressed", String(showChanges));
  highlight.addEventListener("click", () => {
    showChanges = !showChanges;
    highlight.setAttribute("aria-pressed", String(showChanges));
    syncChangeMarks();
  });
  tools.appendChild(highlight);

  const compare = toolButton(TOOL_ICONS.compare, t("elements.compareTitle"), "elements__compare");
  compare.addEventListener("pointerdown", e => { e.preventDefault(); startCompare(); });
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(ev => compare.addEventListener(ev, endCompare));
  compare.addEventListener("keydown", e => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startCompare(); }
  });
  compare.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") endCompare(); });
  tools.appendChild(compare);

  const reset = toolButton(RESET_ICON, t("elements.resetType"), "elements__reset");
  reset.addEventListener("click", () => resetStyles(activeType));
  tools.appendChild(reset);

  toolbar.appendChild(tools);
  stage.appendChild(toolbar);

  const viewport = el("div", "elements__viewport");
  viewport.appendChild(el("div", "elements__zoom-box"));
  viewport.appendChild(el("span", "elements__badge", t("elements.compareBadge")));
  viewport.appendChild(buildZoomControl());
  stage.appendChild(viewport);

  // All three together, as they will sit next to each other in the report.
  const strip = el("div", "elements__strip");
  strip.appendChild(el("span", "elements__strip-label", t("elements.strip")));
  const row = el("div", "elements__strip-row");
  stripFrames = {};
  ELEMENT_TYPES.forEach(type => {
    const button = el("button", "elements__strip-item");
    button.type = "button";
    button.dataset.type = type;
    button.title = typeLabel(type);
    button.setAttribute("aria-label", typeLabel(type));
    const frame = buildFrame(type);
    frame.setAttribute("aria-hidden", "true");
    button.appendChild(frame);
    button.addEventListener("click", () => selectType(type));
    row.appendChild(button);
    stripFrames[type] = frame;
  });
  strip.appendChild(row);
  strip.appendChild(el("p", "elements__note", `${t("elements.hint")} ${t("elements.themeNote")}`));
  stage.appendChild(strip);

  return stage;
}

// The zoom, where most apps keep it: a small floating pill in the preview's
// bottom-right corner. − / + step, the percentage (or the fit icon) fits.
function buildZoomControl() {
  const pill = el("div", "elements__zoom");
  pill.setAttribute("role", "group");
  pill.setAttribute("aria-label", t("elements.zoom"));

  const out = toolButton(TOOL_ICONS.minus, t("elements.zoomOut"), "elements__zoom-out");
  out.addEventListener("click", () => stepZoom(-1));
  pill.appendChild(out);

  const value = el("button", "elements__zoom-value");
  value.type = "button";
  value.title = t("elements.zoomFit");
  value.addEventListener("click", () => { zoomMode = "fit"; fitZoom(); });
  pill.appendChild(value);

  const zoomIn = toolButton(TOOL_ICONS.plus, t("elements.zoomIn"), "elements__zoom-in");
  zoomIn.addEventListener("click", () => stepZoom(1));
  pill.appendChild(zoomIn);

  const fit = toolButton(TOOL_ICONS.fit, t("elements.zoomFit"), "elements__zoom-fit");
  fit.addEventListener("click", () => { zoomMode = "fit"; fitZoom(); });
  pill.appendChild(fit);

  return pill;
}

function stepZoom(direction) {
  const zoom = currentZoom();
  const next = direction > 0
    ? ZOOM_STEPS.find(z => z > zoom + 0.001)
    : [...ZOOM_STEPS].reverse().find(z => z < zoom - 0.001);
  if (next === undefined) return;
  zoomMode = next;
  fitZoom();
}

function selectType(type, { force = false } = {}) {
  if (type === activeType && !force) return;
  commitStyles();
  activeType = type;
  highlightedPart = null;

  root.querySelector(".elements__types").dataset.active = String(ELEMENT_TYPES.indexOf(type));
  root.querySelectorAll(".elements__type").forEach(button => {
    const active = button.dataset.type === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  root.querySelectorAll(".elements__strip-item").forEach(button => {
    button.classList.toggle("is-active", button.dataset.type === type);
  });

  // Another type is new content, not the old one changed (motion.js R3): the
  // old mock fades out as the new one comes in, and the controls cascade in.
  buildControls({ animate: !force });
  buildMock({ animate: !force });
  syncAll();
}

// --- The mock -----------------------------------------------------------------

function buildMock({ animate = false } = {}) {
  const box = root.querySelector(".elements__zoom-box");
  const old = stageFrame;
  if (old && animate) {
    old.classList.add("is-leaving");
    leave(old, () => old.remove());
  } else {
    box.innerHTML = "";
  }
  stageFrame = buildFrame(activeType);
  if (animate) stageFrame.classList.add("m-enter");
  box.appendChild(stageFrame);

  // Hovering a part of the mock lights the controls that change it.
  stageFrame.querySelectorAll("[data-part]").forEach(node => {
    node.addEventListener("mouseover", e => {
      if (e.target.closest("[data-part]") === node) setHighlight(node.dataset.part, "mock");
    });
  });
  stageFrame.addEventListener("mouseleave", () => setHighlight(null));

  stageFrame.appendChild(radiusHandle());
  stageFrame.appendChild(contentOutline());
}

// The zoom is a transform on the box holding the mock, so the mock itself
// always keeps Power BI's px. "Fit" fills the viewport, between 50 and 200 %.
function fitZoom() {
  if (!stageFrame) return;
  const viewport = root.querySelector(".elements__viewport");
  const box = root.querySelector(".elements__zoom-box");
  const [w, h] = frameSize(activeType, values());
  let zoom = zoomMode;
  if (zoomMode === "fit") {
    // Room for the guides' tags and the shadow around the box, and for the
    // zoom pill under it.
    const available = Math.min((viewport.clientWidth - 96) / w, (viewport.clientHeight - 136) / h);
    zoom = Math.max(0.5, Math.min(2, Math.floor(available * 20) / 20 || 1));
  }
  box.style.setProperty("--zoom", String(zoom));
  box.style.width = `${w * zoom}px`;
  box.style.height = `${h * zoom}px`;

  const value = root.querySelector(".elements__zoom-value");
  if (value) value.textContent = `${Math.round(zoom * 100)} %`;
  root.querySelector(".elements__zoom-fit")?.setAttribute("aria-pressed", String(zoomMode === "fit"));
  const outBtn = root.querySelector(".elements__zoom-out");
  if (outBtn) outBtn.disabled = zoom <= ZOOM_STEPS[0] + 0.001;
  const inBtn = root.querySelector(".elements__zoom-in");
  if (inBtn) inBtn.disabled = zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.001;
}

function currentZoom() {
  const box = root.querySelector(".elements__zoom-box");
  return Number(box.style.getPropertyValue("--zoom")) || 1;
}

// Drag the pink dot on the bottom-right corner to round the corners: the dot
// sits on the arc, and the radius follows it along the diagonal.
function radiusHandle() {
  const handle = el("span", "el-handle el-handle--radius");
  handle.title = t("elements.handleRadius");
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const field = fieldFor(activeType, "border.radius");
    const rect = stageFrame.getBoundingClientRect();
    const zoom = currentZoom();
    stageFrame.classList.add("is-dragging");
    const move = ev => {
      const fromCorner = ((rect.right - ev.clientX) + (rect.bottom - ev.clientY)) / 2 / zoom;
      const r = Math.round(fromCorner / (1 - Math.SQRT1_2));
      setField(activeType, field.key, Math.max(field.min, Math.min(field.max, r)), { transient: true });
      showGuide(stageFrame, field, values(), field.part);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      stageFrame.classList.remove("is-dragging");
      commitStyles();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  return handle;
}

// The content box, outlined on hover, with a grip in the middle of each edge:
// drag one to set that side's padding (every side while linked). The striped
// padding bands and the value show while dragging.
function contentOutline() {
  const outline = el("div", "el-content");
  PADDING_SIDES.forEach(side => outline.appendChild(paddingGrip(side)));
  return outline;
}

function paddingGrip(side) {
  const grip = el("span", `el-grip el-grip--${side}`);
  grip.title = t("elements.handlePadding");
  grip.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    const field = fieldFor(activeType, `padding.${side}`);
    const rect = stageFrame.getBoundingClientRect();
    const zoom = currentZoom();
    stageFrame.classList.add("is-dragging");
    grip.classList.add("is-active");
    const move = ev => {
      const fromEdge = {
        top: ev.clientY - rect.top,
        bottom: rect.bottom - ev.clientY,
        left: ev.clientX - rect.left,
        right: rect.right - ev.clientX
      }[side] / zoom;
      const border = values()["border.show"] ? values()["border.width"] : 0;
      const p = Math.max(field.min, Math.min(field.max, Math.round(fromEdge - border)));
      setPadding(p, isPaddingLinked() ? PADDING_SIDES : [side], true);
      showGuide(stageFrame, field, values(), field.part);
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      stageFrame.classList.remove("is-dragging");
      grip.classList.remove("is-active");
      commitStyles();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  });
  return grip;
}

// --- Controls -----------------------------------------------------------------

// A fold that eases open and shut: the app's .collapsible grid-rows pattern
// (style.css), holding `content`.
function collapsible(content, expanded) {
  const outer = el("div", "collapsible" + (expanded ? " expanded" : ""));
  const inner = el("div", "collapsible-inner");
  inner.appendChild(content);
  outer.appendChild(inner);
  return outer;
}

function buildControls({ animate = false } = {}) {
  const pane = root.querySelector(".elements__controls");
  pane.innerHTML = "";
  rows = new Map();

  groupsFor(activeType).forEach((group, index) => {
    const section = el("section", "el-group");
    section.dataset.group = group.id;
    section.classList.toggle("is-collapsed", collapsed.has(group.id));
    if (animate) {
      section.classList.add("m-enter");
      section.style.animationDelay = `${Math.min(index, 6) * 20}ms`;
    }

    const head = el("div", "el-group__head");
    const toggleBtn = el("button", "el-group__toggle");
    toggleBtn.type = "button";
    toggleBtn.setAttribute("aria-expanded", String(!collapsed.has(group.id)));
    toggleBtn.appendChild(el("span", "el-group__title", groupLabel(group.id)));
    toggleBtn.appendChild(el("span", "el-group__dot"));
    toggleBtn.insertAdjacentHTML("beforeend", icon("chevron", "el-group__chevron"));
    toggleBtn.addEventListener("click", () => {
      const fold = !section.classList.contains("is-collapsed");
      section.classList.toggle("is-collapsed", fold);
      groupFold.classList.toggle("expanded", !fold);
      toggleBtn.setAttribute("aria-expanded", String(!fold));
      if (fold) collapsed.add(group.id); else collapsed.delete(group.id);
    });
    head.appendChild(toggleBtn);

    if (group.showKey) {
      const field = fieldFor(activeType, group.showKey);
      const sw = switchControl(field, groupLabel(group.id));
      head.appendChild(sw.node);
      rows.set(field.key, { row: section, field, update: sw.update, isShow: true });
      linkHover(head, field.part);
    }
    section.appendChild(head);

    const body = el("div", "el-group__body");
    const fields = fieldsFor(activeType).filter(f => f.group === group.id && f.key !== group.showKey);

    if (group.id === "padding") {
      body.appendChild(buildPadding(fields));
    } else {
      fields.forEach(field => body.appendChild(buildField(field)));
    }
    const groupFold = collapsible(body, !collapsed.has(group.id));
    section.appendChild(groupFold);
    pane.appendChild(section);
  });
}

function fieldRow(field, labelText) {
  const row = el("div", "theme-field el-field");
  row.dataset.field = field.key;
  row.dataset.part = field.part;

  const top = el("div", "el-field__top");
  const label = el("label", "theme-field__label el-field__label", labelText ?? fieldLabel(field.key));
  label.htmlFor = `el-input-${field.key}`;
  top.appendChild(label);

  const reset = el("button", "el-field__reset");
  reset.type = "button";
  reset.innerHTML = RESET_ICON;
  reset.title = t("elements.resetField");
  reset.setAttribute("aria-label", t("elements.resetFieldNamed", { name: labelText ?? fieldLabel(field.key) }));
  reset.addEventListener("click", () => {
    setField(activeType, field.key, field.default);
    showGuide(stageFrame, field, values(), field.part);
  });
  top.appendChild(reset);
  row.appendChild(top);

  linkHover(row, field.part);
  return row;
}

function linkHover(node, part) {
  node.addEventListener("mouseenter", () => setHighlight(part, "controls"));
  node.addEventListener("mouseleave", () => setHighlight(null));
  node.addEventListener("focusin", () => setHighlight(part, "controls"));
  node.addEventListener("focusout", () => setHighlight(null));
}

function buildField(field) {
  switch (field.kind) {
    case "number": return numberField(field);
    case "bool": return boolField(field);
    case "enum": return field.key === "dropShadow.preset" ? presetField(field) : enumField(field);
    case "font": return fontField(field);
    case "color": return colorField(field);
    default: return el("div");
  }
}

// A value changed from a control: the mock follows (through onStylesChange)
// and the guide explains it.
function edit(field, value, transient = false) {
  setField(activeType, field.key, value, { transient });
  showGuide(stageFrame, field, values(), field.part);
}

function numberField(field, { labelText, onValue } = {}) {
  const row = fieldRow(field, labelText);
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
  number.id = `el-input-${field.key}`;
  number.className = "theme-field__number";
  number.min = String(field.min);
  number.max = String(field.max);
  number.step = String(field.step);
  controls.appendChild(number);
  controls.appendChild(el("span", "theme-field__unit", field.unit));

  const apply = onValue ?? ((value, transient) => edit(field, value, transient));
  range.addEventListener("input", () => {
    row.classList.add("is-live");
    apply(range.value, true);
  });
  range.addEventListener("change", () => {
    row.classList.remove("is-live");
    commitStyles();
    // The slider is pointer-only; left focused, it would count as a text
    // field and keep Ctrl+Z from undoing the drag it just made.
    range.blur();
  });
  number.addEventListener("input", () => {
    if (number.value === "") return;
    apply(number.value, true);
  });
  number.addEventListener("change", () => commitStyles());
  number.addEventListener("blur", () => {
    commitStyles();
    number.value = String(values()[field.key]);
  });

  row.appendChild(controls);
  rows.set(labelText === undefined ? field.key : `${field.key}#all`, {
    row, field,
    update: value => {
      range.value = String(value);
      if (document.activeElement !== number) number.value = String(value);
      // The filled part of the track, so the slider reads as a level.
      const pct = ((value - field.min) / (field.max - field.min)) * 100;
      range.style.setProperty("--fill", `${pct}%`);
    }
  });
  return row;
}

function switchControl(field, name) {
  const sw = createSwitch({
    label: name,
    id: `el-input-${field.key}`,
    onToggle: on => edit(field, on)
  });
  return { node: sw.node, update: value => sw.set(value) };
}

function boolField(field) {
  const row = fieldRow(field);
  row.classList.add("el-field--inline");
  const sw = switchControl(field, fieldLabel(field.key));
  row.querySelector(".el-field__top").appendChild(sw.node);
  rows.set(field.key, { row, field, update: sw.update });
  return row;
}

function enumField(field) {
  const row = fieldRow(field);
  const group = el("div", "theme-toggle el-toggle");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", fieldLabel(field.key));
  field.options.forEach(option => {
    const button = el("button", "theme-toggle__option", t(`elements.option.${option}`));
    button.type = "button";
    button.dataset.value = option;
    button.setAttribute("role", "radio");
    button.addEventListener("click", () => {
      edit(field, option);
    });
    group.appendChild(button);
  });
  row.appendChild(group);
  rows.set(field.key, {
    row, field,
    update: value => group.querySelectorAll("[data-value]").forEach(b => {
      const on = b.dataset.value === value;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", String(on));
    })
  });
  return row;
}

// The nine directions a Power BI shadow preset throws the shadow, as a 3×3
// pad: the square stands for the visual, each dot for where its shadow falls.
function presetField(field) {
  const row = fieldRow(field);
  const pad = el("div", "el-preset");
  pad.setAttribute("role", "radiogroup");
  pad.setAttribute("aria-label", fieldLabel(field.key));
  SHADOW_PRESETS.forEach(preset => {
    const button = el("button", "el-preset__cell");
    button.type = "button";
    button.dataset.value = preset;
    button.setAttribute("role", "radio");
    button.title = t(`elements.option.${preset}`);
    button.setAttribute("aria-label", button.title);
    button.appendChild(el("span", "el-preset__mark"));
    button.addEventListener("click", () => edit(field, preset));
    pad.appendChild(button);
  });
  row.appendChild(pad);
  rows.set(field.key, {
    row, field,
    update: value => pad.querySelectorAll("[data-value]").forEach(b => {
      const on = b.dataset.value === value;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", String(on));
    })
  });
  return row;
}

function fontField(field) {
  const row = fieldRow(field);
  const select = document.createElement("select");
  select.className = "el-select";
  select.id = `el-input-${field.key}`;
  Object.entries(FONTS).forEach(([name, stack]) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.style.fontFamily = stack;
    select.appendChild(option);
  });
  select.addEventListener("change", () => edit(field, select.value));
  row.appendChild(select);
  rows.set(field.key, {
    row, field,
    update: value => {
      select.value = value;
      select.style.fontFamily = FONTS[value];
    }
  });
  return row;
}

// A swatch that opens, in place, the report theme's colors (with a shade)
// and a custom color. Theme colors follow the report theme in Power BI.
function colorField(field) {
  const row = fieldRow(field);
  row.classList.add("el-field--color");

  const trigger = el("button", "el-color");
  trigger.type = "button";
  trigger.id = `el-input-${field.key}`;
  trigger.setAttribute("aria-expanded", "false");
  const chip = el("span", "el-color__chip");
  const text = el("span", "el-color__text");
  trigger.appendChild(chip);
  trigger.appendChild(text);
  trigger.insertAdjacentHTML("beforeend", icon("chevron", "el-color__chevron"));
  row.appendChild(trigger);

  const panel = el("div", "el-color-panel");

  panel.appendChild(el("span", "el-color-panel__label", t("elements.color.theme")));
  const slots = el("div", "el-color-panel__slots");
  THEME_COLORS.forEach((hexValue, id) => {
    const slot = el("button", "el-color-panel__slot");
    slot.type = "button";
    slot.dataset.id = String(id);
    slot.style.background = hexValue;
    slot.title = slotName(id);
    slot.setAttribute("aria-label", slot.title);
    slot.addEventListener("click", () => {
      const current = values()[field.key];
      edit(field, { mode: "theme", id, percent: current.mode === "theme" ? current.percent : 0 });
    });
    slots.appendChild(slot);
  });
  panel.appendChild(slots);

  const shadeRow = el("label", "el-color-panel__shade");
  shadeRow.appendChild(el("span", null, t("elements.color.shade")));
  const shade = document.createElement("input");
  shade.type = "range";
  shade.className = "theme-field__range";
  shade.min = "-60";
  shade.max = "60";
  shade.step = "5";
  const shadeValue = el("span", "el-color-panel__shade-value");
  shade.addEventListener("input", () => {
    const current = values()[field.key];
    const id = current.mode === "theme" ? current.id : 0;
    edit(field, { mode: "theme", id, percent: Number(shade.value) / 100 }, true);
  });
  shade.addEventListener("change", () => commitStyles());
  shadeRow.appendChild(shade);
  shadeRow.appendChild(shadeValue);
  panel.appendChild(shadeRow);

  panel.appendChild(el("span", "el-color-panel__label", t("elements.color.custom")));
  const customRow = el("div", "el-color-panel__custom");
  const picker = document.createElement("input");
  picker.type = "color";
  picker.className = "el-color-panel__picker";
  picker.setAttribute("aria-label", t("elements.color.custom"));
  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.className = "el-color-panel__hex";
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.setAttribute("aria-label", t("elements.color.hex"));
  picker.addEventListener("input", () => edit(field, { mode: "hex", hex: picker.value.toUpperCase() }, true));
  picker.addEventListener("change", () => commitStyles());
  hexInput.addEventListener("input", () => {
    const v = hexInput.value.trim();
    const hexValue = v.startsWith("#") ? v : `#${v}`;
    if (/^#[0-9a-f]{6}$/i.test(hexValue)) edit(field, { mode: "hex", hex: hexValue.toUpperCase() }, true);
  });
  hexInput.addEventListener("change", () => commitStyles());
  customRow.appendChild(picker);
  customRow.appendChild(hexInput);
  panel.appendChild(customRow);
  const fold = collapsible(panel, false);
  // Folded, the panel's controls stay out of the tab order.
  panel.inert = true;
  row.appendChild(fold);

  trigger.addEventListener("click", () => {
    const open = !fold.classList.contains("expanded");
    fold.classList.toggle("expanded", open);
    panel.inert = !open;
    trigger.setAttribute("aria-expanded", String(open));
    row.classList.toggle("is-open", open);
  });

  rows.set(field.key, {
    row, field,
    update: value => {
      const hexValue = resolveColor(value);
      chip.style.background = hexValue;
      text.textContent = colorText(value);
      slots.querySelectorAll("[data-id]").forEach(slot => {
        slot.classList.toggle("is-active", value.mode === "theme" && Number(slot.dataset.id) === value.id);
      });
      shade.disabled = value.mode !== "theme";
      const percent = value.mode === "theme" ? Math.round(value.percent * 100) : 0;
      shade.value = String(percent);
      shadeValue.textContent = `${percent > 0 ? "+" : ""}${percent} %`;
      picker.value = hexValue.toLowerCase();
      if (document.activeElement !== hexInput) hexInput.value = value.mode === "hex" ? value.hex : "";
      hexInput.placeholder = hexValue;
    }
  });
  return row;
}

// Slot 0 and 1 are the theme's background and text colors, the rest its
// data colors — named the way Power BI's own color picker lists them.
function slotName(id) {
  if (id === 0) return t("elements.color.background");
  if (id === 1) return t("elements.color.foreground");
  return t("elements.color.slot", { n: id - 1 });
}

function colorText(value) {
  if (value.mode === "hex") return value.hex;
  const percent = Math.round(value.percent * 100);
  const name = slotName(value.id);
  if (percent === 0) return name;
  return t(percent > 0 ? "elements.color.lighter" : "elements.color.darker", { name, value: Math.abs(percent) });
}

// Padding: one value for every side while linked (the usual case), the four
// sides when unlinked. Linked starts as "the four are equal".
function isPaddingLinked() {
  if (!(activeType in paddingLinked)) {
    const v = values();
    paddingLinked[activeType] = PADDING_SIDES.every(side => v[`padding.${side}`] === v["padding.top"]);
  }
  return paddingLinked[activeType];
}

function setPadding(value, sides, transient) {
  setFields(activeType, sides.map(side => [`padding.${side}`, value]), { transient });
}

function buildPadding(fields) {
  const wrap = el("div", "el-padding");

  const link = el("button", "el-link");
  link.type = "button";
  link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  link.appendChild(el("span", null, t("elements.paddingLinked")));
  wrap.appendChild(link);

  const top = fields.find(f => f.key === "padding.top");
  const all = numberField(top, {
    labelText: t("elements.paddingAll"),
    onValue: (value, transient) => {
      setPadding(value, PADDING_SIDES, transient);
      showGuide(stageFrame, top, values(), top.part);
    }
  });
  all.classList.add("el-padding__all");
  const allFold = collapsible(all, true);
  wrap.appendChild(allFold);

  const sides = el("div", "el-padding__sides");
  fields.forEach(field => sides.appendChild(numberField(field)));
  const sidesFold = collapsible(sides, false);
  wrap.appendChild(sidesFold);

  const sync = () => {
    const linked = isPaddingLinked();
    link.setAttribute("aria-pressed", String(linked));
    link.title = t(linked ? "elements.paddingUnlink" : "elements.paddingLink");
    allFold.classList.toggle("expanded", linked);
    sidesFold.classList.toggle("expanded", !linked);
    all.inert = !linked;
    sides.inert = linked;
  };
  link.addEventListener("click", () => {
    paddingLinked[activeType] = !isPaddingLinked();
    // Linking evens the sides out to the top value, as one step.
    if (paddingLinked[activeType]) setPadding(values()["padding.top"], PADDING_SIDES, false);
    sync();
  });
  sync();
  return wrap;
}

// --- Syncing --------------------------------------------------------------------

function syncAll() {
  if (!stageFrame) return;
  rows.forEach((entry, key) => entry.update(values()[key.replace("#all", "")]));
  applyStyles(stageFrame, activeType, comparing ? defaultElementStyles()[activeType] : values());
  ELEMENT_TYPES.forEach(type => applyStyles(stripFrames[type], type, getDraftStyles()[type]));
  fitZoom();
  syncHead();
  syncChangeMarks();
  syncGroups();
}

function syncField(type, key) {
  if (type === activeType) {
    rows.get(key)?.update(values()[key]);
    if (key === "padding.top") rows.get("padding.top#all")?.update(values()[key]);
    if (!comparing) applyStyles(stageFrame, activeType, values());
    if (key === "data.mode") fitZoom();
  }
  applyStyles(stripFrames[type], type, getDraftStyles()[type]);
  syncChangeMarks();
  syncGroups();
}

// A group whose show switch is off dims its fields: they still apply the
// moment it is switched back on.
function syncGroups() {
  groupsFor(activeType).forEach(group => {
    if (!group.showKey) return;
    const section = root.querySelector(`.el-group[data-group="${group.id}"]`);
    section?.classList.toggle("is-off", values()[group.showKey] === false);
  });
}

function syncHead() {
  const reset = root.querySelector(".elements__reset");
  if (reset) reset.disabled = changedKeys(getDraftStyles(), activeType).length === 0;

  const unsaved = hasUnsavedDraft();
  const saveBtn = root.querySelector(".elements__save");
  if (saveBtn) {
    saveBtn.disabled = !unsaved;
    saveBtn.classList.toggle("is-dirty", unsaved);
    saveBtn.title = unsaved ? t("elements.saveDirty") : "";
  }
  const discard = root.querySelector(".elements__discard");
  if (discard) discard.disabled = !unsaved;
  setRailDot("prvky", unsaved);

  const dirtyTypes = unsavedTypes();
  root.querySelectorAll(".elements__type").forEach(button => {
    button.classList.toggle("has-changes", dirtyTypes.includes(button.dataset.type));
  });
}

// The pink dot and reset button on every changed control, the dot on each
// group holding one, and — with "Highlight changes" on — the glow on every
// part of the mock that no longer looks like the default.
function syncChangeMarks() {
  if (!stageFrame) return;
  const changed = new Set(changedKeys(getDraftStyles(), activeType));

  rows.forEach((entry, key) => {
    if (entry.isShow) return;
    const isChanged = key.endsWith("#all")
      ? PADDING_SIDES.some(side => changed.has(`padding.${side}`))
      : changed.has(key);
    entry.row.classList.toggle("is-changed", isChanged);
  });

  root.querySelectorAll(".el-group").forEach(section => {
    const groupChanged = fieldsFor(activeType).some(f => f.group === section.dataset.group && changed.has(f.key));
    section.classList.toggle("has-changes", groupChanged);
  });

  const changedParts = new Set(fieldsFor(activeType).filter(f => changed.has(f.key)).map(f => f.part));
  stageFrame.classList.toggle("show-changes", showChanges);
  stageFrame.querySelectorAll("[data-part]").forEach(node => {
    node.classList.toggle("is-changed", changedParts.has(node.dataset.part));
  });
  // Border, shadow and padding have no node of their own: they mark the box.
  ["border", "shadow", "padding"].forEach(p => stageFrame.classList.toggle(`changed-${p}`, changedParts.has(p)));
}

// --- Highlight, compare, motion ---------------------------------------------------

function setHighlight(part, from) {
  // A handle drag passes over the mock's parts; they are not what is edited.
  if (stageFrame?.classList.contains("is-dragging") && part !== null) return;
  if (part === highlightedPart) return;
  highlightedPart = part;
  if (!stageFrame) return;
  stageFrame.querySelectorAll("[data-part]").forEach(node => {
    node.classList.toggle("is-linked", !!part && node.dataset.part === part);
  });
  ["border", "shadow", "padding"].forEach(p => stageFrame.classList.toggle(`lit-${p}`, part === p));
  // Only a hover over the mock lights the controls; a hovered control is
  // already lit by its own :hover.
  root.querySelectorAll(".el-field[data-part]").forEach(row => {
    row.classList.toggle("is-linked", from === "mock" && !!part && row.dataset.part === part);
  });
  if (part === null) hideGuides(stageFrame);
}

function startCompare() {
  if (comparing || !stageFrame) return;
  comparing = true;
  tween();
  root.querySelector(".elements__viewport").classList.add("is-comparing");
  applyStyles(stageFrame, activeType, defaultElementStyles()[activeType]);
}

function endCompare() {
  if (!comparing) return;
  comparing = false;
  tween();
  root.querySelector(".elements__viewport").classList.remove("is-comparing");
  applyStyles(stageFrame, activeType, values());
}

// Discrete jumps (compare, undo, reset) ease; a slider drag never does — it
// has to follow the thumb frame by frame (motion.js R5).
let tweenTimer = null;
function tween() {
  if (!stageFrame) return;
  stageFrame.classList.add("is-tweening");
  clearTimeout(tweenTimer);
  tweenTimer = setTimeout(() => stageFrame?.classList.remove("is-tweening"), durationMs("--slow") + 60);
}
