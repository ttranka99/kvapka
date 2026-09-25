// assets/js/state/persist.js
//
// Keeps the report's pages between visits, so a refresh, a closed tab or a
// crash doesn't throw a design away. The whole page list is written to
// localStorage shortly after every change (ui/renderLayout.js and ui/tabs.js
// call scheduleSave) and read back once at start.
//
// Nothing here leaves the device: no request, no cookie, no telemetry — the
// data stays in this browser, under this site's origin.
//
// localStorage can be unavailable on locked-down machines (a policy blocking
// site data, private windows, some file:// setups). Every access is guarded,
// so the app keeps working without autosave, and storageAvailable() lets the
// caller tell the user their work won't be kept.
//
// Two open copies of the app share one session; the last one to save wins.

import { serializeTabs, restoreTabs } from "./tabs.js";

const STORAGE_KEY = "kvapka-session-v1";
const PROBE_KEY = "kvapka-probe";
const SAVE_DELAY_MS = 300;
// A real session is a few tens of KB; anything far past that is not one this
// app wrote and isn't worth parsing.
const MAX_STORED_LENGTH = 1024 * 1024;

let timer = null;

function writeSession() {
  clearTimeout(timer);
  timer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeTabs()));
  } catch {
    // Blocked or full storage: the session just isn't kept this time.
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage can't be reached.
  }
}

/**
 * Loads the stored pages into state/tabs.js. Returns false (and discards the
 * stored copy) when there is nothing usable, so the caller starts fresh.
 */
export function restoreSession() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  let data = null;
  try {
    if (raw.length <= MAX_STORED_LENGTH) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (data !== null && restoreTabs(data)) return true;

  clearSession();
  return false;
}

/** Saves the pages once changes settle. Called after every render. */
export function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(writeSession, SAVE_DELAY_MS);
}

/** Whether this browser will actually keep anything between visits. */
export function storageAvailable() {
  try {
    localStorage.setItem(PROBE_KEY, "1");
    const ok = localStorage.getItem(PROBE_KEY) === "1";
    localStorage.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}

// A save still waiting on its delay is written straight away when the page
// is hidden or closed, so the last edit before leaving isn't lost.
export function initSessionPersistence() {
  const flush = () => { if (timer !== null) writeSession(); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
