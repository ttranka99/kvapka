// assets/js/app.js
import { computeSlicersLayout } from "./layout/computeSlicersLayout.js";
import { computeVerticalLayout } from "./layout/computeVerticalLayout.js";
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

function renderWarnings() {
  if (!state.warnings.length) {
    warningsEl.textContent = "Žádná upozornění.";
    return;
  }
  warningsEl.innerHTML = state.warnings.map(w => `<div>• ${w}</div>`).join("");
}

function setSelected(info) {
  state.setSelectedElement(info);
  if (!info) {
    noSelectionEl.classList.remove("hidden");
    selectionDetailsEl.classList.add("hidden");
    document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
    return;
  }

  noSelectionEl.classList.add("hidden");
  selectionDetailsEl.classList.remove("hidden");

  selTypeEl.textContent = info.labelType;
  selIndexEl.textContent = info.labelIndex ?? "-";
  selXEl.textContent = info.x;
  selYEl.textContent = info.y;
  selWidthEl.textContent = info.width;
  selHeightEl.textContent = info.height;

  editWidthEl.classList.add("hidden");
  editHeightEl.classList.add("hidden");

  if (info.kind === "slicer") {
    editWidthEl.classList.remove("hidden");
    inputWidth.value = info.width;
  }

  if (info.kind === "chartRow") {
    editHeightEl.classList.remove("hidden");
    inputHeight.value = info.height;
  }

  if (info.kind === "kpi") {
    editWidthEl.classList.remove("hidden");
    inputWidth.value = info.width;
  }

  document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
  if (info.domId) {
    const el = document.getElementById(info.domId);
    if (el) el.classList.add("selected");
  }
}

function computeKpiLayout(v) {
  if (state.kpis.length === state.MAX_KPIS) {
    addWarning("Dosažen maximální počet KPI. Další KPI budou umístěny na další řádek.");
  }

  if (state.kpis.length > state.MAX_KPIS * 2) {
    addWarning("Dosaženo maximálního počtu KPI. Odeberte KPI.");
    state.setKpis(state.kpis.slice(0, state.MAX_KPIS * 2));
  }

  const n = state.kpis.length;
  if (n === 0) return [];

  const row1 = state.kpis.slice(0, state.MAX_KPIS);
  const row2 = state.kpis.slice(state.MAX_KPIS, state.MAX_KPIS * 2);

  const totalGaps1 = (row1.length - 1) * state.GAP_SMALL;
  const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;

  let widths1;
  const anyLocked1 = row1.some(k => k.locked);

  if (!anyLocked1) {
    if (row1.length <= 3) {
      widths1 = Array(row1.length).fill(250);
    } else {
      const w = Math.floor((state.USABLE_WIDTH - totalGaps1) / row1.length);
      widths1 = Array(row1.length).fill(w);
    }
  } else {
    const lockedSum = row1
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);

    let remaining = state.USABLE_WIDTH - totalGaps1 - lockedSum;

    if (remaining < 0) {
      addWarning("Součet ručně nastavených šířek KPI přesahuje dostupnou šířku.");
      return [];
    }

    const unlocked = row1.filter(k => !k.locked);
    const u = unlocked.length;

    if (u === 0) {
      widths1 = row1.map(k => k.width);
    } else {
      const base = Math.floor(remaining / u);
      let remainder = remaining % u;

      widths1 = row1.map(k => {
        if (k.locked) return k.width;
        let w = base;
        if (remainder > 0) { w += 1; remainder--; }
        return w;
      });
    }
  }

  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  if (totalWidthRow1 > state.USABLE_WIDTH) {
    addWarning("KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.");
    return [];
  }

  let widths2 = [];

  if (row2.length > 0) {
    const available = state.USABLE_WIDTH - totalGaps2;
    const anyLocked2 = row2.some(k => k.locked);

    if (!anyLocked2) {
      if (row2.length < state.MAX_KPIS) {
        const baseWidth = widths1[0];
        const totalNeeded = row2.length * baseWidth + totalGaps2;

        if (totalNeeded <= state.USABLE_WIDTH) {
          widths2 = Array(row2.length).fill(baseWidth);
        } else {
          const scaleFactor = available / (row2.length * baseWidth);
          const adjustedWidth = Math.floor(baseWidth * scaleFactor);
          widths2 = Array(row2.length).fill(adjustedWidth);
        }
      } else {
        const w = Math.floor((state.USABLE_WIDTH - totalGaps2) / row2.length);
        widths2 = Array(row2.length).fill(w);
      }
    } else {
      const lockedSum2 = row2
        .filter(k => k.locked)
        .reduce((sum, k) => sum + (k.width ?? 0), 0);

      let remaining2 = state.USABLE_WIDTH - totalGaps2 - lockedSum2;
      if (remaining2 < 0) {
        addWarning("Součet ručně nastavených šířek KPI na druhém řádku přesahuje dostupnou šířku.");
        remaining2 = 0;
      }

      const unlocked2 = row2.filter(k => !k.locked);
      const u2 = unlocked2.length;

      if (u2 === 0) {
        widths2 = row2.map(k => k.width);
      } else {
        const base = Math.floor(remaining2 / u2);
        let remainder = remaining2 % u2;

        widths2 = row2.map(k => {
          if (k.locked) return k.width;
          let w = base;
          if (remainder > 0) { w += 1; remainder--; }
          return w;
        });
      }
    }

    const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
    if (totalWidthRow2 > state.USABLE_WIDTH) {
      addWarning("KPI na druhém řádku se nevejdou – uprav šířky nebo odeber KPI.");
      return [];
    }
  }

  const rows = [];

  if (row1.length > 0) {
    let x = state.MARGIN;
    const y = v.kpiTop;

    const items = row1.map((k, i) => {
      const w = widths1[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: i,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  if (row2.length > 0) {
    let x = state.MARGIN;

    const row1Height = row1.length
      ? Math.max(...row1.map(k => k.height ?? state.KPI_MIN_HEIGHT))
      : state.KPI_MIN_HEIGHT;

    const y = v.kpiTop + row1Height + state.GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: state.MAX_KPIS + i,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  return rows;
}

function computeChartRowHeights(v) {
  const rows = state.chartRows;
  const n = rows.length;
  if (n === 0) return [];

  const totalGaps = (n - 1) * state.GAP_SMALL;
  const lockedSum = rows.filter(r => r.locked).reduce((s, r) => s + (r.height ?? 0), 0);

  let remaining = v.chartsHeight - totalGaps - lockedSum;
  if (remaining < 0) remaining = 0;

  const unlocked = rows.filter(r => !r.locked);
  const m = unlocked.length;

  const result = new Array(n);

  if (m === 0) {
    rows.forEach((r, i) => result[i] = r.height ?? state.MIN_CHART_ROW_HEIGHT);
    return result;
  }

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  rows.forEach((r, i) => {
    if (r.locked) result[i] = r.height;
    else {
      let h = base;
      if (remainder > 0) { h += 1; remainder--; }
      if (h < state.MIN_CHART_ROW_HEIGHT) h = state.MIN_CHART_ROW_HEIGHT;
      result[i] = h;
    }
  });

  return result;
}

function computeChartsLayout(v) {
  const heights = computeChartRowHeights(v);
  const rowsLayout = [];
  let currentY = v.chartsTop;

  state.chartRows.forEach((row, rowIndex) => {
    const rowHeight = heights[rowIndex];
    const items = [];
    const n = row.items.length;

    const totalGaps = (n - 1) * state.GAP_SMALL;
    const remainingWidth = state.USABLE_WIDTH - totalGaps;

    const baseWidth = Math.floor(remainingWidth / n);
    let remainder = remainingWidth % n;

    let x = state.MARGIN;

    row.items.forEach((item, i) => {
      let w = baseWidth;
      if (remainder > 0) { w += 1; remainder--; }

      items.push({
        type: "chart",
        rowIndex,
        indexInRow: i,
        x,
        y: currentY,
        width: w,
        height: rowHeight
      });

      x += w + state.GAP_SMALL;
    });

    rowsLayout.push(items);
    currentY += rowHeight + state.GAP_SMALL;
  });

  return rowsLayout;
}

function canAddChart(simulatedChartRows, vLayout) {
  const original = state.chartRows;
  state.setChartRows(simulatedChartRows);

  state.setWarnings([]);
  const heights = computeChartRowHeights(vLayout);

  state.setChartRows(original);

  const n = simulatedChartRows.length;
  const totalGaps = (n - 1) * state.GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (heights.some(h => h < state.MIN_CHART_ROW_HEIGHT)) return false;
  if (totalHeight > vLayout.chartsHeight) return false;

  return true;
}

function renderLayout() {
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
        const newSlicers = [...state.slicers];
        newSlicers.splice(item.globalIndex, 0, { width: null, locked: false });
        state.setSlicers(newSlicers);
        renderLayout();
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Odebrat slicer";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newSlicers = [...state.slicers];
        newSlicers.splice(item.globalIndex - 1, 1);

        if (newSlicers.length < state.MAX_SLICERS) {
          state.setWarnings(state.warnings.filter(w => !w.includes("slicer")));
        }

        state.setSlicers(newSlicers);
        renderLayout();
        renderWarnings();
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected({
          kind: "slicer",
          labelType: "Slicer",
          labelIndex: item.globalIndex,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          domId,
          stateRef: item.stateRef
        });
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
        const newKpis = [...state.kpis];
        newKpis.splice(item.index + 1, 0, { height: null, locked: false });
        state.setKpis(newKpis);
        renderLayout();
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Remove KPI";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newKpis = [...state.kpis];
        newKpis.splice(item.index, 1);

        if (newKpis.length < state.MAX_KPIS) {
          state.setWarnings(state.warnings.filter(w => !w.includes("KPI")));
        }

        state.setKpis(newKpis);
        renderLayout();
        renderWarnings();
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected({
          kind: "kpi",
          labelType: "KPI",
          labelIndex: item.index + 1,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          domId,
          stateRef: item.stateRef
        });
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
        const simulated = JSON.parse(JSON.stringify(state.chartRows));
        simulated[rowIndex].items.splice(i, 0, {});
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        state.setChartRows(simulated);
        renderLayout();
      });

      const addRightBtn = document.createElement("button");
      addRightBtn.textContent = "→";
      addRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const simulated = JSON.parse(JSON.stringify(state.chartRows));
        simulated[rowIndex].items.splice(i + 1, 0, {});
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        state.setChartRows(simulated);
        renderLayout();
      });

      const addDownBtn = document.createElement("button");
      addDownBtn.textContent = "↓";
      addDownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const simulated = JSON.parse(JSON.stringify(state.chartRows));
        simulated.splice(rowIndex + 1, 0, { height: null, locked: false, items: [{}] });
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        state.setChartRows(simulated);
        renderLayout();
      });

      controls.appendChild(addLeftBtn);
      controls.appendChild(addRightBtn);
      controls.appendChild(addDownBtn);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newRows = JSON.parse(JSON.stringify(state.chartRows));
        const rowItems = newRows[rowIndex].items;
        if (rowItems.length > 1) rowItems.splice(i, 1);
        else if (newRows.length > 1) newRows.splice(rowIndex, 1);
        state.setChartRows(newRows);
        renderLayout();
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const heights = computeChartRowHeights(v);
        setSelected({
          kind: "chartRow",
          labelType: "Řada grafů",
          labelIndex: rowIndex + 1,
          x: item.x,
          y: item.y,
          width: item.width,
          height: heights[rowIndex],
          domId,
          rowIndex
        });
      });

      canvas.appendChild(el);
    });
  });

  canvas.addEventListener("click", () => setSelected(null), { once: true });
  renderWarnings();
}

applyWidthBtn.addEventListener("click", () => {
  if (!state.selectedElement) return;

  const val = parseInt(inputWidth.value, 10);
  if (isNaN(val) || val < 50) {
    addWarning(`Minimální šířka je 50px.`);
    renderWarnings();
    return;
  }

  if (state.selectedElement.kind === "slicer") {
    const s = state.selectedElement.stateRef;
    s.width = val;
    s.locked = true;
    renderLayout();
    return;
  }

  if (state.selectedElement.kind === "kpi") {
    const k = state.selectedElement.stateRef;
    k.width = val;
    k.locked = true;
    renderLayout();
    return;
  }
});

applyHeightBtn.addEventListener("click", () => {
  if (!state.selectedElement) return;

  if (state.selectedElement.kind === "kpi") {
    const val = parseInt(inputHeight.value, 10);
    if (isNaN(val) || val < state.KPI_MIN_HEIGHT) {
      addWarning(`Minimální výška KPI je ${state.KPI_MIN_HEIGHT}px.`);
      renderWarnings();
      return;
    }

    const k = state.selectedElement.stateRef;
    k.height = val;
    k.locked = true;

    renderLayout();
    return;
  }

  if (state.selectedElement.kind === "chartRow") {
    const val = parseInt(inputHeight.value, 10);
    if (isNaN(val) || val < state.MIN_CHART_ROW_HEIGHT) {
      addWarning(`Minimální výška řady grafů je ${state.MIN_CHART_ROW_HEIGHT}px.`);
      renderWarnings();
      return;
    }

    const rowsCopy = JSON.parse(JSON.stringify(state.chartRows));
    const row = rowsCopy[state.selectedElement.rowIndex];
    const originalHeight = row.height;
    const originalLocked = row.locked;

    row.height = val;
    row.locked = true;

    const v = computeVerticalLayout();
    state.setWarnings([]);
    const heights = computeChartRowHeights(v);

    const n = rowsCopy.length;
    const totalGaps = (n - 1) * state.GAP_SMALL;
    const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

    const overflow =
      heights.some(h => h < state.MIN_CHART_ROW_HEIGHT) ||
      totalHeight > v.chartsHeight;

    if (overflow) {
      row.height = originalHeight;
      row.locked = originalLocked;
      addWarning("Zadaná výška se nevejde — uprav hodnotu.");
      renderWarnings();
      return;
    }

    state.setChartRows(rowsCopy);
    renderLayout();
  }
});

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

resetBtn.addEventListener("click", () => {
  state.setWarnings([]);
  renderWarnings();
  initState();
  renderLayout();
  setSelected(null);
});

addKpiBtn.addEventListener("click", addKPI);
addSlicerBtn.addEventListener("click", addSlicer);

function initState() {
  const initialSlicers = [];
  for (let i = 0; i < 3; i++) initialSlicers.push({ width: null, locked: false });

  const initialKpis = [];

  const initialChartRows = [
    { height: null, locked: false, items: [{}, {}] }
  ];

  state.setSlicers(initialSlicers);
  state.setKpis(initialKpis);
  state.setChartRows(initialChartRows);
  state.setSelectedElement(null);
  state.setWarnings([]);
}

function start() {
  initState();
  renderLayout();
  setSelected(null);
}

window.addEventListener("DOMContentLoaded", start);