// assets/js/app.js
import { computeSlicersLayout } from "./layout/computeSlicersLayout.js";
import { computeVerticalLayout } from "./layout/computeVerticalLayout.js";
import { renderWarnings } from "./ui/warnings.js";
import { computeKpiLayout } from "./layout/computeKpiLayout.js";
import { computeChartRowHeights } from "./layout/computeChartRowHeights.js";
import { computeChartsLayout } from "./layout/computeChartsLayout.js";
import { setSelected } from "./ui/selection.js";
import { initState } from "./state/initState.js";
import { handleAddSlicer, handleRemoveSlicer, handleSelectSlicer } from "./events/slicerEvents.js";
import { handleAddKpi, handleRemoveKpi, handleSelectKpi } from "./events/kpiEvents.js";
import {
  handleAddChartLeft,
  handleAddChartRight,
  handleAddChartRow,
  handleRemoveChart,
  handleSelectChart
} from "./events/chartEvents.js";
import { canAddChart } from "./layout/canAddChart.js";
import { initResizeEvents } from "./events/resizeEvents.js";
import * as state from "./state/state.js";

const canvas = document.getElementById("canvas");
const warningsEl = document.getElementById("warnings");
const noSelectionEl = document.getElementById("no-selection");
const selectionDetailsEl = document.getElementById("selection-details");
const selTypeEl = document.getElementById("sel-type");
const selIndexEl = document.getElementById("sel-index");
const selXEl = document.getElementById("sel-x");
const selYEl = document.getElementById("sel-y");
const selWidthEl = document.getElementById("sel-width");
const selHeightEl = document.getElementById("sel-height");
const editWidthEl = document.getElementById("edit-width");
const editHeightEl = document.getElementById("edit-height");
const inputWidth = document.getElementById("input-width");
const inputHeight = document.getElementById("input-height");
const applyWidthBtn = document.getElementById("apply-width");
const applyHeightBtn = document.getElementById("apply-height");
const resetBtn = document.getElementById("reset-layout");
const addKpiBtn = document.getElementById("add-kpi");
const addSlicerBtn = document.getElementById("add-slicer");

function scale(v) { return v * state.SCALE; }
function clearCanvas() { while (canvas.firstChild) canvas.removeChild(canvas.firstChild); }

function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
  }
}

export function renderLayout() {
  clearCanvas();

  const v = computeVerticalLayout();

  const titleId = "title-bar";
  const title = document.createElement("div");
  title.className = "canvas-element title";
  title.id = titleId;
  title.style.left = scale(state.MARGIN) + "px";
  title.style.top = scale(v.TITLE_Y) + "px";
  title.style.width = scale(state.USABLE_WIDTH) + "px";
  title.style.height = scale(state.TITLE_HEIGHT) + "px";

  const titleLabel = document.createElement("div");
  titleLabel.className = "canvas-element-label";
  titleLabel.textContent = "Nadpis (1860 × 50)";
  title.appendChild(titleLabel);

  title.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelected({
      kind: "title",
      labelType: "Nadpis",
      x: state.MARGIN,
      y: v.TITLE_Y,
      width: state.USABLE_WIDTH,
      height: state.TITLE_HEIGHT,
      domId: titleId
    });
  });

  canvas.appendChild(title);

  const slicerRowsLayout = computeSlicersLayout(v);

  slicerRowsLayout.forEach(row => {
    row.forEach(item => {
      const domId = `slicer-${item.globalIndex}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element slicer";
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `Slicer ${item.globalIndex}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addBtn = document.createElement("button");
      addBtn.textContent = "+";
      addBtn.title = "Přidat slicer";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddSlicer(item.globalIndex);
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Odebrat slicer";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveSlicer(item.globalIndex);
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectSlicer(item, domId);
      });


      canvas.appendChild(el);
    });
  });

  const kpiRows = computeKpiLayout(v);

  kpiRows.forEach(row => {
    row.forEach(item => {
      const domId = `kpi-${item.index}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element kpi";
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `KPI ${item.index + 1}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addBtn = document.createElement("button");
      addBtn.textContent = "+";
      addBtn.title = "Add KPI";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddKpi(item.index);
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Remove KPI";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveKpi(item.index);
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectKpi(item, domId);
      });

      canvas.appendChild(el);
    });
  });

  const chartsLayout = computeChartsLayout(v);

  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      const domId = `chart-${rowIndex}-${i}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element chart";
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `Graf ${rowIndex + 1}.${i + 1}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addLeftBtn = document.createElement("button");
      addLeftBtn.textContent = "←";
      addLeftBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartLeft(rowIndex, i);
      });

      const addRightBtn = document.createElement("button");
      addRightBtn.textContent = "→";
      addRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartRight(rowIndex, i);
      });

      const addDownBtn = document.createElement("button");
      addDownBtn.textContent = "↓";
      addDownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartRow(rowIndex);
      });

      controls.appendChild(addLeftBtn);
      controls.appendChild(addRightBtn);
      controls.appendChild(addDownBtn);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveChart(rowIndex, i);
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const heights = computeChartRowHeights(v);
        handleSelectChart(item, rowIndex, domId, heights);
      });

      canvas.appendChild(el);
    });
  });

  canvas.addEventListener("click", () => setSelected(null), { once: true });
  renderWarnings();
}

function addSlicer() {
  if (state.slicers.length >= state.MAX_SLICERS * 2) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    renderWarnings();
    return;
  }

  state.setSlicers([...state.slicers, { width: null, locked: false }]);
  renderLayout();
  renderWarnings();
}

function addKPI() {
  state.setKpis([...state.kpis, { height: null, locked: false }]);
  renderLayout();
  renderWarnings();
}

addKpiBtn.addEventListener("click", addKPI);
addSlicerBtn.addEventListener("click", addSlicer);

function start() {
  initState();
  renderLayout();
  initResizeEvents();
  setSelected(null);
}

window.addEventListener("DOMContentLoaded", start);