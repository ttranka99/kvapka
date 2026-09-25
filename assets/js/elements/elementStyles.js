// assets/js/elements/elementStyles.js
//
// The project's element styles: one set per element type, shared by every
// page. Two copies are kept:
//
//   saved — the project's styles. state/tabs.js writes them into the
//           autosave and project files; the exporter and the canvas read
//           them. Only a project opened / started / restored, or a Save in
//           the Customize Elements section, changes them.
//   draft — what the section edits and previews. Save & Apply copies it to
//           `saved`; Discard copies `saved` back over it.
//
// The draft has an undo history of its own. Page history (state/history.js)
// is per page, but these styles belong to the whole project, so undoing a
// radius change must not depend on which page happens to be open. A slider
// drag is one step: every frame of it is a "transient" change that only
// updates the preview, and the drag's end commits it.

import {
  ELEMENT_TYPES,
  defaultElementStyles,
  normalizeElementStyles,
  fieldFor,
  normalizeValue
} from "./elementStyleModel.js";

const MAX_ENTRIES = 100;

const clone = v => JSON.parse(JSON.stringify(v));

let saved = defaultElementStyles();
let draft = defaultElementStyles();
const undoStack = [];
const redoStack = [];
let pendingBase = null;      // the draft before an uncommitted change
const listeners = [];

const serialize = () => JSON.stringify(draft);

function notify(info) {
  listeners.forEach(fn => fn(info));
}

/**
 * Called after every change with what happened:
 * { type, key, transient } one draft field; { all } the whole draft;
 * { committed } a draft step recorded; { saved } the draft applied;
 * { replaced } a project's styles loaded.
 */
export function onStylesChange(fn) {
  listeners.push(fn);
}

/** The project's (saved) styles. Read-only for callers. */
export function getElementStyles() {
  return saved;
}

/** The styles being edited in the Customize Elements section. Read-only. */
export function getDraftStyles() {
  return draft;
}

/** Whether the draft holds edits the project doesn't have yet. */
export function hasUnsavedDraft() {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

/** The types whose draft differs from the project's styles. */
export function unsavedTypes() {
  return ELEMENT_TYPES.filter(type => JSON.stringify(draft[type]) !== JSON.stringify(saved[type]));
}

/**
 * Sets one draft field. A transient change (a slider mid-drag) shows at once
 * but waits for commitStyles() to become an undo step.
 */
export function setField(type, key, value, { transient = false } = {}) {
  const field = fieldFor(type, key);
  if (!field) return;
  const next = normalizeValue(field, value);
  if (JSON.stringify(next) === JSON.stringify(draft[type][key])) {
    if (!transient) commitStyles();
    return;
  }
  if (pendingBase === null) pendingBase = serialize();
  draft[type][key] = next;
  notify({ type, key, transient });
  if (!transient) commitStyles();
}

/** Several fields of one type as a single step (padding on all sides). */
export function setFields(type, entries, options = {}) {
  const transient = options.transient === true;
  entries.forEach(([key, value]) => setField(type, key, value, { transient: true }));
  if (!transient) {
    // The fields went in as transient; say once that the change is final.
    notify({ all: true });
    commitStyles();
  }
}

/** Turns the draft changes made since the last step into one undo step. */
export function commitStyles() {
  if (pendingBase === null) return;
  const base = pendingBase;
  pendingBase = null;
  if (base === serialize()) return;
  undoStack.push(base);
  if (undoStack.length > MAX_ENTRIES) undoStack.shift();
  redoStack.length = 0;     // in place: step() may hold this array
  notify({ committed: true });
}

/** Puts a type (or every type) of the draft back to the defaults, as one step. */
export function resetStyles(type) {
  commitStyles();
  const defaults = defaultElementStyles();
  pendingBase = serialize();
  (type ? [type] : ELEMENT_TYPES).forEach(ty => { draft[ty] = defaults[ty]; });
  notify({ all: true });
  commitStyles();
}

/** Applies the draft to the project. */
export function saveDraft() {
  commitStyles();
  if (!hasUnsavedDraft()) return false;
  saved = clone(draft);
  notify({ saved: true });
  return true;
}

/** Drops the draft: back to the project's styles, with a fresh history. */
export function discardDraft() {
  pendingBase = null;
  draft = clone(saved);
  undoStack.length = 0;
  redoStack.length = 0;
  notify({ all: true, discarded: true });
}

/**
 * Replaces both sets, with a fresh history — a project opened, a session
 * restored, a new project started.
 */
export function replaceElementStyles(raw) {
  saved = normalizeElementStyles(raw);
  draft = clone(saved);
  undoStack.length = 0;
  redoStack.length = 0;
  pendingBase = null;
  notify({ all: true, replaced: true });
}

export const canUndoStyles = () => undoStack.length > 0 || pendingBase !== null;
export const canRedoStyles = () => redoStack.length > 0;

function step(from, to) {
  commitStyles();
  if (from.length === 0) return;
  to.push(serialize());
  draft = normalizeElementStyles(JSON.parse(from.pop()));
  notify({ all: true, history: true });
}

export function undoStyles() { step(undoStack, redoStack); }
export function redoStyles() { step(redoStack, undoStack); }
