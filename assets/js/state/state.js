// assets/js/state/state.js
export const LAYOUT_TEMPLATES = {
  FULL_HD: {
    label: "FULL HD",
    canvasWidth: 1920,
    canvasHeight: 1080,
    margin: 30,
    titleHeight: 50,
    gapKpiToCharts: 30,
    slicerHeight: 80,
    kpiMinHeight: 70,
    minSlicerWidth: 50,
    minChartRowHeight: 150
  },
  HD: {
    label: "HD",
    canvasWidth: 1280,
    canvasHeight: 720,
    margin: 20,
    titleHeight: 40,
    gapKpiToCharts: 20,
    slicerHeight: 70,
    kpiMinHeight: 70,
    minSlicerWidth: 50,
    minChartRowHeight: 150
  }
};

export let activeTemplate = "FULL_HD";
export let CANVAS_WIDTH = LAYOUT_TEMPLATES.FULL_HD.canvasWidth;
export let CANVAS_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.canvasHeight;
export let MARGIN = LAYOUT_TEMPLATES.FULL_HD.margin;
export let TITLE_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.titleHeight;
export const GAP_SMALL = 10;
export let GAP_KPI_TO_CHARTS = LAYOUT_TEMPLATES.FULL_HD.gapKpiToCharts;
export let SLICER_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.slicerHeight;
export let KPI_MIN_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.kpiMinHeight;
export let MIN_SLICER_WIDTH = LAYOUT_TEMPLATES.FULL_HD.minSlicerWidth;
export let MIN_CHART_ROW_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.minChartRowHeight;
export const MIN_CHART_WIDTH = 150;
export let USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
export const SCALE = 0.4;
export const MIN_COMPONENTS_PER_ROW = 4;
export const MAX_COMPONENTS_PER_ROW = 7;
export const SECOND_ROW_MAX_ITEMS = 7;
export let MAX_SLICERS = 7;
export let MAX_KPIS = 6;

export let slicers = [];
export let kpis = [];
export let chartRows = [];
export let selectedElement = null;
export let warnings = [];

export function setSlicers(v) { slicers = v; }
export function setKpis(v) { kpis = v; }
export function setChartRows(v) { chartRows = v; }
export function setSelectedElement(v) { selectedElement = v; }
export function setWarnings(v) { warnings = v; }

function clampComponentsPerRow(v) {
  const value = Number.parseInt(v, 10);
  if (Number.isNaN(value)) return MAX_COMPONENTS_PER_ROW;
  return Math.min(MAX_COMPONENTS_PER_ROW, Math.max(MIN_COMPONENTS_PER_ROW, value));
}

export function setMaxSlicers(v) {
  MAX_SLICERS = clampComponentsPerRow(v);
}

export function setMaxKpis(v) {
  MAX_KPIS = clampComponentsPerRow(v);
}

export function setLayoutTemplate(templateKey) {
  const template = LAYOUT_TEMPLATES[templateKey];
  if (!template) return;

  activeTemplate = templateKey;
  CANVAS_WIDTH = template.canvasWidth;
  CANVAS_HEIGHT = template.canvasHeight;
  MARGIN = template.margin;
  TITLE_HEIGHT = template.titleHeight;
  GAP_KPI_TO_CHARTS = template.gapKpiToCharts;
  SLICER_HEIGHT = template.slicerHeight;
  KPI_MIN_HEIGHT = template.kpiMinHeight;
  MIN_SLICER_WIDTH = template.minSlicerWidth;
  MIN_CHART_ROW_HEIGHT = template.minChartRowHeight;
  USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
}

export function resetSizingLocks() {
  slicers = slicers.map(s => ({ ...s, width: null, locked: false }));
  kpis = kpis.map(k => ({ ...k, width: null, height: null, locked: false }));
  chartRows = chartRows.map(row => ({
    ...row,
    height: null,
    locked: false,
    items: row.items.map(() => ({ width: null, locked: false }))
  }));
}

// gettery pro computeVerticalLayout
export function getSlicers() { return slicers; }
export function getKpis() { return kpis; }
export function getChartRows() { return chartRows; }