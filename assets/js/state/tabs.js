import * as state from "./state.js";
import { initState } from "./initState.js";
import { getTheme, getDefaultThemeId } from "../theme/themeStore.js";
import { normalizeTheme } from "../theme/themeModel.js";

export const MAX_TABS = 12;

let tabs = [];            // { id, name, snapshot } — active tab's snapshot is stale by design
let activeTabIndex = 0;
let nextTabId = 1;
let nextPageNumber = 1;   // monotonic so "Page N" names don't repeat after closes

export function getTabs() { return tabs; }
export function getActiveTabIndex() { return activeTabIndex; }

const clone = v => JSON.parse(JSON.stringify(v));

export function captureSnapshot() {
  return {
    slicers: clone(state.slicers),
    kpiBands: clone(state.kpiBands),
    chartRows: clone(state.chartRows),
    warnings: clone(state.warnings),
    activeTemplate: state.activeTemplate,
    // The theme is stored by value as well as by id. A page must keep
    // rendering exactly as authored even if the custom theme it uses is later
    // renamed, edited or deleted in the theme editor — the id alone would
    // silently re-point the page at something else, or at nothing.
    theme: clone(state.activeTheme),
    maxSlicers: state.MAX_SLICERS,
    maxKpis: state.MAX_KPIS,
    slicerOrientation: state.slicerOrientation,
    slicerColumnWidth: state.SLICER_COLUMN_WIDTH,
    slicerSide: state.SLICER_SIDE,
  };
}

export function loadSnapshot(snap) {
  // applyTheme resets the column width, the per-row limits, the slicer side
  // and the slicer orientation to the theme's defaults, so the page's own
  // values have to be restored after it, not before.
  state.applyTheme(snap.theme ?? getTheme(snap.activeTemplate) ?? normalizeTheme({}));
  state.setSlicerOrientation(snap.slicerOrientation);
  state.setSlicerSide(snap.slicerSide ?? "left");
  state.setSlicerColumnWidth(snap.slicerColumnWidth);
  state.setMaxSlicers(snap.maxSlicers);
  state.setMaxKpis(snap.maxKpis);
  state.setSlicers(clone(snap.slicers));

  // Snapshots are in-memory only (they never outlive a page load), so a
  // shape older than `kpiBands` can only ever come from a half-reloaded
  // session. Falling back to whatever applyTheme() just seeded (rather than
  // an empty set of bands) is defensive coding, not a real data migration.
  if (snap.kpiBands) state.setKpiBands(clone(snap.kpiBands));

  state.setChartRows(clone(snap.chartRows));
  state.setWarnings(clone(snap.warnings));
}

/**
 * Re-points a page at a theme that has just been edited or deleted. Snapshots
 * hold themes by value (see captureSnapshot), so a saved edit only reaches
 * the pages using it when this is called for them.
 */
export function retargetTabsToTheme(themeId, theme) {
  tabs.forEach(tab => {
    if (tab.snapshot && tab.snapshot.activeTemplate === themeId) {
      tab.snapshot.theme = theme ? clone(theme) : tab.snapshot.theme;
    }
  });
}

/** Every theme id currently in use by a page, including the live one. */
export function themeIdsInUse() {
  const ids = tabs
    .map((tab, i) => (i === activeTabIndex ? state.activeTemplate : tab.snapshot?.activeTemplate))
    .filter(Boolean);
  return [...new Set(ids)];
}

// Seeds live state with fresh-page defaults (reuses initState — no duplicated defaults)
function loadDefaults() {
  // A new page starts on the *global* default theme, which the user picks in
  // the sidebar. Individual pages then override it as they like — that split
  // is the whole point of having a global default at all.
  const theme = getTheme(getDefaultThemeId());
  state.applyTheme(theme ?? normalizeTheme({}));
  initState();
}

export function initTabs() {
  tabs = [{ id: nextTabId++, name: `Page ${nextPageNumber++}`, snapshot: null }];
  activeTabIndex = 0;
  loadDefaults();               // replaces initState() in app.js start()
}

// All mutators return true when live state was swapped (caller must refreshUI)
export function switchTab(index) {
  if (index === activeTabIndex || index < 0 || index >= tabs.length) return false;
  tabs[activeTabIndex].snapshot = captureSnapshot();
  activeTabIndex = index;
  loadSnapshot(tabs[index].snapshot);
  return true;
}

export function addTab() {
  if (tabs.length >= MAX_TABS) return false;
  tabs[activeTabIndex].snapshot = captureSnapshot();
  tabs.push({ id: nextTabId++, name: `Page ${nextPageNumber++}`, snapshot: null });
  activeTabIndex = tabs.length - 1;
  loadDefaults();               // new tab is immediately active with fresh defaults
  return true;
}

export function removeTab(index) {
  if (tabs.length <= 1 || index < 0 || index >= tabs.length) return false;
  const wasActive = index === activeTabIndex;
  tabs.splice(index, 1);
  if (wasActive) {
    activeTabIndex = Math.min(index, tabs.length - 1); // right neighbor, else new last
    loadSnapshot(tabs[activeTabIndex].snapshot);
    return true;
  }
  if (index < activeTabIndex) activeTabIndex--;
  return false;
}

export function renameTab(index, name) {
  const trimmed = String(name).trim();
  if (trimmed && tabs[index]) tabs[index].name = trimmed;   // empty → keep old name
}

/**
 * Applies a theme to every page at once — the "global" half of the
 * global/per-page split. Each page keeps its own elements; only the layout
 * rules change under them, and the locked sizes those rules could invalidate
 * are reset per page exactly as a single-page theme switch does.
 */
export function applyThemeToAllTabs(theme) {
  // Every page but the active one lives in a snapshot, and the only way to
  // re-solve one is to make it live for a moment — the same swap-in/swap-out
  // the exporter does. The caller applies the theme to the active page
  // itself, since that one also has to refresh the UI around it.
  const live = captureSnapshot();

  tabs.forEach((tab, i) => {
    if (i === activeTabIndex || !tab.snapshot) return;
    loadSnapshot(tab.snapshot);
    state.applyTheme(theme);
    state.resetSizingLocks();
    state.setWarnings([]);
    tab.snapshot = captureSnapshot();
  });

  loadSnapshot(live);
}
