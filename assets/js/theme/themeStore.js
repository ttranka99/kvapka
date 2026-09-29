// assets/js/theme/themeStore.js
//
// Where custom themes live between sessions. They go in localStorage: the app
// is a static site with no backend, and a theme is a few hundred bytes of
// JSON for one person on one machine. Sharing is deliberate, through the
// export/import pair below (a .json file in the same shape as stored here).
//
// Everything read back goes through normalizeTheme() first. A hand-edited
// file, an older build's theme or a corrupted entry can't reach the layout
// solvers in an unexpected shape.

import {
  normalizeTheme,
  cloneTheme,
  BUILTIN_THEMES,
  getBuiltinTheme,
  THEME_SCHEMA,
  PLACEMENTS
} from "./themeModel.js";
import { t } from "../i18n/i18n.js";

const STORAGE_KEY = "kvapka-themes-v1";
const DEFAULT_KEY = "kvapka-default-theme-v1";

// localStorage can throw (Safari private mode, blocked site data, file://
// origin in some builds). That must not take the app down; the themes just
// don't persist for that session.
function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

let cache = null;

function customThemes() {
  if (cache === null) {
    cache = readRaw()
      .map(t => normalizeTheme(t))
      .map(t => ({ ...t, builtin: false }));
  }
  return cache;
}

function persist() {
  return writeRaw(customThemes());
}

/** Built-ins first, then custom themes in the order they were saved. */
export function getAllThemes() {
  return [...BUILTIN_THEMES.map(cloneTheme), ...customThemes().map(cloneTheme)];
}

/** Every layout of one placement: the sidebar's chip list, since the
 *  placement switch above it decides which shape is shown. */
export function themesForPlacement(placement) {
  return getAllThemes().filter(t => t.placement === placement);
}

/**
 * The placements that have at least one layout, in PLACEMENTS order. The
 * sidebar disables the rest. Layouts of different placements aren't linked,
 * so "switch to vertical" only means "show the vertical layouts", which is
 * pointless when none exist. Nothing is created implicitly.
 */
export function availablePlacements() {
  const present = new Set(getAllThemes().map(t => t.placement));
  return PLACEMENTS.filter(p => present.has(p));
}

export function getTheme(id) {
  const builtin = getBuiltinTheme(id);
  if (builtin) return cloneTheme(builtin);
  const found = customThemes().find(t => t.id === id);
  return found ? cloneTheme(found) : null;
}

export function themeExists(id) {
  return getTheme(id) !== null;
}

// Ids come from the label so an exported file is recognisable, with a numeric
// suffix on a collision ("Dashboard", "Dashboard 2"). `reserved` holds ids
// taken although no stored theme has them: a deleted theme still used by a
// page must not hand its id to a new one, or saving would retarget that page.
export function makeThemeId(label, reserved = []) {
  const slug = String(label)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip Czech diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "THEME";

  let id = `CUSTOM_${slug}`;
  let n = 2;
  while (themeExists(id) || reserved.includes(id)) id = `CUSTOM_${slug}_${n++}`;
  return id;
}

/**
 * Inserts or replaces a custom theme. Built-in ids are protected: overwriting
 * FULL_HD or HD would remove the known-good baseline, so the caller should
 * offer "save as new" instead.
 * @returns {{ ok: boolean, theme?: object, error?: string }}
 */
export function saveTheme(theme) {
  const normalized = { ...normalizeTheme(theme), builtin: false };

  if (getBuiltinTheme(normalized.id)) {
    return { ok: false, error: t("themeStore.builtinOverwrite") };
  }

  const list = customThemes();
  const index = list.findIndex(t => t.id === normalized.id);
  if (index >= 0) list[index] = normalized;
  else list.push(normalized);

  if (!persist()) {
    // Roll the in-memory list back so the UI matches what survives a reload.
    // A theme that silently vanishes on refresh is worse than a visible save
    // failure.
    cache = null;
    return { ok: false, error: t("themeStore.saveFailed") };
  }

  return { ok: true, theme: cloneTheme(normalized) };
}

export function deleteTheme(id) {
  if (getBuiltinTheme(id)) return { ok: false, error: t("themeStore.builtinDelete") };

  const list = customThemes();
  const index = list.findIndex(t => t.id === id);
  if (index < 0) return { ok: false, error: t("themeStore.notFound") };

  list.splice(index, 1);
  if (!persist()) {
    cache = null;
    return { ok: false, error: t("themeStore.changeFailed") };
  }
  return { ok: true };
}

// --- The global default -----------------------------------------------
//
// The theme a new page starts on. This is the global rule; a page's own
// themeId overrides it (see the scope switch in ui/themePicker.js).

export function getDefaultThemeId() {
  try {
    const id = localStorage.getItem(DEFAULT_KEY);
    if (id && themeExists(id)) return id;
  } catch {
    /* fall through to the built-in default */
  }
  return "FULL_HD";
}

export function setDefaultThemeId(id) {
  if (!themeExists(id)) return false;
  try {
    localStorage.setItem(DEFAULT_KEY, id);
    return true;
  } catch {
    return false;
  }
}

// --- File interchange --------------------------------------------------

/** One theme as pretty JSON, in the shape parseThemeFile reads. */
export function exportThemeJson(theme) {
  return JSON.stringify({ ...cloneTheme(theme), schema: THEME_SCHEMA, builtin: false }, null, 2);
}

/**
 * Parses an exported file back into themes. Accepts one theme object, a bare
 * array, or the `{ schema, themes: [...] }` collection wrapper.
 * @returns {{ ok: boolean, themes?: object[], error?: string }}
 */
export function parseThemeFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: t("themeStore.invalidJson") };
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.themes)
      ? parsed.themes
      : [parsed];

  const themes = raw
    .filter(t => t && typeof t === "object")
    .map(t => normalizeTheme(t));

  if (!themes.length) return { ok: false, error: t("themeStore.noThemes") };
  return { ok: true, themes };
}

/**
 * Imports parsed themes. A theme whose id already exists gets a fresh one, so
 * an import never overwrites a theme in use.
 * `reserved` is passed on to makeThemeId().
 * @returns {{ ok: boolean, imported: object[], error?: string }}
 */
export function importThemes(themes, reserved = []) {
  const imported = [];

  for (const theme of themes) {
    const candidate = { ...theme, builtin: false };
    if (themeExists(candidate.id) || reserved.includes(candidate.id)) {
      candidate.id = makeThemeId(candidate.label, reserved);
    }
    const result = saveTheme(candidate);
    if (!result.ok) return { ok: false, imported, error: result.error };
    imported.push(result.theme);
  }

  return { ok: true, imported };
}

export function downloadJson(filename, json) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
