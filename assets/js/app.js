// assets/js/app.js
import { setSelected, initSelectionCopyButtons, initSelectionInlineEditing } from "./ui/selection.js";
import { addWarning, renderWarnings } from "./ui/warnings.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import { handleSplitChart } from "./events/stackEvents.js";
import { initExportEvents } from "./export/exportPowerBI.js";
import { renderLayout } from "./ui/renderLayout.js";
import { initTabs } from "./state/tabs.js";
import { restoreSession, initSessionPersistence, storageAvailable } from "./state/persist.js";
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
import { initStackedCover } from "./ui/stackedCover.js";
import { initTemplatePanel, syncTemplateSummary, syncTemplateFoldForPage } from "./ui/templatePanel.js";
import { t, applyStaticText, getLocale, setLocale, onLocaleChange } from "./i18n/i18n.js";

// The static text in index.html, filled before anything reads or measures it.
applyStaticText();

const addKpiBtn = document.getElementById("add-kpi");
const addKpiBandsContainer = document.getElementById("add-kpi-bands");
const addSlicerBtn = document.getElementById("add-slicer");
const addChartSplitBtn = document.getElementById("add-chart-split");
const canvasSizeLabel = document.getElementById("canvas-size-label");
const scopeNote = document.getElementById("theme-scope-note");
const slicersPerRowSelect = document.getElementById("slicers-per-row");
const slicersPerRowField = document.getElementById("slicers-per-row-field");
const kpisPerRowSelect = document.getElementById("kpis-per-row");

// Appends a new slicer at the end of the list (used by the sidebar "Slicer" button).
// Per-item insertion at an arbitrary index is handled separately by handleAddSlicer
// in events/slicerEvents.js, used by the "+" controls on the canvas.
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

// Splits the currently selected top-level chart into a vertical stack of
// two charts. The button itself is only shown/hidden by setSelected() (see
// updateSplitChartButtonVisibility in ui/selection.js) whenever the
// selection is an unstacked, unlocked chart — so a click here can assume
// state.selectedElement is exactly that.
addChartSplitBtn.addEventListener("click", () => {
  const match = /^chart-(\d+)-(\d+)$/.exec(state.selectedElement?.domId || "");
  if (!match) return;
  handleSplitChart(Number(match[1]), Number(match[2]));
});

// Hovering the split button previews its effect by tinting the chart it
// would act on — the same light-red tint used for the reset/export buttons
// (.split-target-highlight, see style.css) — so the user knows exactly
// which chart is about to be split before clicking. Toggled directly on the
// live DOM node rather than through a re-render, since hovering a sidebar
// button doesn't itself change any state.
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
  canvasSizeLabel.textContent = t("canvas.sizeLabel", { width: state.CANVAS_WIDTH, height: state.CANVAS_HEIGHT });
  // Spelling out both halves of the split: what this page uses, and what a
  // brand-new page would start on.
  scopeNote.textContent =
    t("template.scopeNote", { page: state.activeTheme.label, default: defaultThemeLabel() });
  syncTemplateSummary();
}

// The placement switch itself lives in themePicker.js (it picks a layout, so
// it belongs with the other layout controls). What stays here is the sidebar
// row that has to follow the active layout's shape: the vertical column is
// always a single column, so a per-row limit has nothing to control there —
// the row animates away via .collapsible rather than popping out of the panel.
function syncSlicerRowVisibility() {
  const vertical = state.isVerticalSlicers();
  slicersPerRowField.classList.toggle("expanded", !vertical);
  // A collapsed .collapsible is 0px tall but only overflow-hidden, so its
  // contents stay in the tab order — disabling the select keeps keyboard
  // focus from landing on a control nobody can see.
  slicersPerRowSelect.disabled = vertical;
}

// One "add KPI" button per band beyond the first — the header band's own
// button is the static #add-kpi above. Rebuilt from scratch on every sync
// since the number of bands can change (a theme switch, or a page's own
// section reorder in a later stage), unlike the fixed set of controls
// elsewhere in the sidebar. The first generated button keeps the id
// "add-kpi-band2" so the existing two-band case stays addressable by it.
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
    // Only slicer widths and chart row heights can actually be invalidated
    // by a slicers-per-row change (it can shift how much vertical space the
    // slicer area takes, and therefore chartsHeight) — chart widths are
    // unaffected since USABLE_WIDTH doesn't change, so their locks are left
    // alone here.
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
    // Same reasoning as above, for KPIs.
    state.resetKpiSizingLocks();
    state.resetChartRowHeightLocks();
    state.setWarnings([]);
    setSelected(null);
    syncRowLimitControls();
    renderLayout();
    renderWarnings();
  });
}

function refreshUIFromState() {
  setSelected(null);
  // A new page opens the Šablona panel; one already worked on stays folded.
  syncTemplateFoldForPage();
  syncTemplateControls();
  syncPlacementControls();
  syncSlicerRowVisibility();
  syncKpiBandControls();
  syncRowLimitControls();
  // Another page or another theme is new content, not the old content moved
  // (see motion.js R3) — it fades in rather than morphing card by card.
  renderLayout({ motion: "swap" });
  renderWarnings();
}

// The CS / EN switch in the top bar. The language changes in place: i18n.js
// refills the static markup and each module carries over the text it holds;
// what is left here is re-rendering the text-bearing parts of the sidebar and
// canvas. Unlike refreshUIFromState it keeps the selection and the Šablona
// fold, and the canvas relabels without replaying any motion.
const localeSwitch = document.querySelector(".lang-switch");
const localeButtons = localeSwitch.querySelectorAll("[data-locale]");

// data-active places the sliding thumb (style.css). The thumb only transitions
// once data-ready is set, a frame after it first lands, so a page that loads
// in English shows it already on EN instead of sliding over from CS.
function syncLocaleButtons() {
  localeSwitch.dataset.active = getLocale();
  localeButtons.forEach(button => {
    const active = button.dataset.locale === getLocale();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function initLocaleSwitch() {
  localeButtons.forEach(button => {
    button.addEventListener("click", () => setLocale(button.dataset.locale));
  });
  syncLocaleButtons();
  requestAnimationFrame(() => requestAnimationFrame(() => { localeSwitch.dataset.ready = ""; }));

  onLocaleChange(() => {
    syncLocaleButtons();
    syncTemplateControls();
    syncKpiBandControls();
    syncRowLimitControls();
    renderTabBar();
    renderLayout({ motion: false });
    // The rebuilt canvas carries no selection mark; the selection itself
    // survived (ui/selection.js relabelled it), so put the mark back.
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
  if (!restoreSession()) initTabs();
  initSessionPersistence();
  initTabsUI({ refreshUI: refreshUIFromState });
  initThemePicker({ refreshUI: refreshUIFromState });
  initRail({ openEditor: openActiveThemeEditor });
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
  initSelectionCopyButtons();
  initSelectionInlineEditing();
  setSelected(null);
  initCanvasRefit();
  // On a machine that blocks site data, say so up front rather than let the
  // pages vanish on the next visit.
  if (!storageAvailable()) addWarning(t("session.storageUnavailable"), "info");
}

// Refits the canvas the moment the workspace changes width — the same frame
// a window drag, a snap, a scrollbar or the stacked breakpoint narrows it —
// rather than 150ms after the last resize event, during which the previous,
// wider sheet sat in the narrower page and pushed it out sideways. The
// debounced resize stays for everything else (a height-only change matters
// to the desktop fit) and as the whole story where ResizeObserver is missing.
function initCanvasRefit() {
  window.addEventListener("resize", debounce(renderLayout, 150));
  const main = document.querySelector(".main");
  if (!main || typeof ResizeObserver !== "function") return;
  const app = document.querySelector(".app");
  let lastWidth = main.clientWidth;
  let lastHeight = main.clientHeight;
  let queued = false;
  new ResizeObserver(() => {
    // Width always matters to the fit. Height matters on the desktop, where
    // it only changes with the window; in the stacked layout it changes on
    // every render (the sheet is part of it) and must not re-enter.
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
    // frame by frame instead of jumping after it.
    requestAnimationFrame(() => { queued = false; renderLayout(); });
  }).observe(main);
}

window.addEventListener("DOMContentLoaded", start);
