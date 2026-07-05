import * as state from "../state/state.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { renderWarnings } from "../ui/warnings.js";

let activeResize = null;

// --- Snapping tolerances ---
// Soft snap: gently catches the dragged width on multiples of 5 canvas px
// (e.g. 245, 250, 255...). Tolerance is in canvas (unscaled) px, so it feels
// the same regardless of zoom/shrink level chosen for the tolerance itself.
const SOFT_SNAP_TOLERANCE_PX = 2;

// Strong snap: aligns the dragged edge with a slicer/KPI's left or right
// edge. Tolerance is defined in *screen* px and converted to canvas px at
// drag time (divided by EFFECTIVE_SCALE), so the catch radius feels
// consistent under the pointer regardless of how much the canvas preview is
// currently shrunk to fit the viewport.
const STRONG_SNAP_SCREEN_PX = 8;

function nearestMultipleOf5(value) {
  return Math.round(value / 5) * 5;
}

// Reads the already-rendered slicer/KPI elements directly from the DOM to
// get their right edges in canvas (unscaled) px, rather than calling
// computeSlicersLayout()/computeKpiLayout() again ourselves — those functions
// also drive the notification system as a side effect (see warnings.js), so
// re-invoking them here just to read coordinates would risk redundant or
// unwanted warning churn. Reading the DOM avoids that entirely and reflects
// exactly what's currently on screen.
//
// Only the right edge is collected (not the left edge too): the handle being
// dragged is always the right edge of "current"/left edge of "next", so the
// only alignment that makes visual sense is against other elements' right
// edges — snapping to a left edge would put the chart boundary flush with
// where a slicer/KPI *starts*, not somewhere a person resizing would expect.
function collectSnapEdgeTargets() {
  const targets = new Set();
  const scale = state.EFFECTIVE_SCALE || 1;

  document.querySelectorAll("#canvas .canvas-element.slicer, #canvas .canvas-element.kpi").forEach(el => {
    const left = parseFloat(el.style.left) / scale;
    const width = parseFloat(el.style.width) / scale;
    if (Number.isFinite(left) && Number.isFinite(width)) {
      targets.add(Math.round(left + width));
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

// Shows/hides the vertical alignment guide line while the dragged edge is
// snapped to a slicer/KPI edge. Re-created on every call rather than reused,
// since #canvas is fully torn down and rebuilt by renderLayout() on every
// width change — any guide appended before that render is gone by the time
// this runs again, so there's nothing stale to remove first.
function updateSnapGuide(canvasX) {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  const existing = canvas.querySelector(".chart-snap-guide");
  if (existing) existing.remove();

  if (canvasX == null) return;

  const guide = document.createElement("div");
  guide.className = "chart-snap-guide";
  guide.style.left = (canvasX * state.EFFECTIVE_SCALE) + "px";
  canvas.appendChild(guide);
}

function finishResize() {
  if (!activeResize) return;

  window.removeEventListener("pointermove", activeResize.moveHandler);
  window.removeEventListener("pointerup", activeResize.upHandler);
  window.removeEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "default";
  updateSnapGuide(null);
  // Clear any stale warnings that may have been resolved by the resize
  state.setWarnings([]);
  renderWarnings();
  activeResize = null;
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

  let snappedGuideX = null;

  if (snappedEdge !== null) {
    newCurrentWidth = snappedEdge - activeResize.itemStartX;
    snappedGuideX = snappedEdge;
  } else {
    const rounded = nearestMultipleOf5(newCurrentWidth);
    if (Math.abs(newCurrentWidth - rounded) <= SOFT_SNAP_TOLERANCE_PX) {
      newCurrentWidth = rounded;
    }
  }

  let newNextWidth = totalWidth - newCurrentWidth;

  if (newCurrentWidth < minCurrent) {
    newCurrentWidth = minCurrent;
    newNextWidth = totalWidth - newCurrentWidth;
    snappedGuideX = null; // clamping overrode the snap target
  }

  if (newNextWidth < minNext) {
    newNextWidth = minNext;
    newCurrentWidth = totalWidth - newNextWidth;
    snappedGuideX = null;
  }

  if (newCurrentWidth === activeResize.currentWidth && newNextWidth === activeResize.nextWidth) {
    // Width didn't actually change this tick (e.g. still within the same
    // snapped pixel) — still refresh the guide line in case snap state
    // changed, but skip re-rendering the chart layout itself.
    updateSnapGuide(snappedGuideX);
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

  activeResize.onResize();
  // onResize (renderLayout) just rebuilt #canvas from scratch, so the guide
  // line has to be (re-)added after it, not before.
  updateSnapGuide(snappedGuideX);
}

function handlePointerUp() {
  finishResize();
}

export function attachChartResizeHandle(handle, rowIndex, itemIndex, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

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
      edgeTargets: collectSnapEdgeTargets(),
      onResize,
      moveHandler: handlePointerMove,
      upHandler: handlePointerUp
    };

    window.addEventListener("pointermove", activeResize.moveHandler);
    window.addEventListener("pointerup", activeResize.upHandler);
    window.addEventListener("pointercancel", activeResize.upHandler);
    document.body.style.cursor = "ew-resize";
  });
}