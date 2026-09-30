import * as state from "./state.js";
import { initState } from "./initState.js";
import { getTheme, getDefaultThemeId, makeThemeId } from "../theme/themeStore.js";
import {
  normalizeTheme,
  cloneTheme,
  getBuiltinTheme,
  BUILTIN_THEMES,
  isVerticalPlacement
} from "../theme/themeModel.js";
import { t, onLocaleChange } from "../i18n/i18n.js";
import { getElementStyles, replaceElementStyles } from "../elements/elementStyles.js";
import { defaultElementStyles, normalizeElementStyles } from "../elements/elementStyleModel.js";

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
    // The theme is stored by value as well as by id, so a page keeps
    // rendering as authored if its custom theme is later renamed, edited or
    // deleted. The id alone would re-point the page at something else.
    theme: clone(state.activeTheme),
    maxSlicers: state.MAX_SLICERS,
    maxKpis: state.MAX_KPIS,
    // Orientation and side are not stored: they come from the theme's
    // placement, and the theme is stored above.
    slicerColumnWidth: state.SLICER_COLUMN_WIDTH,
    slicerRowHeight: state.SLICER_ROW_HEIGHT,
    kpiBandHeights: clone(state.kpiBandHeights),
  };
}

export function loadSnapshot(snap) {
  // applyTheme resets the column width, band height and per-row limits to the
  // theme's defaults, so restore the page's own values after it.
  state.applyTheme(snap.theme ?? getTheme(snap.activeTemplate) ?? normalizeTheme({}));
  state.setSlicerColumnWidth(snap.slicerColumnWidth);
  state.setSlicerRowHeight(snap.slicerRowHeight);
  state.setMaxSlicers(snap.maxSlicers);
  state.setMaxKpis(snap.maxKpis);
  state.setSlicers(clone(snap.slicers));

  // Stored snapshots go through sanitizeSnapshot(), which always rebuilds
  // `kpiBands`. A snapshot without them can only be an old in-memory one, so
  // keeping what applyTheme() seeded is just defensive.
  if (snap.kpiBands) state.setKpiBands(clone(snap.kpiBands));
  state.setKpiBandHeights(snap.kpiBandHeights);

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

// A fresh page. Its number is kept so the generated "Page N" name can follow
// a language switch until the user names the page.
function newTab() {
  const number = nextPageNumber++;
  return { id: nextTabId++, number, name: t("tabs.defaultName", { n: number }), named: false, snapshot: null };
}

// On a language switch: unnamed pages get the new language's generated name,
// and stored warnings are converted like the live ones (ui/warnings.js).
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
 * layout is kept exactly, side column and all. A built-in keeps only its
 * resolution: new pages start with slicers on top, so FULL HD / HD with a
 * side column becomes the top FULL HD / HD.
 *
 * A deleted custom layout is not passed on. Its page keeps it by value, but
 * a new page falls back to the top built-in nearest its canvas size.
 */
export function newPageTheme(base) {
  if (!base.builtin) return getTheme(base.id) ?? getTheme(nearestTopBuiltin(base).id);
  if (!isVerticalPlacement(base.placement)) return getTheme(base.id) ?? base;
  return getTheme(nearestTopBuiltin(base).id);
}

// Seeds live state with fresh-page defaults (reuses initState)
function loadDefaults(theme) {
  // The live KPI bands belong to the page just left, and applyTheme() carries
  // bands across a switch. Drop them first so only the theme's seed counts
  // remain.
  state.setKpiBands({});
  state.applyTheme(theme);
  initState();
}

export function initTabs() {
  resetTabs();
}

/**
 * Replaces every page with one fresh "Page 1", as on a first visit (the
 * Project menu's "New project"). The caller refreshes the UI. Undo history
 * goes with the old pages (state/history.js keys it by tab object).
 */
export function resetTabs() {
  nextTabId = 1;
  nextPageNumber = 1;
  tabs = [newTab()];
  activeTabIndex = 0;
  // The first page uses the stored global default (FULL HD until the user
  // picks another with the "All" scope).
  loadDefaults(newPageTheme(getTheme(getDefaultThemeId()) ?? normalizeTheme({})));
}

/**
 * What serializeTabs() would return for a new project, without touching the
 * pages. A fresh page is made live briefly and the real ones are put back,
 * as applyThemeToAllTabs() does.
 */
export function serializeBlankTabs() {
  const saved = { tabs, activeTabIndex, nextTabId, nextPageNumber, live: captureSnapshot() };
  resetTabs();
  // A new project also has the default element styles. The live ones are
  // untouched.
  const blank = { ...serializeTabs(), elementStyles: defaultElementStyles() };
  ({ tabs, activeTabIndex, nextTabId, nextPageNumber } = saved);
  loadSnapshot(saved.live);
  return blank;
}

// --- Session persistence -------------------------------------------------

// Shared by the autosave (state/persist.js) and project files
// (state/projectFile.js): both are this same serialized page list.
export const SESSION_VERSION = 1;
// Generous limits no real layout reaches. Anything past them wasn't written
// by this app.
const MAX_ITEMS = 100;
const MAX_NAME_LENGTH = 40;   // the rename input's own maxLength (ui/tabs.js)
const MAX_PAGE_NUMBER = 100000;
const MAX_SIZE = 10000;       // px; past the largest canvas a theme allows (7680)
// The shape makeThemeId() produces, with room for hand-written ids.
const THEME_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// The whole page list as plain JSON, for state/persist.js. The active page's
// stored snapshot is stale by design, so it is captured fresh here. Element
// styles (Customize Elements) belong to the project, not a page, so they sit
// beside the pages. They are optional on read (a file saved before they
// existed opens with defaults), so the version stays the same.
export function serializeTabs() {
  return {
    version: SESSION_VERSION,
    activeTabIndex,
    nextPageNumber,
    tabs: tabs.map((tab, i) => ({
      number: tab.number,
      name: tab.name,
      named: tab.named,
      // Warnings are dropped on read (sanitizeSnapshot) and may quote a file
      // name. A saved project holds layout data only.
      snapshot: { ...(i === activeTabIndex ? captureSnapshot() : tab.snapshot), warnings: [] }
    })),
    elementStyles: JSON.parse(JSON.stringify(getElementStyles()))
  };
}

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const size = v => (Number.isFinite(v) && v >= 0 && v <= MAX_SIZE ? v : null);
const list = (v, map) => {
  if (!Array.isArray(v) || v.length > MAX_ITEMS) throw new Error("bad list");
  return v.map(map);
};
// Slicers have both sizes, KPI cards only a height, so a size is kept only
// where the stored element had one.
const sized = v => {
  if (!isObject(v)) throw new Error("bad element");
  const out = {};
  if ("width" in v) out.width = size(v.width);
  if ("height" in v) out.height = size(v.height);
  out.locked = v.locked === true;
  return out;
};

function sanitizeChartItem(v) {
  const item = {};
  if (size(v?.width) !== null) item.width = v.width;
  if (typeof v?.locked === "boolean") item.locked = v.locked;
  // A stack has two charts or more (stackEvents.js unstacks one that drops
  // to a single chart), so a shorter one is read as no stack.
  if (v?.stack !== undefined) {
    const stack = list(v.stack, s => ({ height: size(s?.height), locked: s?.locked === true }));
    if (stack.length >= 2) item.stack = stack;
  }
  return item;
}

// normalizeTheme() clamps every value but trusts the id and built-in flag.
// A built-in is read-only (the editor forks it), so a theme under a built-in
// id is replaced by the canonical copy. A file can't pass altered values off
// as FULL HD. Every other theme is custom, with an id shaped like the ones
// the app generates.
function sanitizeTheme(raw) {
  const theme = normalizeTheme(raw);
  const builtin = getBuiltinTheme(theme.id);
  if (builtin) return cloneTheme(builtin);
  theme.builtin = false;
  if (!THEME_ID_PATTERN.test(theme.id)) theme.id = makeThemeId(theme.label);
  return theme;
}

// Stored data is untrusted (anything with access to the browser's storage can
// rewrite it), so a snapshot is rebuilt field by field from an allow-list.
// Throws on a shape it can't use.
function sanitizeSnapshot(snap) {
  if (!isObject(snap)) throw new Error("bad snapshot");
  const theme = sanitizeTheme(snap.theme);
  const kpiBands = {};
  const bands = isObject(snap.kpiBands) ? snap.kpiBands : {};
  // Only the bands this theme defines. Any other key (e.g. "__proto__") is
  // dropped.
  theme.sections
    .filter(s => s.type === "kpi")
    .forEach(s => {
      if (Object.prototype.hasOwnProperty.call(bands, s.id)) kpiBands[s.id] = list(bands[s.id], sized);
    });

  // One height per band. Files from before it existed may still have
  // per-card heights (the row took the tallest), so that becomes the band's.
  const kpiBandHeights = {};
  const storedHeights = isObject(snap.kpiBandHeights) ? snap.kpiBandHeights : {};
  Object.keys(kpiBands).forEach(id => {
    const stored = Object.prototype.hasOwnProperty.call(storedHeights, id) ? size(storedHeights[id]) : null;
    const legacy = kpiBands[id].map(k => k.height).filter(h => h !== null && h !== undefined);
    const height = stored ?? (legacy.length ? Math.max(...legacy) : null);
    if (height !== null) kpiBandHeights[id] = height;
  });

  return {
    slicers: list(snap.slicers, sized),
    kpiBands,
    kpiBandHeights,
    chartRows: list(snap.chartRows, row => ({
      height: size(row?.height),
      locked: row?.locked === true,
      items: list(row?.items, sanitizeChartItem)
    })).filter(row => row.items.length > 0),
    // Warnings belong to the moment they were raised, not the page.
    warnings: [],
    activeTemplate: theme.id,
    theme,
    maxSlicers: snap.maxSlicers,
    maxKpis: snap.maxKpis,
    slicerColumnWidth: size(snap.slicerColumnWidth) ?? theme.slicerColumnWidth,
    // Missing in files saved before the band height could change.
    slicerRowHeight: size(snap.slicerRowHeight) ?? theme.slicerHeight
  };
}

/**
 * Replaces the page list with a serialized one and loads its active page into
 * live state. Returns false, changing nothing, if this app couldn't have
 * written the data.
 */
export function restoreTabs(data) {
  try {
    if (!isObject(data) || data.version !== SESSION_VERSION) return false;
    if (!Array.isArray(data.tabs) || data.tabs.length === 0 || data.tabs.length > MAX_TABS) return false;
    const active = data.activeTabIndex;
    if (!Number.isInteger(active) || active < 0 || active >= data.tabs.length) return false;

    const restored = data.tabs.map((tab, i) => {
      const n = tab?.number;
      if (!isObject(tab) || !Number.isInteger(n) || n < 1 || n > MAX_PAGE_NUMBER) throw new Error("bad tab");
      const named = tab.named === true && typeof tab.name === "string" && tab.name.trim() !== "";
      return {
        id: i + 1,
        number: tab.number,
        // An unnamed page's name is generated, so it uses the current
        // language, not the saved one.
        name: named ? tab.name.trim().slice(0, MAX_NAME_LENGTH) : t("tabs.defaultName", { n: tab.number }),
        named,
        snapshot: sanitizeSnapshot(tab.snapshot)
      };
    });

    // Ids only matter within this session, so they are renumbered. The page
    // counter must stay past every number in use so "Page N" names don't
    // repeat.
    const highestNumber = Math.max(...restored.map(tab => tab.number));
    const pageNumber = Number.isInteger(data.nextPageNumber) && data.nextPageNumber <= MAX_PAGE_NUMBER + 1
      ? data.nextPageNumber
      : 0;

    // Rebuilt from an allow-list like snapshots; never throws.
    const elementStyles = normalizeElementStyles(data.elementStyles);

    loadSnapshot(restored[active].snapshot);
    replaceElementStyles(elementStyles);
    tabs = restored;
    activeTabIndex = active;
    nextTabId = restored.length + 1;
    nextPageNumber = Math.max(pageNumber, highestNumber + 1);
    return true;
  } catch {
    return false;
  }
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
  // A new page uses the layout of the page it was created from, but none of
  // its elements.
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

// Returns true when the name changed. `named` records that the user chose the
// name; until then the tab shows the generated "Page N".
export function renameTab(index, name) {
  const trimmed = String(name).trim();
  const tab = tabs[index];
  if (!trimmed || !tab || trimmed === tab.name) return false;   // empty → keep old name
  tab.name = trimmed;
  tab.named = true;
  return true;
}

/**
 * Applies a theme to every page at once (the "global" half of the
 * global/per-page split). Each page keeps its elements; only the layout
 * rules change, and locked sizes they could invalidate are reset per page,
 * as in a single-page theme switch.
 */
export function applyThemeToAllTabs(theme) {
  // Pages other than the active one live in snapshots, and re-solving one
  // means making it live briefly, as the exporter does. The caller applies
  // the theme to the active page, since that one also refreshes the UI.
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
