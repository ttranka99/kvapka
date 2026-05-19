// assets/js/state/state.js
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const MARGIN = 30;
export const TITLE_HEIGHT = 50;
export const GAP_SMALL = 10;
export const GAP_KPI_TO_CHARTS = 30;
export const SLICER_HEIGHT = 80;
export const KPI_MIN_HEIGHT = 70;
export const MIN_SLICER_WIDTH = 50;
export const MIN_CHART_ROW_HEIGHT = 150;
export const USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
export const SCALE = 0.4;
export const MAX_SLICERS = 7;
export const MAX_KPIS = 6;

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

// gettery pro computeVerticalLayout
export function getSlicers() { return slicers; }
export function getKpis() { return kpis; }
export function getChartRows() { return chartRows; }
