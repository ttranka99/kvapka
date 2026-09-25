// assets/js/state/history.js
//
// Undo / redo for the page being edited. Each page keeps its own history of
// snapshots (state/tabs.js captureSnapshot), recorded after every render that
// actually changed something — renderLayout() calls noteChange(), the same
// place it asks for an autosave.
//
// History lives in memory only: it is never stored, sent or read from a file,
// so everything it restores is a snapshot this session captured itself.
//
// Entries are keyed by the page's tab object. A closed page's history goes
// with it, and a restored session or an opened project (which builds new tab
// objects) starts every page with a clean history.

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

// Notifications are about the moment they were raised, not the page, so they
// never make a step of their own and are not brought back by one.
const serialize = () => JSON.stringify({ ...captureSnapshot(), warnings: undefined });

function historyFor(tab, snapshot) {
  let h = histories.get(tab);
  if (!h) {
    h = { undo: [], redo: [], current: snapshot };
    histories.set(tab, h);
  }
  return h;
}

// Records the live page if it differs from the last recorded state. A page
// seen for the first time only takes its baseline. A page changed while it
// was in the background (a theme applied to all pages) gets that change as
// one step when it comes back.
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

// The template editor's draft belongs to the page that is live now (the same
// rule as the project menu's "Open"), and a drag owns the page until it ends.
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
  // Taken after the render, so the render's own commit finds nothing new and
  // leaves the redo stack alone.
  h.current = serialize();
  syncButtons();
}

export function undo() { step("undo", "redo"); }
export function redo() { step("redo", "undo"); }

function syncButtons() {
  const h = histories.get(activeTab());
  if (undoBtn) undoBtn.disabled = !h || h.undo.length === 0;
  if (redoBtn) redoBtn.disabled = !h || h.redo.length === 0;
}

/** A pointer is down (a drag in progress): shortcuts leave the page alone. */
export function isGestureActive() {
  return gestureActive;
}

function onKeydown(e) {
  if (e.defaultPrevented || e.isComposing) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  // AltGr is Ctrl+Alt on Windows; on Czech and other European layouts it
  // types characters, and must never undo.
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
