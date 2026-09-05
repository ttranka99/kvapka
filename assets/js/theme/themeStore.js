// assets/js/theme/themeStore.js
//
// Where custom themes live between sessions. localStorage is the right home
// for them: the app is a static site with no backend, and a theme is a few
// hundred bytes of JSON that belongs to one person on one machine. Sharing
// a theme with someone else is a deliberate act, and that is what the
// export/import pair below is for — a downloadable .json file, the same
// shape as what is stored here.
//
// Everything read back out goes through normalizeTheme() first, so a hand-
// edited file, a theme saved by an older build, or a corrupted entry can
// never reach the layout solvers in a shape they do not expect.

import { normalizeTheme, cloneTheme, BUILTIN_THEMES, getBuiltinTheme, THEME_SCHEMA } from "./themeModel.js";

const STORAGE_KEY = "kb-layout-themes-v1";
const DEFAULT_KEY = "kb-layout-default-theme-v1";

// localStorage throws outright in a few real situations (Safari private
// mode, a browser set to block site data, and the file:// origin in some
// builds). None of them should take the app down — the themes simply do not
// persist for that session.
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

export function getTheme(id) {
  const builtin = getBuiltinTheme(id);
  if (builtin) return cloneTheme(builtin);
  const found = customThemes().find(t => t.id === id);
  return found ? cloneTheme(found) : null;
}

export function themeExists(id) {
  return getTheme(id) !== null;
}

// Ids are generated from the label so an exported file is recognisable, with
// a numeric suffix when that collides — a user may well want "Dashboard" and
// "Dashboard 2" side by side.
export function makeThemeId(label) {
  const slug = String(label)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip Czech diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "THEME";

  let id = `CUSTOM_${slug}`;
  let n = 2;
  while (themeExists(id)) id = `CUSTOM_${slug}_${n++}`;
  return id;
}

/**
 * Inserts or replaces a custom theme. Built-in ids are protected: saving over
 * FULL_HD or HD would leave the user no way back to a known-good baseline, so
 * the caller is expected to have offered "save as new" instead.
 * @returns {{ ok: boolean, theme?: object, error?: string }}
 */
export function saveTheme(theme) {
  const normalized = { ...normalizeTheme(theme), builtin: false };

  if (getBuiltinTheme(normalized.id)) {
    return { ok: false, error: "Vestavěnou šablonu nelze přepsat — uložte ji jako novou." };
  }

  const list = customThemes();
  const index = list.findIndex(t => t.id === normalized.id);
  if (index >= 0) list[index] = normalized;
  else list.push(normalized);

  if (!persist()) {
    // Roll the in-memory list back so what the UI shows matches what survives
    // a reload — a theme that silently vanishes on refresh is worse than one
    // that visibly failed to save.
    cache = null;
    return { ok: false, error: "Šablonu se nepodařilo uložit do prohlížeče (úložiště je nedostupné nebo plné)." };
  }

  return { ok: true, theme: cloneTheme(normalized) };
}

export function deleteTheme(id) {
  if (getBuiltinTheme(id)) return { ok: false, error: "Vestavěnou šablonu nelze smazat." };

  const list = customThemes();
  const index = list.findIndex(t => t.id === id);
  if (index < 0) return { ok: false, error: "Šablona neexistuje." };

  list.splice(index, 1);
  if (!persist()) {
    cache = null;
    return { ok: false, error: "Změnu se nepodařilo uložit." };
  }
  return { ok: true };
}

// --- The global default -----------------------------------------------
//
// The theme a brand-new page starts on. Pages may each override it (see the
// scope switch in ui/themePicker.js), which is exactly the global-vs-per-page
// split: this value is the global rule, a page's own themeId is the override.

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

/** One theme as pretty JSON — the shape parseThemeFile reads back. */
export function exportThemeJson(theme) {
  return JSON.stringify({ ...cloneTheme(theme), schema: THEME_SCHEMA, builtin: false }, null, 2);
}

/**
 * Parses an exported file back into themes. Accepts three shapes so a user
 * can hand back whatever they were given: one theme object, a bare array, or
 * the `{ schema, themes: [...] }` collection wrapper.
 * @returns {{ ok: boolean, themes?: object[], error?: string }}
 */
export function parseThemeFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Soubor není platný JSON." };
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.themes)
      ? parsed.themes
      : [parsed];

  const themes = raw
    .filter(t => t && typeof t === "object")
    .map(t => normalizeTheme(t));

  if (!themes.length) return { ok: false, error: "Soubor neobsahuje žádnou šablonu." };
  return { ok: true, themes };
}

/**
 * Imports parsed themes, giving each a fresh id when its own already exists,
 * so an import never silently overwrites a theme the user still relies on.
 * @returns {{ ok: boolean, imported: object[], error?: string }}
 */
export function importThemes(themes) {
  const imported = [];

  for (const theme of themes) {
    const candidate = { ...theme, builtin: false };
    if (themeExists(candidate.id)) {
      candidate.id = makeThemeId(candidate.label);
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
