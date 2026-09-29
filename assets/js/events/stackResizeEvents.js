// assets/js/events/stackResizeEvents.js
//
// Horizontal drag handle between two adjacent charts in a vertical stack.
// Same two-neighbor, fixed-total resize as rowResizeEvents.js, but it does
// NOT lock either sub-chart. Only the lock button does that (see
// handleToggleStackLock in stackEvents.js), so dragged sub-charts still
// redistribute when the row is resized.
import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { refreshSelectedStackChartAfterEdit } from "./stackEvents.js";
import { snapToStep } from "../layout/sizeStep.js";

let activeStackResize = null;

function finishStackResize() {
  if (!activeStackResize) return;

  window.removeEventListener("pointermove", activeStackResize.moveHandler);
  window.removeEventListener("pointerup", activeStackResize.upHandler);
  window.removeEventListener("pointercancel", activeStackResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");
  // No state.setWarnings([]) here, see finishResize() in chartResizeEvents.js.
  activeStackResize = null;
}

function handleStackPointerMove(event) {
  if (!activeStackResize) return;

  const deltaPx = event.clientY - activeStackResize.startY;
  const delta = Math.round(deltaPx / state.EFFECTIVE_SCALE);
  const totalHeight = activeStackResize.startHeight + activeStackResize.startNextHeight;
  const min = state.MIN_CHART_ROW_HEIGHT;
  let newCurrentHeight = snapToStep(activeStackResize.startHeight + delta);

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

  // `locked` is not touched (see file header). The stored height holds for
  // this render, but the entries stay in the unlocked pool.
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
