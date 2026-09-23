import * as state from "./state.js";
import { initState } from "./initState.js";
import { getTheme, getDefaultThemeId } from "../theme/themeStore.js";
import { normalizeTheme, BUILTIN_THEMES, isVerticalPlacement } from "../theme/themeModel.js";
import { t, onLocaleChange } from "../i18n/i18n.js";

export const MAX_TABS = 12;

let tabs = [];            // { id, name, named, snapshot } — active tab's snapshot is stale by design
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
    // Orientation and side are not stored: they are the theme's placement,
    // and the theme is already here by value. A page cannot hold an
    // orientation of its own any more — picking one picks a layout.
    slicerColumnWidth: state.SLICER_COLUMN_WIDTH,
  };
}

export function loadSnapshot(snap) {
  // applyTheme resets the column width and the per-row limits to the theme's
  // defaults, so the page's own values have to be restored after it, not
  // before.
  state.applyTheme(snap.theme ?? getTheme(snap.activeTemplate) ?? normalizeTheme({}));
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

// A fresh page. Its number is kept so the generated name ("Page N") can be
// re-rendered in another language until the user names the page themselves.
function newTab() {
  const number = nextPageNumber++;
  return { id: nextTabId++, number, name: t("tabs.defaultName", { n: number }), named: false, snapshot: null };
}

// On a language switch: unnamed pages take the new language's generated name,
// and every other page's stored warnings are carried over the same way the
// live ones are (ui/warnings.js), so they read right when that page opens.
onLocaleChange(convert => {
  tabs.forEach(tab => {
    if (!tab.named) tab.name = t("tabs.defaultName", { n: tab.number });
    if (tab.snapshot) tab.snapshot.warnings = tab.snapshot.warnings.map(convert);
  });
});

// The top built-in (FULL HD / HD) whose canvas is closest to `theme`'s.
function nearestTopBuiltin(theme) {
  const distance = b => Math.abs(b.canvasWidth - theme.canvasWidth) + Math.abs(b.canvasHeight - theme.canvasHeight);
  return BUILTIN_THEMES
    .filter(b => b.placement === "horizontal")
    .reduce((best, b) => (distance(b) < distance(best) ? b : best));
}

/**
 * The layout a new page starts on, given the one it is created from. A custom
 * layout is the user's own and is kept exactly, side column and all. A
 * built-in keeps only its resolution: new pages start with slicers on top, so
 * FULL HD / HD on the left or right comes back as the top FULL HD / HD.
 *
 * A custom layout that has since been deleted is not passed on. The page it
 * lives on keeps it by value, but a new page falls back to the top built-in
 * nearest its canvas size.
 */
export function newPageTheme(base) {
  if (!base.builtin) return getTheme(base.id) ?? getTheme(nearestTopBuiltin(base).id);
  if (!isVerticalPlacement(base.placement)) return getTheme(base.id) ?? base;
  return getTheme(nearestTopBuiltin(base).id);
}

// Seeds live state with fresh-page defaults (reuses initState — no duplicated defaults)
function loadDefaults(theme) {
  // The live KPI bands still belong to the page just left, and applyTheme()
  // carries bands across a theme switch — so they are dropped first, leaving
  // it nothing to reuse but the theme's own seed counts.
  state.setKpiBands({});
  state.applyTheme(theme);
  initState();
}

export function initTabs() {
  tabs = [newTab()];
  activeTabIndex = 0;
  // The first page starts from the stored global default (FULL HD until the
  // user picks another with the "All" scope).
  loadDefaults(newPageTheme(getTheme(getDefaultThemeId()) ?? normalizeTheme({})));
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
  // A new page follows the layout of the page it was created from — the one
  // the user just picked or applied — but none of that page's elements.
  const theme = newPageTheme(state.activeTheme);
  tabs[activeTabIndex].snapshot = captureSnapshot();
  tabs.push(newTab());
  activeTabIndex = tabs.length - 1;
  loadDefaults(theme);          // new tab is immediately active with fresh defaults
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

// Returns true when the name actually changed. `named` records that the user
// gave the page a name of their own; until then the tab bar shows the
// generated "Page N" as a placeholder.
export function renameTab(index, name) {
  const trimmed = String(name).trim();
  const tab = tabs[index];
  if (!trimmed || !tab || trimmed === tab.name) return false;   // empty → keep old name
  tab.name = trimmed;
  tab.named = true;
  return true;
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
