// assets/js/app.js
import { setSelected, initSelectionCopyButtons, initSelectionInlineEditing } from "./ui/selection.js";
import { addWarning, renderWarnings } from "./ui/warnings.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import { handleSplitChart } from "./events/stackEvents.js";
import { initExportEvents } from "./export/exportPowerBI.js";
import { initProjectMenu } from "./ui/projectMenu.js";
import { renderLayout } from "./ui/renderLayout.js";
import { initTabs } from "./state/tabs.js";
import { restoreSession, initSessionPersistence, storageAvailable, scheduleSave } from "./state/persist.js";
import { initHistory } from "./state/history.js";
import { initTabsUI, renderTabBar } from "./ui/tabs.js";
import * as state from "./state/state.js";
import { canAddSlicer, slicerLimitMessage } from "./events/slicerEvents.js";
import { handleAppendKpi } from "./events/kpiEvents.js";
import {
  initThemePicker,
  renderThemeSelector,
  syncRowLimitOptions,
  syncPlacementControls,
  defaultThemeLabel,
  openActiveThemeEditor
} from "./ui/themePicker.js";
import { initRail } from "./ui/rail.js";
import { initElementsSection } from "./elements/elementsSection.js";
import { onStylesChange } from "./elements/elementStyles.js";
import { initAbout } from "./ui/about.js";
import { initHelp, openHelp, maybeShowWelcome } from "./ui/help.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { initStackedCover } from "./ui/stackedCover.js";
import { initThumb, syncThumb } from "./ui/thumb.js";
import { initTemplatePanel, syncTemplateSummary, syncTemplateFoldForPage } from "./ui/templatePanel.js";
import { t, applyStaticText, getLocale, setLocale, onLocaleChange } from "./i18n/i18n.js";

// The static text in index.html, filled before anything reads or measures it.
applyStaticText();

const addKpiBtn = document.getElementById("add-kpi");
const addKpiBandsContainer = document.getElementById("add-kpi-bands");
const addSlicerBtn = document.getElementById("add-slicer");
const addChartSplitBtn = document.getElementById("add-chart-split");
const scopeNote = document.getElementById("theme-scope-note");
const slicersPerRowSelect = document.getElementById("slicers-per-row");
const slicersPerRowField = document.getElementById("slicers-per-row-field");
const kpisPerRowSelect = document.getElementById("kpis-per-row");

// Appends a slicer (sidebar "Slicer" button). The canvas "+" controls insert
// at an index via handleAddSlicer in events/slicerEvents.js.
function addSlicer() {
  if (!canAddSlicer()) {
    addWarning(slicerLimitMessage(), "error");
    return;
  }

  state.setSlicers([...state.slicers, { width: null, height: null, locked: false }]);
  renderLayout();
}

addKpiBtn.addEventListener("click", () => handleAppendKpi(state.kpiBandIds()[0]));
addSlicerBtn.addEventListener("click", addSlicer);

// Splits the selected top-level chart into a vertical stack of two. The
// button is shown only for an unstacked, unlocked chart (setSelected(), see
// updateSplitChartButtonVisibility in ui/selection.js), so a click can
// assume state.selectedElement is one.
addChartSplitBtn.addEventListener("click", () => {
  const match = /^chart-(\d+)-(\d+)$/.exec(state.selectedElement?.domId || "");
  if (!match) return;
  handleSplitChart(Number(match[1]), Number(match[2]));
});

// Hovering the split button tints the chart it would split
// (.split-target-highlight in style.css, the same tint as the reset/export
// buttons). Toggled on the DOM node directly, not by re-render, since
// hovering changes no state.
addChartSplitBtn.addEventListener("mouseenter", () => {
  const domId = state.selectedElement?.domId;
  const el = domId && document.getElementById(domId);
  if (el) el.classList.add("split-target-highlight");
});
addChartSplitBtn.addEventListener("mouseleave", () => {
  const domId = state.selectedElement?.domId;
  const el = domId && document.getElementById(domId);
  if (el) el.classList.remove("split-target-highlight");
});

function syncTemplateControls() {
  renderThemeSelector();
  // States both: what this page uses, and what a new page starts on.
  scopeNote.textContent =
    t("template.scopeNote", { page: state.activeTheme.label, default: defaultThemeLabel() });
  syncTemplateSummary();
}

// The placement switch lives in themePicker.js, with the other layout
// controls. This is the sidebar row that follows the layout's shape: the
// vertical column is always one column, so a per-row limit does nothing
// there. The row animates away via .collapsible.
function syncSlicerRowVisibility() {
  const vertical = state.isVerticalSlicers();
  slicersPerRowField.classList.toggle("expanded", !vertical);
  // A collapsed .collapsible is 0px tall but its contents stay in the tab
  // order. Disabling the select keeps focus off an invisible control.
  slicersPerRowSelect.disabled = vertical;
}

// One "add KPI" button per band beyond the first (the header band uses the
// static #add-kpi). Rebuilt on every sync because the band count can change
// (theme switch or section reorder). The first generated button keeps the id
// "add-kpi-band2" so the two-band case stays addressable by it.
function syncKpiBandControls() {
  const extraIds = state.kpiBandIds().slice(1);
  addKpiBandsContainer.innerHTML = "";

  extraIds.forEach((id, i) => {
    const btn = document.createElement("button");
    btn.className = "full-btn band2-btn";
    if (i === 0) btn.id = "add-kpi-band2";
    btn.textContent = extraIds.length > 1 ? t("add.kpiBand", { n: i + 2 }) : t("add.kpiBandMiddle");
    btn.addEventListener("click", () => handleAppendKpi(id));
    addKpiBandsContainer.appendChild(btn);
  });
}

function syncRowLimitControls() {
  syncRowLimitOptions();
  syncTemplateSummary();
}

function initRowLimitControls() {
  slicersPerRowSelect.addEventListener("change", () => {
    state.setMaxSlicers(slicersPerRowSelect.value);
    // Only slicer widths and chart row heights can be invalidated (the
    // slicer area's height changes chartsHeight). Chart widths are unaffected
    // since USABLE_WIDTH doesn't change, so their locks stay.
    state.resetSlicerSizingLocks();
    state.resetChartRowHeightLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });

  kpisPerRowSelect.addEventListener("change", () => {
    state.setMaxKpis(kpisPerRowSelect.value);
    // Same reasoning as above.
    state.resetKpiSizingLocks();
    state.resetChartRowHeightLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });
}

// `motion` is renderLayout's: a page or theme switch fades in ("swap"); undo /
// redo passes undefined, so the change plays as movement.
function refreshUIFromState({ motion = "swap" } = {}) {
  setSelected(null);
  // A new page opens the Šablona panel; one already worked on stays folded.
  syncTemplateFoldForPage();
  syncTemplateControls();
  syncPlacementControls();
  syncSlicerRowVisibility();
  syncKpiBandControls();
  syncRowLimitControls();
  // Another page or theme is new content, not moved content (see motion.js
  // R3), so it fades in instead of morphing card by card.
  renderLayout({ motion });
  renderWarnings();
}

// The CS / EN switch in the top bar. The language changes in place: i18n.js
// refills the static markup and each module converts its own text. This file
// re-renders the text parts of the sidebar and canvas. Unlike
// refreshUIFromState it keeps the selection and the Šablona fold, and the
// canvas relabels without motion.
const localeSwitch = document.querySelector(".lang-switch");
const localeButtons = localeSwitch.querySelectorAll("[data-locale]");

// The sliding thumb (ui/thumb.js) follows .active. It transitions only after
// landing, so a page loading in English starts on EN instead of sliding from
// CS.
function syncLocaleButtons() {
  localeButtons.forEach(button => {
    const active = button.dataset.locale === getLocale();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  syncThumb(localeSwitch);
}

function initLocaleSwitch() {
  localeButtons.forEach(button => {
    button.addEventListener("click", () => setLocale(button.dataset.locale));
  });
  syncLocaleButtons();
  initThumb(localeSwitch);

  onLocaleChange(() => {
    syncLocaleButtons();
    syncTemplateControls();
    syncKpiBandControls();
    syncRowLimitControls();
    renderTabBar();
    renderLayout({ motion: false });
    // The rebuilt canvas has no selection mark, but the selection survived
    // (ui/selection.js relabelled it). Put the mark back.
    const domId = state.selectedElement?.domId;
    if (domId) document.getElementById(domId)?.classList.add("selected");
    renderWarnings();
  });
}

function debounce(fn, waitMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function start() {
  // The pages from the last visit, or a fresh first page.
  const restored = restoreSession();
  if (!restored) initTabs();
  initSessionPersistence();
  initTabsUI({ refreshUI: refreshUIFromState });
  initThemePicker({ refreshUI: refreshUIFromState });
  initElementsSection();
  // Element styles are project data, autosaved like pages once saved (not
  // while a draft is edited). No render needed: the canvas is hidden during
  // editing and re-rendered on return (rail.js).
  onStylesChange(info => { if (info.saved || info.replaced) scheduleSave(); });
  initRail({ openEditor: openActiveThemeEditor });
  initHelp();
  initAbout();
  initLocaleSwitch();
  initRowLimitControls();
  syncTemplateControls();
  syncSlicerRowVisibility();
  syncKpiBandControls();
  syncRowLimitControls();
  renderLayout();
  // After the first render, so it can tell whether the sidebar fits.
  initTemplatePanel();
  initStackedCover();
  initResizeEvents();
  initExportEvents();
  initProjectMenu({ refreshUI: refreshUIFromState });
  initHistory({ refreshUI: () => refreshUIFromState({ motion: undefined }) });
  initSelectionCopyButtons();
  initSelectionInlineEditing();
  initShortcuts({ openHelp });
  setSelected(null);
  initCanvasRefit();
  // If site data is blocked, say so now instead of losing pages next visit.
  if (!storageAvailable()) addWarning(t("session.storageUnavailable"), "info");
  // A first visit opens with the three steps, once the page has been drawn.
  requestAnimationFrame(() => maybeShowWelcome({ restored }));
}

// Refits the canvas in the same frame the workspace changes width (window
// drag, snap, scrollbar, stacked breakpoint), not 150ms after the last
// resize event, when the old wider sheet would push the page sideways. The
// debounced resize stays for everything else (a height-only change matters
// to the desktop fit) and as the fallback without ResizeObserver.
function initCanvasRefit() {
  window.addEventListener("resize", debounce(renderLayout, 150));
  const main = document.querySelector(".main");
  if (!main || typeof ResizeObserver !== "function") return;
  const app = document.querySelector(".app");
  let lastWidth = main.clientWidth;
  let lastHeight = main.clientHeight;
  let queued = false;
  new ResizeObserver(() => {
    // Width always matters. Height matters on the desktop, where it changes
    // only with the window; in the stacked layout it changes on every render
    // (the sheet is part of it) and must not re-enter.
    // Zero means hidden behind another rail section; rail.js refits on return.
    const width = main.clientWidth;
    const height = main.clientHeight;
    const stacked = getComputedStyle(app).flexDirection === "column";
    const changed = width !== lastWidth || (!stacked && height !== lastHeight);
    if (width === 0 || !changed || queued) return;
    lastWidth = width;
    lastHeight = height;
    queued = true;
    // Same frame, so the sheet follows the easing side panel (see .sidebar)
    // instead of jumping after it.
    requestAnimationFrame(() => { queued = false; renderLayout(); });
  }).observe(main);
}

window.addEventListener("DOMContentLoaded", start);
