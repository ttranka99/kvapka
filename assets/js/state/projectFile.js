// assets/js/state/projectFile.js
//
// A project file (.kvapka.json) is the whole page list as a file the user
// keeps: to reopen later, to send to a colleague, or as the only way to keep
// work on a machine that blocks site data. It is the same serialized list the
// autosave writes (state/persist.js), plus a format marker, so a file is read
// back through the same allow-list sanitizer as a stored session.
//
// A file comes from outside — an e-mail attachment, a shared drive — so it is
// untrusted input. It is parsed as JSON and nothing else, and restoreTabs()
// either accepts every page or changes nothing: a bad file can never leave
// the pages half-replaced, or be autosaved over good work.
//
// The file holds layout data only (page names, sizes, locks, the layout
// template) and a save time: no user, machine or path. It is plain,
// pretty-printed JSON, so anyone — or any scanner — can read what is in it.

import { serializeTabs, serializeBlankTabs, restoreTabs, SESSION_VERSION } from "./tabs.js";
import { t } from "../i18n/i18n.js";

const PROJECT_FORMAT = "kvapka-project";
// The same ceiling as the autosave (state/persist.js): a real project is a
// few tens of KB.
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
// So "New project" and "Open project" only ask to save first when there is
// something to lose. The pages as last saved to (or opened from) a file are
// kept as a signature in memory; before any of that this session, the
// baseline is a blank project, so an untouched first page counts as nothing
// to lose. The autosave doesn't count as saved: it lives only in this browser.

let savedSignature = null;

// The page list minus what doesn't change the work: the page counter, and the
// generated "Page N" names (they follow the language).
function signature(session) {
  return JSON.stringify(session.tabs.map(tab => ({ ...tab, name: tab.named ? tab.name : null })))
    + session.activeTabIndex;
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
 * Replaces the page list with the one in a project file and loads its active
 * page into live state (the caller refreshes the UI). On failure nothing has
 * changed, and the error is a fixed message that never quotes the file.
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
