const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MARGIN = 30;
const TITLE_HEIGHT = 50;
const GAP_SMALL = 10;
const GAP_SLICERS_TO_CHARTS = 30;
const SLICER_HEIGHT = 80;
const MIN_SLICER_WIDTH = 50;
const MIN_CHART_ROW_HEIGHT = 150;
const USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
const SCALE = 0.4;

let slicers = [];
let chartRows = [];
let selectedElement = null;
let warnings = [];

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

function scale(v) { return v * SCALE; }
function clearCanvas() { while (canvas.firstChild) canvas.removeChild(canvas.firstChild); }
function addWarning(msg) { warnings.push(msg); }
function renderWarnings() {
  if (!warnings.length) { warningsEl.textContent = "Žádná upozornění."; return; }
  warningsEl.innerHTML = warnings.map(w => `<div>• ${w}</div>`).join("");
}

function setSelected(info) {
  selectedElement = info;
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
  if (info.kind === "slicer") {
    editWidthEl.classList.remove("hidden");
    editHeightEl.classList.add("hidden");
    inputWidth.value = info.width;
  } else if (info.kind === "chartRow") {
    editHeightEl.classList.remove("hidden");
    editWidthEl.classList.add("hidden");
    inputHeight.value = info.height;
  } else {
    editWidthEl.classList.add("hidden");
    editHeightEl.classList.add("hidden");
  }
  document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
  if (info.domId) {
    const el = document.getElementById(info.domId);
    if (el) el.classList.add("selected");
  }
}

function computeVerticalLayout() {
  const TITLE_Y = MARGIN;
  const row1Y = TITLE_Y + TITLE_HEIGHT + GAP_SMALL;
  const hasRow2 = slicers.length > 7;
  const row2Y = hasRow2 ? row1Y + SLICER_HEIGHT + GAP_SMALL : null;
  let chartsTop = hasRow2 ? row2Y + SLICER_HEIGHT + GAP_SLICERS_TO_CHARTS : row1Y + SLICER_HEIGHT + GAP_SLICERS_TO_CHARTS;
  const chartsBottom = CANVAS_HEIGHT - MARGIN;
  const chartsHeight = chartsBottom - chartsTop;
  return { TITLE_Y, row1Y, row2Y, hasRow2, chartsTop, chartsBottom, chartsHeight };
}

function computeSlicerRowWidths(rowSlicers) {
  const n = rowSlicers.length;
  if (n === 0) return [];
  if (n > 0 && n <= 3) {
    const locked = rowSlicers.filter(s => s.locked && s.width != null);
    const lockedSum = locked.reduce((sum, s) => sum + s.width, 0);
    const unlockedCount = n - locked.length;
    const hypotheticalTotal = lockedSum + unlockedCount * 350;
    const noLocked = locked.length === 0;
    const fits = hypotheticalTotal <= (USABLE_WIDTH / 2);
    if (noLocked || fits) return rowSlicers.map(s => s.locked ? s.width : 350);
  }
  const totalGaps = (n - 1) * GAP_SMALL;
  const lockedSum = rowSlicers.filter(s => s.locked && s.width != null).reduce((sum, s) => sum + s.width, 0);
  let remaining = USABLE_WIDTH - totalGaps - lockedSum;
  if (remaining < 0) { addWarning("Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku."); remaining = 0; }
  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;
  const result = new Array(n);
  if (m === 0) { rowSlicers.forEach((s, i) => result[i] = s.width); return result; }
  if (remaining < m * MIN_SLICER_WIDTH) addWarning("Nedostatek místa – některé slicery mohou být příliš úzké.");
  let base = Math.floor(remaining / m);
  let remainder = remaining % m;
  const chunk = 10;
  let chunkCount = Math.floor(remainder / chunk);
  let leftover = remainder % chunk;
  rowSlicers.forEach((s, i) => {
    if (s.locked && s.width != null) result[i] = s.width;
    else {
      let extra = 0;
      if (chunkCount > 0) { extra += chunk; chunkCount--; }
      if (leftover > 0) { extra += 1; leftover--; }
      result[i] = base + extra;
    }
  });
  return result;
}

function computeSlicersLayout(v) {
  const row1 = slicers.slice(0, Math.min(7, slicers.length));
  const row2 = slicers.length > 7 ? slicers.slice(7) : [];
  const row1Widths = computeSlicerRowWidths(row1);
  const row2Widths = computeSlicerRowWidths(row2);
  const rows = [];
  if (row1.length) {
    let x = MARGIN;
    const items = row1.map((s, i) => {
      const w = row1Widths[i];
      const item = { type: "slicer", globalIndex: i + 1, x, y: v.row1Y, width: w, height: SLICER_HEIGHT, stateRef: s };
      x += w + (i < row1.length - 1 ? GAP_SMALL : 0);
      return item;
    });
    rows.push(items);
  }
  if (row2.length) {
    let x = MARGIN;
    const items = row2.map((s, i) => {
      const w = row2Widths[i];
      const globalIndex = 7 + i + 1;
      const item = { type: "slicer", globalIndex, x, y: v.row2Y, width: w, height: SLICER_HEIGHT, stateRef: s };
      x += w + (i < row2.length - 1 ? GAP_SMALL : 0);
      return item;
    });
    rows.push(items);
  }
  return rows;
}
function computeChartRowHeights(v) {
  const rows = chartRows;
  const n = rows.length;
  if (n === 0) return [];
  const totalGaps = (n - 1) * GAP_SMALL;
  const lockedSum = rows.filter(r => r.locked && r.height != null).reduce((sum, r) => sum + r.height, 0);
  let remaining = v.chartsHeight - totalGaps - lockedSum;
  if (remaining < 0) { addWarning("Součet ručně nastavených výšek grafů přesahuje dostupnou výšku."); remaining = 0; }
  const unlocked = rows.filter(r => !r.locked);
  const m = unlocked.length;
  const result = new Array(n);
  if (m === 0) { rows.forEach((r, i) => result[i] = r.height ?? MIN_CHART_ROW_HEIGHT); return result; }
  if (remaining < m * MIN_CHART_ROW_HEIGHT) addWarning("Nedostatek místa – některé řady grafů mohou být příliš nízké.");
  let base = Math.floor(remaining / m);
  let remainder = remaining % m;
  rows.forEach((r, i) => {
    if (r.locked && r.height != null) result[i] = r.height;
    else {
      let h = base;
      if (remainder > 0) { h += 1; remainder--; }
      if (h < MIN_CHART_ROW_HEIGHT) h = MIN_CHART_ROW_HEIGHT;
      result[i] = h;
    }
  });
  return result;
}

function computeChartsLayout(v) {
  const heights = computeChartRowHeights(v);
  const rowsLayout = [];
  let currentY = v.chartsTop;
  chartRows.forEach((row, rowIndex) => {
    const rowHeight = heights[rowIndex];
    const items = [];
    const n = row.items.length;
    const totalGaps = (n - 1) * GAP_SMALL;
    const remainingWidth = USABLE_WIDTH - totalGaps;
    const baseWidth = Math.floor(remainingWidth / n);
    let remainder = remainingWidth % n;
    let x = MARGIN;
    row.items.forEach((item, i) => {
      let w = baseWidth;
      if (remainder > 0) { w += 1; remainder--; }
      items.push({ type: "chart", rowIndex, indexInRow: i, x, y: currentY, width: w, height: rowHeight });
      x += w + (i < n - 1 ? GAP_SMALL : 0);
    });
    rowsLayout.push(items);
    currentY += rowHeight + (rowIndex < chartRows.length - 1 ? GAP_SMALL : 0);
  });
  return rowsLayout;
}

function canAddChart(simulatedChartRows, vLayout) {
  const original = chartRows;
  chartRows = simulatedChartRows;

  warnings = [];
  const heights = computeChartRowHeights(vLayout);

  chartRows = original;

  const n = simulatedChartRows.length;
  const totalGaps = (n - 1) * GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  if (heights.some(h => h < MIN_CHART_ROW_HEIGHT)) return false;
  if (totalHeight > vLayout.chartsHeight) return false;

  return true;
}


function renderLayout() {
  warnings = [];
  clearCanvas();
  const v = computeVerticalLayout();
  if (slicers.length > 7) addWarning("Počet slicerů je větší než 7 – další slicery jsou přesunuty do druhé řady.");
  const titleId = "title-bar";
  const title = document.createElement("div");
  title.className = "canvas-element title";
  title.id = titleId;
  title.style.left = scale(MARGIN) + "px";
  title.style.top = scale(v.TITLE_Y) + "px";
  title.style.width = scale(USABLE_WIDTH) + "px";
  title.style.height = scale(TITLE_HEIGHT) + "px";
  const titleLabel = document.createElement("div");
  titleLabel.className = "canvas-element-label";
  titleLabel.textContent = "Nadpis (1860 × 50)";
  title.appendChild(titleLabel);
  title.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelected({ kind: "title", labelType: "Nadpis", labelIndex: null, x: MARGIN, y: v.TITLE_Y, width: USABLE_WIDTH, height: TITLE_HEIGHT, domId: titleId });
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
        slicers.push({ width: null, locked: false });
        if (slicers.length === 8) addWarning("8. slicer byl přesunut do druhé řady (nestandardní počet).");
        renderLayout();
      });
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Odebrat slicer";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (slicers.length > 1) {
          slicers.splice(item.globalIndex - 1, 1);
          renderLayout();
        }
      });
      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected({ kind: "slicer", labelType: "Slicer", labelIndex: item.globalIndex, x: item.x, y: item.y, width: item.width, height: item.height, domId, stateRef: item.stateRef });
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
        const simulated = JSON.parse(JSON.stringify(chartRows));
        simulated[rowIndex].items.splice(i, 0, {});
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        chartRows = simulated;
        renderLayout();
      });

      const addRightBtn = document.createElement("button");
      addRightBtn.textContent = "→";
      addRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const simulated = JSON.parse(JSON.stringify(chartRows));
        simulated[rowIndex].items.splice(i + 1, 0, {});
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        chartRows = simulated;
        renderLayout();
      });

      const addDownBtn = document.createElement("button");
      addDownBtn.textContent = "↓";
      addDownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const simulated = JSON.parse(JSON.stringify(chartRows));
        simulated.splice(rowIndex + 1, 0, { height: null, locked: false, items: [{}] });
        const vLayout = computeVerticalLayout();
        if (!canAddChart(simulated, vLayout)) {
          addWarning("Nelze přidat další graf — uprav výšky řad grafů.");
          renderWarnings();
          return;
        }
        chartRows = simulated;
        renderLayout();
      });

      controls.appendChild(addLeftBtn);
      controls.appendChild(addRightBtn);
      controls.appendChild(addDownBtn);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const rowItems = chartRows[rowIndex].items;
        if (rowItems.length > 1) rowItems.splice(i, 1);
        else if (chartRows.length > 1) chartRows.splice(rowIndex, 1);
        renderLayout();
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const heights = computeChartRowHeights(v);
        setSelected({ kind: "chartRow", labelType: "Řada grafů", labelIndex: rowIndex + 1, x: item.x, y: item.y, width: item.width, height: heights[rowIndex], domId, rowIndex });
      });

      canvas.appendChild(el);
    });
  });

  canvas.addEventListener("click", () => setSelected(null), { once: true });
  renderWarnings();
}

applyWidthBtn.addEventListener("click", () => {
  if (!selectedElement || selectedElement.kind !== "slicer") return;
  const val = parseInt(inputWidth.value, 10);
  if (isNaN(val) || val < MIN_SLICER_WIDTH) {
    addWarning(`Minimální šířka sliceru je ${MIN_SLICER_WIDTH}px.`);
    renderWarnings();
    return;
  }
  const s = selectedElement.stateRef;
  const originalWidth = s.width;
  const originalLocked = s.locked;
  s.width = val;
  s.locked = true;
  const v = computeVerticalLayout();
  warnings = [];
  computeSlicersLayout(v);
  const overflow = warnings.some(w => w.includes("přesahuje") || w.includes("úzké"));
  if (overflow) {
    s.width = originalWidth;
    s.locked = originalLocked;
    addWarning("Zadaná šířka se nevejde — uprav hodnotu.");
    renderWarnings();
    return;
  }
  renderLayout();
});

applyHeightBtn.addEventListener("click", () => {
  if (!selectedElement || selectedElement.kind !== "chartRow") return;

  const val = parseInt(inputHeight.value, 10);
  if (isNaN(val) || val < MIN_CHART_ROW_HEIGHT) {
    addWarning(`Minimální výška řady grafů je ${MIN_CHART_ROW_HEIGHT}px.`);
    renderWarnings();
    return;
  }

  const row = chartRows[selectedElement.rowIndex];
  const originalHeight = row.height;
  const originalLocked = row.locked;

  row.height = val;
  row.locked = true;

  const v = computeVerticalLayout();
  warnings = [];
  const heights = computeChartRowHeights(v);

  const n = chartRows.length;
  const totalGaps = (n - 1) * GAP_SMALL;
  const totalHeight = heights.reduce((s, h) => s + h, 0) + totalGaps;

  const overflow =
    heights.some(h => h < MIN_CHART_ROW_HEIGHT) ||
    totalHeight > v.chartsHeight;

  if (overflow) {
    row.height = originalHeight;
    row.locked = originalLocked;
    addWarning("Zadaná výška se nevejde — uprav hodnotu.");
    renderWarnings();
    return;
  }

  renderLayout();
});


resetBtn.addEventListener("click", () => {
  initState();
  renderLayout();
  setSelected(null);
});

function initState() {
  slicers = [];
  for (let i = 0; i < 3; i++) slicers.push({ width: null, locked: false });
  chartRows = [{ height: null, locked: false, items: [{}, {}] }];
}

initState();
renderLayout();
setSelected(null);
