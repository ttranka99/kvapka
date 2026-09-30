// assets/js/state/history.js
//
// Undo / redo for the page being edited. Each page keeps its own snapshots
// (state/tabs.js captureSnapshot), recorded after every render that changed
// something: renderLayout() calls noteChange() where it asks for an autosave.
//
// Memory only: never stored, sent or read from a file, so everything it
// restores was captured by this session.
//
// Keyed by the page's tab object. Closing a page drops its history. A
// restored session or opened project builds new tab objects, so every page
// starts clean.

import { captureSnapshot, loadSnapshot, getTabs, getActiveTabIndex } from "./tabs.js";
import { isTextField, letterOf } from "../ui/keys.js";

// Per page. A snapshot is a few KB, and there are at most MAX_TABS pages.
const MAX_ENTRIES = 100;

const histories = new WeakMap();   // tab → { undo: string[], redo: string[], current: string }

let commitQueued = false;
let gestureActive = false;         // a pointer is down: a drag is one step, not one per frame
let refreshUI = () => {};
let undoBtn = null;
let redoBtn = null;

const activeTab = () => getTabs()[getActiveTabIndex()];

// While a section with its own history is on screen (Customize Elements:
// project-wide styles, not page state), undo / redo act on that instead.
// See setHistoryDelegate().
let delegate = null;
const delegated = () => delegate !== null && delegate.active();

// Warnings belong to the moment they were raised, not the page. They never
// make a step and undo doesn't bring them back.
const serialize = () => JSON.stringify({ ...captureSnapshot(), warnings: undefined });

function historyFor(tab, snapshot) {
  let h = histories.get(tab);
  if (!h) {
    h = { undo: [], redo: [], current: snapshot };
    histories.set(tab, h);
  }
  return h;
}

// Records the live page if it differs from the last recorded state. A new
// page only sets its baseline. A page changed in the background (a theme
// applied to all pages) records that as one step when it comes back.
function commit() {
  commitQueued = false;
  if (gestureActive) return;   // the gesture's end commits
  const tab = activeTab();
  if (!tab) return;
  const snapshot = serialize();
  const h = historyFor(tab, snapshot);
  if (snapshot !== h.current) {
    h.undo.push(h.current);
    if (h.undo.length > MAX_ENTRIES) h.undo.shift();
    h.redo = [];
    h.current = snapshot;
  }
  syncButtons();
}

/** Called after every render. Renders from one action become one step. */
export function noteChange() {
  if (commitQueued) return;
  commitQueued = true;
  queueMicrotask(commit);
}

// The template editor's draft belongs to the live page (same rule as the
// project menu's "Open"), and a drag owns the page until it ends.
const blocked = () => gestureActive || document.body.classList.contains("theme-editor-open");

function step(from, to) {
  const tab = activeTab();
  const h = tab && histories.get(tab);
  if (!h || h[from].length === 0 || blocked()) return;

  h[to].push(h.current);
  const snap = JSON.parse(h[from].pop());
  snap.warnings = [];
  loadSnapshot(snap);
  refreshUI();
  // Taken after the render, so its own commit finds nothing new and keeps the
  // redo stack.
  h.current = serialize();
  syncButtons();
}

export function undo() {
  if (delegated()) {
    if (!gestureActive) delegate.undo();
    syncButtons();
    return;
  }
  step("undo", "redo");
}

export function redo() {
  if (delegated()) {
    if (!gestureActive) delegate.redo();
    syncButtons();
    return;
  }
  step("redo", "undo");
}

function syncButtons() {
  if (delegated()) {
    if (undoBtn) undoBtn.disabled = !delegate.canUndo();
    if (redoBtn) redoBtn.disabled = !delegate.canRedo();
    return;
  }
  const h = histories.get(activeTab());
  if (undoBtn) undoBtn.disabled = !h || h.undo.length === 0;
  if (redoBtn) redoBtn.disabled = !h || h.redo.length === 0;
}

/**
 * Hands the undo / redo buttons and keys to another history while
 * `active()` says so: { active, undo, redo, canUndo, canRedo }.
 */
export function setHistoryDelegate(d) {
  delegate = d;
  syncButtons();
}

/** Re-reads which history the buttons stand for (after a section switch). */
export function syncHistoryButtons() {
  syncButtons();
}

/** A pointer is down (a drag in progress): shortcuts leave the page alone. */
export function isGestureActive() {
  return gestureActive;
}

function onKeydown(e) {
  if (e.defaultPrevented || e.isComposing) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  // AltGr is Ctrl+Alt on Windows and types characters on Czech and other
  // European layouts. It must never undo.
  if (e.altKey) return;
  // Text fields keep their own native undo.
  if (isTextField(e.target) || isTextField(document.activeElement)) return;

  const letter = letterOf(e);
  let action = null;
  if (letter === "z") action = e.shiftKey ? redo : undo;
  else if (letter === "y" && !e.shiftKey) action = redo;
  if (!action) return;

  e.preventDefault();
  action();
}

export function initHistory(options) {
  refreshUI = options.refreshUI;
  undoBtn = document.getElementById("undo-btn");
  redoBtn = document.getElementById("redo-btn");
  undoBtn?.addEventListener("click", undo);
  redoBtn?.addEventListener("click", redo);

  // Capture phase, so a drag handler stopping propagation can't hide the
  // gesture's start or end from here.
  window.addEventListener("pointerdown", () => { gestureActive = true; }, true);
  const endGesture = () => {
    if (!gestureActive) return;
    gestureActive = false;
    noteChange();
  };
  window.addEventListener("pointerup", endGesture, true);
  window.addEventListener("pointercancel", endGesture, true);
  // A pointerup lost to another window must not leave history paused.
  window.addEventListener("blur", endGesture);

  document.addEventListener("keydown", onKeydown);

  // The page as it is now is the baseline of its history.
  commit();
}
