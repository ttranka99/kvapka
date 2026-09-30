import * as state from "../state/state.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { refreshSelectedChartAfterResize } from "./chartEvents.js";
import { snapToStep } from "../layout/sizeStep.js";
import { settleCanvas } from "../ui/motion.js";

let activeResize = null;

// --- Snapping ---
// Step snap: the dragged width lands on a multiple of 5 canvas px, matching
// the grid the layout solvers use.
//
// Strong snap: aligns the dragged edge with a slicer/KPI right edge or a
// chart boundary in another row. The tolerance is in screen px and divided
// by EFFECTIVE_SCALE at drag time, so the catch radius feels the same at any
// preview scale.
const STRONG_SNAP_SCREEN_PX = 8;

function getCanvasRect() {
  const canvas = document.getElementById("canvas");
  return canvas ? canvas.getBoundingClientRect() : null;
}

// Collects snap targets: right edges (in unscaled canvas px, relative to
// #canvas) of the rendered slicer/KPI elements. Reads the DOM instead of
// calling computeSlicersLayout()/computeKpiLayout(), which also drive
// warnings as a side effect (see warnings.js).
//
// Only right edges are used, because the dragged handle is the right edge of
// "current" and the left edge of "next".
//
// Charts in other rows add their boundaries too (each cell's right edge
// except the row's last), so columns line up across rows. The gap is the same
// in every row, so matching a right edge lines up the whole gap. The dragged
// row is skipped because its boundaries are moving. Stacked cells work as is:
// their `chart-r-i` anchor covers the full cell.
function collectSnapEdgeTargets(rowIndex) {
  const targets = new Set();
  const canvasRect = getCanvasRect();
  if (!canvasRect) return [];
  const scale = state.EFFECTIVE_SCALE || 1;

  document.querySelectorAll("#canvas .canvas-element.slicer, #canvas .canvas-element.kpi").forEach(el => {
    const rect = el.getBoundingClientRect();
    targets.add((rect.right - canvasRect.left) / scale);
  });

  state.chartRows.forEach((row, r) => {
    if (r === rowIndex) return;
    for (let i = 0; i < row.items.length - 1; i++) {
      const el = document.getElementById(`chart-${r}-${i}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      targets.add((rect.right - canvasRect.left) / scale);
    }
  });

  return Array.from(targets);
}

function findNearestSnapEdge(boundaryX, targets, tolerancePx) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const t of targets) {
    const dist = Math.abs(boundaryX - t);
    if (dist <= tolerancePx && dist < nearestDist) {
      nearest = t;
      nearestDist = dist;
    }
  }

  return nearest;
}

// Shows or hides the vertical alignment guide at a screen px value relative
// to #canvas (no scale conversion here). It is re-created on every call,
// because renderLayout() rebuilds #canvas on every width change.
//
// The line is snapped to whole device pixels and is at least one device
// pixel wide. A plain 1px line is narrower than a device pixel under browser
// zoom below 100%, so it would vanish at some snap positions.
function updateSnapGuide(screenLeftPx) {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  const existing = canvas.querySelector(".chart-snap-guide");
  if (existing) existing.remove();

  if (screenLeftPx == null) return;

  const dpr = window.devicePixelRatio || 1;
  const canvasLeft = canvas.getBoundingClientRect().left;
  const width = Math.max(1, Math.round(dpr)) / dpr;
  const deviceLeft = Math.round((canvasLeft + screenLeftPx - width / 2) * dpr);

  const guide = document.createElement("div");
  guide.className = "chart-snap-guide";
  guide.style.left = (deviceLeft / dpr - canvasLeft) + "px";
  guide.style.width = width + "px";
  canvas.appendChild(guide);
}

// Guide position in screen px, read from the rendered bounding boxes of the
// current/next chart elements rather than derived from a GAP_SMALL formula.
function computeGapMidpointScreen(rowIndex, itemIndex) {
  const canvasRect = getCanvasRect();
  if (!canvasRect) return null;

  const currentEl = document.getElementById(`chart-${rowIndex}-${itemIndex}`);
  const nextEl = document.getElementById(`chart-${rowIndex}-${itemIndex + 1}`);
  if (!currentEl || !nextEl) return null;

  const currentRect = currentEl.getBoundingClientRect();
  const nextRect = nextEl.getBoundingClientRect();
  const currentRight = currentRect.right - canvasRect.left;
  const nextLeft = nextRect.left - canvasRect.left;

  return (currentRight + nextLeft) / 2;
}

function finishResize() {
  if (!activeResize) return;

  window.removeEventListener("pointermove", activeResize.moveHandler);
  window.removeEventListener("pointerup", activeResize.upHandler);
  window.removeEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");
  updateSnapGuide(null);
  // No state.setWarnings([]) here on purpose. The layout solvers own the
  // warning lifecycle (see syncWarning in computeKpiLayout.js /
  // computeSlicersLayout.js / computeSlicerRowWidths.js). Wiping the array
  // would make still-true warnings look new and pop their toasts again.
  activeResize = null;
}

// Freezes the height of each unlocked sub-chart when a width drag locks its
// stacked cell. Mirrors handleToggleStackLock (stackEvents.js), so each
// sub-chart's unlock button has something to unlock.
function lockStackEntriesForResize(rowIndex, itemIndex, chart) {
  if (!chart.stack) return;

  const v = computeVerticalLayout();
  const chartsLayout = computeChartsLayout(v);
  const subCharts = chartsLayout[rowIndex]?.[itemIndex]?.subCharts;

  chart.stack.forEach((entry, s) => {
    if (entry.locked) return;
    entry.height = subCharts?.[s]?.height ?? entry.height;
    entry.locked = true;
  });
}

function handlePointerMove(event) {
  if (!activeResize) return;

  const deltaPx = event.clientX - activeResize.startX;
  const delta = Math.round(deltaPx / state.EFFECTIVE_SCALE);
  const totalWidth = activeResize.startWidth + activeResize.startNextWidth;
  const minCurrent = state.MIN_CHART_WIDTH;
  const minNext = state.MIN_CHART_WIDTH;
  let newCurrentWidth = activeResize.startWidth + delta;

  // --- Snapping (strong takes priority over soft, per plan) ---
  const boundaryX = activeResize.itemStartX + newCurrentWidth;
  const strongTolerance = STRONG_SNAP_SCREEN_PX / state.EFFECTIVE_SCALE;
  const snappedEdge = findNearestSnapEdge(boundaryX, activeResize.edgeTargets, strongTolerance);

  let isStrongSnapped = false;

  if (snappedEdge !== null) {
    // Rounded because snappedEdge comes from DOM measurements divided by
    // EFFECTIVE_SCALE, which can leave a float remainder (e.g.
    // 710.0000762939453) that would end up in state.
    newCurrentWidth = Math.round(snappedEdge - activeResize.itemStartX);
    isStrongSnapped = true;
  } else {
    newCurrentWidth = snapToStep(newCurrentWidth);
  }

  let newNextWidth = totalWidth - newCurrentWidth;

  if (newCurrentWidth < minCurrent) {
    newCurrentWidth = minCurrent;
    newNextWidth = totalWidth - newCurrentWidth;
    isStrongSnapped = false; // clamping overrode the snap target
  }

  if (newNextWidth < minNext) {
    newNextWidth = minNext;
    newCurrentWidth = totalWidth - newNextWidth;
    isStrongSnapped = false;
  }

  if (newCurrentWidth === activeResize.currentWidth && newNextWidth === activeResize.nextWidth) {
    // Width unchanged: the rendered elements are still valid, so only the
    // guide needs updating.
    updateSnapGuide(isStrongSnapped ? computeGapMidpointScreen(activeResize.rowIndex, activeResize.itemIndex) : null);
    return;
  }

  activeResize.currentWidth = newCurrentWidth;
  activeResize.nextWidth = newNextWidth;

  const row = state.chartRows[activeResize.rowIndex];
  if (!row) return;

  const currentChart = row.items[activeResize.itemIndex];
  const nextChart = row.items[activeResize.itemIndex + 1];
  if (!currentChart || !nextChart) return;

  currentChart.width = newCurrentWidth;
  currentChart.locked = true;
  nextChart.width = newNextWidth;
  nextChart.locked = true;

  // A stacked cell is locked while any sub-chart is locked (see
  // handleToggleStackLock in stackEvents.js). So lock every sub-chart too,
  // or nothing could ever clear the new item.locked.
  lockStackEntriesForResize(activeResize.rowIndex, activeResize.itemIndex, currentChart);
  lockStackEntriesForResize(activeResize.rowIndex, activeResize.itemIndex + 1, nextChart);

  activeResize.onResize();
  // onResize (renderLayout) rebuilt #canvas, so the new positions can be read
  // only now.
  updateSnapGuide(isStrongSnapped ? computeGapMidpointScreen(activeResize.rowIndex, activeResize.itemIndex) : null);
  refreshSelectedChartAfterResize();
}

function handlePointerUp() {
  finishResize();
}

export function attachChartResizeHandle(handle, rowIndex, itemIndex, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // Snap targets are measured from the cards, so let any glide finish.
    settleCanvas(document.getElementById("canvas"));

    const v = computeVerticalLayout();
    const rowsLayout = computeChartsLayout(v);
    const rowLayout = rowsLayout[rowIndex];
    if (!rowLayout || itemIndex >= rowLayout.length - 1) return;

    const currentWidth = rowLayout[itemIndex].width;
    const nextWidth = rowLayout[itemIndex + 1].width;
    const itemStartX = rowLayout[itemIndex].x;

    activeResize = {
      rowIndex,
      itemIndex,
      startX: event.clientX,
      startWidth: currentWidth,
      startNextWidth: nextWidth,
      currentWidth,
      nextWidth,
      itemStartX,
      edgeTargets: collectSnapEdgeTargets(rowIndex),
      onResize,
      moveHandler: handlePointerMove,
      upHandler: handlePointerUp
    };

    window.addEventListener("pointermove", activeResize.moveHandler);
    window.addEventListener("pointerup", activeResize.upHandler);
    window.addEventListener("pointercancel", activeResize.upHandler);
    document.body.style.cursor = "ew-resize";
    // #canvas is rebuilt on every tick of the drag, which would make the
    // hover controls flicker. This class hides them for the whole drag (see
    // .is-resizing-chart in style.css).
    document.body.classList.add("is-resizing-chart");
  });
}