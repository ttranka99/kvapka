// assets/js/events/stackResizeEvents.js
//
// Horizontal drag handle between two adjacent charts inside a vertical
// stack. Structurally a clone of rowResizeEvents.js's row-height drag (same
// two-neighbor, fixed-total-height resize), but deliberately does NOT lock
// either sub-chart afterward — per the feature spec, stacked charts should
// never gain a size lock just from being dragged, only from the explicit
// lock button (see handleToggleStackLock in stackEvents.js). That keeps them
// eligible for auto-redistribution when the row itself is resized.
import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { renderWarnings } from "../ui/warnings.js";
import { refreshSelectedStackChartAfterEdit } from "./stackEvents.js";

let activeStackResize = null;

const SOFT_SNAP_TOLERANCE_PX = 2;

function nearestMultipleOf5(value) {
  return Math.round(value / 5) * 5;
}

function finishStackResize() {
  if (!activeStackResize) return;

  window.removeEventListener("pointermove", activeStackResize.moveHandler);
  window.removeEventListener("pointerup", activeStackResize.upHandler);
  window.removeEventListener("pointercancel", activeStackResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");
  state.setWarnings([]);
  renderWarnings();
  activeStackResize = null;
}

function handleStackPointerMove(event) {
  if (!activeStackResize) return;

  const deltaPx = event.clientY - activeStackResize.startY;
  const delta = Math.round(deltaPx / state.EFFECTIVE_SCALE);
  const totalHeight = activeStackResize.startHeight + activeStackResize.startNextHeight;
  const min = state.MIN_CHART_ROW_HEIGHT;
  let newCurrentHeight = activeStackResize.startHeight + delta;

  const rounded = nearestMultipleOf5(newCurrentHeight);
  if (Math.abs(newCurrentHeight - rounded) <= SOFT_SNAP_TOLERANCE_PX) {
    newCurrentHeight = rounded;
  }

  let newNextHeight = totalHeight - newCurrentHeight;

  if (newCurrentHeight < min) {
    newCurrentHeight = min;
    newNextHeight = totalHeight - newCurrentHeight;
  }

  if (newNextHeight < min) {
    newNextHeight = min;
    newCurrentHeight = totalHeight - newNextHeight;
  }

  if (newCurrentHeight === activeStackResize.currentHeight && newNextHeight === activeStackResize.nextHeight) {
    return;
  }

  activeStackResize.currentHeight = newCurrentHeight;
  activeStackResize.nextHeight = newNextHeight;

  const { rowIndex, itemIndex, stackIndex } = activeStackResize;
  const stack = state.chartRows[rowIndex]?.items?.[itemIndex]?.stack;
  if (!stack) return;

  // Neither entry's `locked` flag is touched here — see file header. Storing
  // the height keeps it fixed for this render, but it stays part of the
  // "unlocked" pool for row-height redistribution and future add/remove.
  stack[stackIndex].height = newCurrentHeight;
  stack[stackIndex + 1].height = newNextHeight;

  activeStackResize.onResize();
  refreshSelectedStackChartAfterEdit();
}

function handleStackPointerUp() {
  finishStackResize();
}

export function attachStackResizeHandle(handle, rowIndex, itemIndex, stackIndex, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const v = computeVerticalLayout();
    const chartsLayout = computeChartsLayout(v);
    const subCharts = chartsLayout[rowIndex]?.[itemIndex]?.subCharts;
    if (!subCharts) return;

    const currentHeight = subCharts[stackIndex]?.height;
    const nextHeight = subCharts[stackIndex + 1]?.height;
    if (currentHeight == null || nextHeight == null) return;

    activeStackResize = {
      rowIndex,
      itemIndex,
      stackIndex,
      startY: event.clientY,
      startHeight: currentHeight,
      startNextHeight: nextHeight,
      currentHeight,
      nextHeight,
      onResize,
      moveHandler: handleStackPointerMove,
      upHandler: handleStackPointerUp
    };

    window.addEventListener("pointermove", activeStackResize.moveHandler);
    window.addEventListener("pointerup", activeStackResize.upHandler);
    window.addEventListener("pointercancel", activeStackResize.upHandler);
    document.body.style.cursor = "ns-resize";
    document.body.classList.add("is-resizing-chart");
  });
}
