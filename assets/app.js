const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MARGIN = 30;
const TITLE_HEIGHT = 50;
const GAP_SMALL = 10;
const GAP_KPI_TO_CHARTS = 30;
const SLICER_HEIGHT = 80;
const KPI_MIN_HEIGHT = 70;
const MIN_SLICER_WIDTH = 50;
const MIN_CHART_ROW_HEIGHT = 150;
const USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
const SCALE = 0.4;
const MAX_SLICERS = 7;
const MAX_KPIS = 6;

let slicers = [];
let kpis = [];
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
const addKpiBtn = document.getElementById("add-kpi");
const addSlicerBtn = document.getElementById("add-slicer");

function scale(v) { return v * SCALE; }
function clearCanvas() { while (canvas.firstChild) canvas.removeChild(canvas.firstChild); }
function addWarning(msg) {
  // Prevent duplicate warnings
  if (!warnings.includes(msg)) {
    warnings.push(msg);
  }
}
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

function computeVerticalLayout() {
  const TITLE_Y = MARGIN;

  const slicersTop = TITLE_Y + TITLE_HEIGHT + GAP_SMALL;

  const hasRow2 = slicers.length > MAX_SLICERS;
  const slicersBottom =
    slicers.length === 0
      ? slicersTop
      : hasRow2
        ? slicersTop + SLICER_HEIGHT * 2 + GAP_SMALL
        : slicersTop + SLICER_HEIGHT;

  const kpiTop =
    slicers.length > 0
      ? slicersBottom + GAP_SMALL
      : slicersTop;

  const kpiRow1 = kpis.slice(0, MAX_KPIS);
  const kpiRow2 = kpis.length > MAX_KPIS ? kpis.slice(MAX_KPIS) : [];

  const row1Height = kpiRow1.length
    ? Math.max(...kpiRow1.map(k => k.height ?? KPI_MIN_HEIGHT))
    : 0;

  const row2Height = kpiRow2.length
    ? Math.max(...kpiRow2.map(k => k.height ?? KPI_MIN_HEIGHT))
    : 0;

  const kpiTotalHeight =
    row1Height +
    (row2Height > 0 ? GAP_SMALL + row2Height : 0);


  const kpiBottom =
    kpis.length > 0
      ? kpiTop + kpiTotalHeight
      : kpiTop;

  const chartsTop =
    slicers.length === 0 && kpis.length === 0
      ? slicersTop
      : kpis.length > 0
        ? kpiBottom + GAP_KPI_TO_CHARTS
        : slicersBottom + GAP_KPI_TO_CHARTS;

  const chartsBottom = CANVAS_HEIGHT - MARGIN;
  const chartsHeight = chartsBottom - chartsTop;

  return {
    TITLE_Y,
    slicersTop,
    slicersBottom,
    kpiTop,
    kpiBottom,
    chartsTop,
    chartsBottom,
    chartsHeight,
    hasRow2
  };
}
function computeSlicerRowWidths(rowSlicers) {
  const n = rowSlicers.length;
  if (n === 0) return [];

  if (n <= 3) return rowSlicers.map(s => s.locked ? s.width : 350);

  const totalGaps = (n - 1) * GAP_SMALL;
  const lockedSum = rowSlicers.filter(s => s.locked).reduce((sum, s) => sum + (s.width ?? 0), 0);
  let remaining = USABLE_WIDTH - totalGaps - lockedSum;

  if (remaining < 0) {
    addWarning("Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku.");
    remaining = 0;
  }

  const unlocked = rowSlicers.filter(s => !s.locked);
  const m = unlocked.length;

  if (m === 0) return rowSlicers.map(s => s.width);

  if (remaining < m * MIN_SLICER_WIDTH)
    addWarning("Nedostatek místa – některé slicery mohou být příliš úzké.");

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  return rowSlicers.map(s => {
    if (s.locked) return s.width;
    let w = base;
    if (remainder > 0) { w += 1; remainder--; }
    return w;
  });
}

function computeSlicersLayout(v) {
  if (slicers.length === MAX_SLICERS) {
    addWarning("Dosaženo maximálního počtu slicerů na řádek. Další slicery budou umístěny na další řádek.");
  }
  // --- SPLIT INTO TWO ROWS ---
  const row1 = slicers.slice(0, MAX_SLICERS);
  const row2 = slicers.slice(MAX_SLICERS, MAX_SLICERS * 2);

  // Hard limit: max 12 slicers
  if (slicers.length > MAX_SLICERS * 2) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    return [];
  }

  // --- COMPUTE WIDTHS FOR ROW 1 ---
  const row1Widths = computeSlicerRowWidths(row1);

  // --- COMPUTE WIDTHS FOR ROW 2 ---
  let row2Widths = [];
  if (row2.length > 0) {
    row2Widths = computeSlicerRowWidths(row2);

    // Overflow check
    const totalGaps2 = (row2.length - 1) * GAP_SMALL;
    const totalWidth2 = row2Widths.reduce((s, w) => s + w, 0) + totalGaps2;

    if (totalWidth2 > USABLE_WIDTH) {
      addWarning("Slicery na druhém řádku se nevejdou – uprav šířky nebo odeber slicer.");
      return [];
    }
  }


  const rows = [];

  if (row1.length) {
    let x = MARGIN;
    const items = row1.map((s, i) => {
      const w = row1Widths[i];
      const item = { type: "slicer", globalIndex: i + 1, x, y: v.slicersTop, width: w, height: SLICER_HEIGHT, stateRef: s };
      x += w + GAP_SMALL;
      return item;
    });
    rows.push(items);
  }

  if (row2.length) {
    let x = MARGIN;
    const items = row2.map((s, i) => {
      const w = row2Widths[i];
      const globalIndex = MAX_SLICERS + i + 1;
      const item = { type: "slicer", globalIndex, x, y: v.slicersTop + SLICER_HEIGHT + GAP_SMALL, width: w, height: SLICER_HEIGHT, stateRef: s };
      x += w + GAP_SMALL;
      return item;
    });
    rows.push(items);
  }

  return rows;
}

function computeKpiLayout(v) {
  if (kpis.length === MAX_KPIS) {
    addWarning("Dosažen maximální počet KPI. Další KPI budou umístěny na další řádek.");
  }
  // Hard limit
  if (kpis.length > MAX_KPIS * 2) {
    addWarning("Dosaženo maximálního počtu KPI. Odeberte KPI.");
    kpis = kpis.slice(0, MAX_KPIS * 2); // keep KPIs bellow limit
  }


  const n = kpis.length;
  if (n === 0) return [];

  // Split KPI into two rows
  const row1 = kpis.slice(0, MAX_KPIS);
  const row2 = kpis.slice(MAX_KPIS, MAX_KPIS * 2);


  const totalGaps1 = (row1.length - 1) * GAP_SMALL;
  const totalGaps2 = (row2.length - 1) * GAP_SMALL;

  // --- ROW 1 WIDTHS (no overflow allowed) ---
  let widths1;

  const anyLocked1 = row1.some(k => k.locked);

  if (!anyLocked1) {
    // Original KPI logic
    if (row1.length <= 3) {
      widths1 = Array(row1.length).fill(250);
    } else {
      const w = Math.floor((USABLE_WIDTH - totalGaps1) / row1.length);
      widths1 = Array(row1.length).fill(w);
    }
  } else {
    // Locked KPI logic
    const lockedSum = row1
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);

    let remaining = USABLE_WIDTH - totalGaps1 - lockedSum;

    if (remaining < 0) {
      addWarning("Součet ručně nastavených šířek KPI přesahuje dostupnou šířku.");
      return []; // STOP RENDERING KPI
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

  // Overflow check row 1
  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  if (totalWidthRow1 > USABLE_WIDTH) {
    addWarning("KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.");
    return []; // STOP RENDERING KPI
  }

  // --- MIN WIDTH FOR ROW 2 = WIDTH OF FIRST KPI IN ROW 1 ---
  const minWidthForRow2 = widths1[0];

  // --- ROW 2 WIDTHS (adaptive to first row, max 6 KPI) ---
  let widths2 = [];

  if (row2.length > 0) {
    const totalGaps2 = (row2.length - 1) * GAP_SMALL;
    const available = USABLE_WIDTH - totalGaps2;

    const anyLocked2 = row2.some(k => k.locked);

    if (!anyLocked2) {
      // --- If second row has fewer KPI than first row ---
      if (row2.length < MAX_KPIS) {
        const baseWidth = widths1[0]; // use first KPI width from row 1
        const totalNeeded = row2.length * baseWidth + totalGaps2;

        if (totalNeeded <= USABLE_WIDTH) {
          // fits → use same width
          widths2 = Array(row2.length).fill(baseWidth);
        } else {
          // doesn't fit → shrink proportionally
          const scaleFactor = available / (row2.length * baseWidth);
          const adjustedWidth = Math.floor(baseWidth * scaleFactor);
          widths2 = Array(row2.length).fill(adjustedWidth);
        }
      } else {
        // --- Standard logic for full second row (6 KPI) ---
        const w = Math.floor((USABLE_WIDTH - totalGaps2) / row2.length);
        widths2 = Array(row2.length).fill(w);
      }
    } else {
      // --- Locked KPI logic (same as row1) ---
      const lockedSum2 = row2
        .filter(k => k.locked)
        .reduce((sum, k) => sum + (k.width ?? 0), 0);

      let remaining2 = USABLE_WIDTH - totalGaps2 - lockedSum2;
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

    // --- Overflow check for second row ---
    const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
    if (totalWidthRow2 > USABLE_WIDTH) {
      addWarning("KPI na druhém řádku se nevejdou – uprav šířky nebo odeber KPI.");
      return []; // stop rendering KPI
    }
  }

  const rows = [];

  // --- LAYOUT ROW 1 ---
  if (row1.length > 0) {
    let x = MARGIN;
    const y = v.kpiTop;

    const items = row1.map((k, i) => {
      const w = widths1[i];
      const h = k.height ?? KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: i,
        stateRef: k
      };

      x += w + GAP_SMALL; // must be OUTSIDE return

      return item;
    });


    rows.push(items);
  }

  // --- LAYOUT ROW 2 ---
  if (row2.length > 0) {
    let x = MARGIN;

    // Height of row 1 (max KPI height)
    const row1Height = row1.length
      ? Math.max(...row1.map(k => k.height ?? KPI_MIN_HEIGHT))
      : KPI_MIN_HEIGHT;

    const y = v.kpiTop + row1Height + GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];
      const h = k.height ?? KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: MAX_KPIS + i,
        stateRef: k
      };

      x += w + GAP_SMALL;

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
  const lockedSum = rows.filter(r => r.locked).reduce((s, r) => s + (r.height ?? 0), 0);

  let remaining = v.chartsHeight - totalGaps - lockedSum;
  if (remaining < 0) remaining = 0;

  const unlocked = rows.filter(r => !r.locked);
  const m = unlocked.length;

  const result = new Array(n);

  if (m === 0) {
    rows.forEach((r, i) => result[i] = r.height ?? MIN_CHART_ROW_HEIGHT);
    return result;
  }

  const base = Math.floor(remaining / m);
  let remainder = remaining % m;

  rows.forEach((r, i) => {
    if (r.locked) result[i] = r.height;
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

      items.push({
        type: "chart",
        rowIndex,
        indexInRow: i,
        x,
        y: currentY,
        width: w,
        height: rowHeight
      });

      x += w + GAP_SMALL;
    });

    rowsLayout.push(items);
    currentY += rowHeight + GAP_SMALL;
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
  clearCanvas();

  const v = computeVerticalLayout();

  // Title
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
    setSelected({
      kind: "title",
      labelType: "Nadpis",
      x: MARGIN,
      y: v.TITLE_Y,
      width: USABLE_WIDTH,
      height: TITLE_HEIGHT,
      domId: titleId
    });
  });

  canvas.appendChild(title);

  // Slicers
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
        slicers.splice(item.globalIndex, 0, { width: null, locked: false });
        renderLayout();
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Odebrat slicer";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        slicers.splice(item.globalIndex - 1, 1);

        // Clear slicer-related warning only if we are back under the limit
        if (slicers.length < MAX_SLICERS) {
          warnings = warnings.filter(w => !w.includes("slicer"));
        }

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

  // KPI
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
        kpis.splice(item.index + 1, 0, { height: null, locked: false });
        renderLayout();
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Remove KPI";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        kpis.splice(item.index, 1);

        // Clear KPI-related warning only if we are back under the limit
        if (kpis.length < MAX_KPIS) {
          warnings = warnings.filter(w => !w.includes("KPI"));
        }

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


  // Charts
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
// Width change
applyWidthBtn.addEventListener("click", () => {
  if (!selectedElement) return;

  const val = parseInt(inputWidth.value, 10);
  if (isNaN(val) || val < 50) {
    addWarning(`Minimální šířka je 50px.`);
    renderWarnings();
    return;
  }

  // --- SLICER ---
  if (selectedElement.kind === "slicer") {
    const s = selectedElement.stateRef;
    s.width = val;
    s.locked = true;
    renderLayout();
    return;
  }

  // --- KPI ---
  if (selectedElement.kind === "kpi") {
    const k = selectedElement.stateRef;
    k.width = val;
    k.locked = true;
    renderLayout();
    return;
  }
});


// KPI or chart height change
applyHeightBtn.addEventListener("click", () => {
  if (!selectedElement) return;

  // KPI height
  if (selectedElement.kind === "kpi") {
    const val = parseInt(inputHeight.value, 10);
    if (isNaN(val) || val < KPI_MIN_HEIGHT) {
      addWarning(`Minimální výška KPI je ${KPI_MIN_HEIGHT}px.`);
      renderWarnings();
      return;
    }

    const k = selectedElement.stateRef;
    k.height = val;
    k.locked = true;

    renderLayout();
    return;
  }

  // Chart row height
  if (selectedElement.kind === "chartRow") {
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
  }
});

// ----------------------------------------------------
// LIMITED ADDITION OF SLICERS AND KPIS
// ----------------------------------------------------

function addSlicer() {
  // Hard limit
  if (slicers.length >= MAX_SLICERS * 2) {
    addWarning("Bylo dosaženo maximálního počtu slicerů.");
    renderWarnings();
    return;
  }

  slicers.push({ width: null, locked: false });
  renderLayout();
  renderWarnings();
}

function addKPI() {
  kpis.push({ height: null, locked: false });
  renderLayout();
  renderWarnings();
}


// Reset
resetBtn.addEventListener("click", () => {
  warnings = [];          // Clear all warnings
  renderWarnings();       // Update warnings panel
  initState();
  renderLayout();
  setSelected(null);
});


// Add KPI
addKpiBtn.addEventListener("click", addKPI);

// Add slicer
addSlicerBtn.addEventListener("click", addSlicer);

// Initialization
function initState() {
  slicers = [];
  for (let i = 0; i < 3; i++) slicers.push({ width: null, locked: false });

  kpis = [];

  chartRows = [
    { height: null, locked: false, items: [{}, {}] }
  ];
}

initState();
renderLayout();
setSelected(null);

