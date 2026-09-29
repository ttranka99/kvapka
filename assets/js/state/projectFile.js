// assets/js/state/projectFile.js
//
// A project file (.kvapka.json) is the whole page list as a file the user
// keeps: to reopen later, share, or use where site data is blocked. It is the
// autosave's serialized list (state/persist.js) plus a format marker, so it is
// read back through the same allow-list sanitizer.
//
// A file is untrusted input (e-mail, shared drive). It is only parsed as
// JSON, and restoreTabs() accepts every page or changes nothing. A bad file
// can't leave pages half-replaced or be autosaved over good work.
//
// It holds layout data only (page names, sizes, locks, the layout template,
// the element styles) and a save time: no user, machine or path. It is plain
// pretty-printed JSON, so anyone or any scanner can read it.

import { serializeTabs, serializeBlankTabs, restoreTabs, SESSION_VERSION } from "./tabs.js";
import { t } from "../i18n/i18n.js";

const PROJECT_FORMAT = "kvapka-project";
// Same limit as the autosave (state/persist.js).
export const MAX_PROJECT_BYTES = 1024 * 1024;

export function buildProjectJson() {
  return JSON.stringify({ format: PROJECT_FORMAT, savedAt: new Date().toISOString(), ...serializeTabs() }, null, 2);
}

export function projectFileName() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `kvapka-project-${timestamp}.kvapka.json`;
}

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

// --- Unsaved changes ---------------------------------------------------------
//
// "New project" and "Open project" ask to save first only when there is
// something to lose. The pages as last saved to (or opened from) a file are
// kept as an in-memory signature. Before that, the baseline is a blank
// project, so an untouched first page is nothing to lose. The autosave
// doesn't count as saved, since it lives only in this browser.

let savedSignature = null;

// The page list minus what isn't work: the page counter and generated
// "Page N" names (they follow the language). Element styles do count.
function signature(session) {
  return JSON.stringify(session.tabs.map(tab => ({ ...tab, name: tab.named ? tab.name : null })))
    + session.activeTabIndex
    + JSON.stringify(session.elementStyles);
}

/** Records the pages as they are now as saved (after a save or an open). */
export function markSaved() {
  savedSignature = signature(serializeTabs());
}

/** Forgets the saved state, so a blank project is the baseline again. */
export function forgetSaved() {
  savedSignature = null;
}

/** Whether the pages hold work that isn't in a file and would be lost. */
export function hasUnsavedChanges() {
  const current = signature(serializeTabs());
  if (savedSignature !== null && current === savedSignature) return false;
  return current !== signature(serializeBlankTabs());
}

/**
 * Replaces the page list with the project file's and loads its active page
 * into live state (the caller refreshes the UI). On failure nothing changes,
 * and the error is a fixed message that never quotes the file.
 * @returns {{ ok: boolean, error?: string }}
 */
export function openProjectText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: t("project.invalidJson") };
  }
  if (!isObject(data) || data.format !== PROJECT_FORMAT) return { ok: false, error: t("project.notProject") };
  if (Number.isInteger(data.version) && data.version > SESSION_VERSION) {
    return { ok: false, error: t("project.newerVersion") };
  }
  if (!restoreTabs(data)) return { ok: false, error: t("project.damaged") };
  markSaved();
  return { ok: true };
}
