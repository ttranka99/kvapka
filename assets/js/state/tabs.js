import * as state from "./state.js";
import { initState } from "./initState.js";

export const MAX_TABS = 12;

let tabs = [];            // { id, name, snapshot } — active tab's snapshot is stale by design
let activeTabIndex = 0;
let nextTabId = 1;
let nextPageNumber = 1;   // monotonic so "Page N" names don't repeat after closes

export function getTabs() { return tabs; }
export function getActiveTabIndex() { return activeTabIndex; }

const clone = v => JSON.parse(JSON.stringify(v));

function captureSnapshot() {
  return {
    slicers: clone(state.slicers),
    kpis: clone(state.kpis),
    chartRows: clone(state.chartRows),
    warnings: clone(state.warnings),
    activeTemplate: state.activeTemplate,
    maxSlicers: state.MAX_SLICERS,
    maxKpis: state.MAX_KPIS,
  };
}

function loadSnapshot(snap) {
  state.setLayoutTemplate(snap.activeTemplate);
  state.setMaxSlicers(snap.maxSlicers);
  state.setMaxKpis(snap.maxKpis);
  state.setSlicers(clone(snap.slicers));
  state.setKpis(clone(snap.kpis));
  state.setChartRows(clone(snap.chartRows));
  state.setWarnings(clone(snap.warnings));
}

// Seeds live state with fresh-page defaults (reuses initState — no duplicated defaults)
function loadDefaults() {
  state.setLayoutTemplate("FULL_HD");
  state.setMaxSlicers(7);
  state.setMaxKpis(6);
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
