import * as state from "../state/state.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { renderWarnings } from "../ui/warnings.js";
import { refreshSelectedChartAfterResize } from "./chartEvents.js";
import { snapToStep } from "../layout/sizeStep.js";

let activeResize = null;

// --- Snapping ---
// Step snap: the dragged width always lands on a multiple of 5 canvas px
// (e.g. 245, 250, 255...), matching the grid the layout solvers use.
//
// Strong snap: aligns the dragged edge with a slicer/KPI's right edge.
// Tolerance is defined in *screen* px and converted to canvas px at drag
// time (divided by EFFECTIVE_SCALE), so the catch radius feels consistent
// under the pointer regardless of how much the canvas preview is currently
// shrunk to fit the viewport.
const STRONG_SNAP_SCREEN_PX = 8;

function getCanvasRect() {
  const canvas = document.getElementById("canvas");
  return canvas ? canvas.getBoundingClientRect() : null;
}

// Reads the already-rendered slicer/KPI elements' true rendered geometry
// (getBoundingClientRect, not a parsed style string) to get their right
// edges in canvas (unscaled) px, relative to #canvas itself. Reading actual
// rendered geometry rather than re-deriving it avoids any chance of a
// mismatch between assumption and reality. Not calling
// computeSlicersLayout()/computeKpiLayout() again ourselves is deliberate
// too — those functions also drive the notification system as a side
// effect (see warnings.js), so re-invoking them here just to read
// coordinates would risk redundant or unwanted warning churn.
//
// Only the right edge is collected (not the left edge too): the handle being
// dragged is always the right edge of "current"/left edge of "next", so the
// only alignment that makes visual sense is against other elements' right
// edges.
function collectSnapEdgeTargets() {
  const targets = new Set();
  const canvasRect = getCanvasRect();
  if (!canvasRect) return [];
  const scale = state.EFFECTIVE_SCALE || 1;

  document.querySelectorAll("#canvas .canvas-element.slicer, #canvas .canvas-element.kpi").forEach(el => {
    const rect = el.getBoundingClientRect();
    targets.add((rect.right - canvasRect.left) / scale);
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

// Shows/hides the vertical alignment guide line, positioned at an exact
// SCREEN px value relative to #canvas (no scale conversion happens in here
// — the caller already provides a screen-space value). Re-created on every
// call rather than reused, since #canvas is fully torn down and rebuilt by
// renderLayout() on every width change — any guide appended before that
// render is gone by the time this runs again, so there's nothing stale to
// remove first.
function updateSnapGuide(screenLeftPx) {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  const existing = canvas.querySelector(".chart-snap-guide");
  if (existing) existing.remove();

  if (screenLeftPx == null) return;

  const guide = document.createElement("div");
  guide.className = "chart-snap-guide";
  guide.style.left = screenLeftPx + "px";
  canvas.appendChild(guide);
}

// Computes the guide's screen position by reading the ACTUAL rendered
// bounding boxes of the current/next chart elements (getBoundingClientRect,
// relative to #canvas), rather than parsing style strings or deriving it
// from a GAP_SMALL-based formula. This is ground truth: it's correct
// regardless of what layout logic produced those positions, border-box
// sizing, or any other detail that a formula could get subtly wrong.
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
  // Clear any stale warnings that may have been resolved by the resize
  state.setWarnings([]);
  renderWarnings();
  activeResize = null;
}

// Freezes every not-yet-locked sub-chart's height when a width drag locks
// the stacked cell containing them, mirroring handleToggleStackLock's own
// lock-time height freeze (stackEvents.js) so each sub-chart's individual
// unlock button has something meaningful to unlock afterwards.
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
    // The chart's edge lands exactly on the slicer/KPI edge — flush, exact.
    // Rounded because snappedEdge is derived from real DOM getBoundingClientRect()
    // measurements divided by EFFECTIVE_SCALE, which can leave a sub-pixel
    // float remainder (e.g. 710.0000762939453) that would otherwise get baked
    // into state as a non-integer width.
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
    // Width didn't actually change this tick — the existing rendered chart
    // elements are still accurate, so the guide (if any) can be recomputed
    // from them without re-rendering the chart layout itself.
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

  // A stacked cell's width lock is derived from its sub-charts (locked while
  // any sub-chart is locked — see handleToggleStackLock in stackEvents.js), so
  // freezing the cell's width here also has to lock every not-yet-locked
  // sub-chart, or the freshly-set item.locked would have no per-chart control
  // that can ever clear it.
  lockStackEntriesForResize(activeResize.rowIndex, activeResize.itemIndex, currentChart);
  lockStackEntriesForResize(activeResize.rowIndex, activeResize.itemIndex + 1, nextChart);

  activeResize.onResize();
  // onResize (renderLayout) just rebuilt #canvas from scratch with the new
  // widths — only now can the two chart elements' real positions be read
  // back out to find the true gap midpoint.
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
    // #canvas is fully torn down and rebuilt on every width change during
    // the drag (see project render model), which briefly removes and
    // recreates every chart's hover controls each tick even though the
    // cursor never actually left the chart — reading as a flicker. Since
    // showing add/remove/lock controls mid-drag isn't useful anyway, this
    // class just forces them hidden for the whole drag instead of letting
    // them flash in and out on every rebuild (see .is-resizing-chart in
    // style.css).
    document.body.classList.add("is-resizing-chart");
  });
}