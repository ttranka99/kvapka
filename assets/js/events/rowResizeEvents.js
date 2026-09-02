import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { rowEffectiveMinHeight } from "../layout/computeStackHeights.js";
import { renderWarnings } from "../ui/warnings.js";
import { refreshSelectedChartAfterResize } from "./chartEvents.js";
import { snapToStep } from "../layout/sizeStep.js";

let activeRowResize = null;

// Step snap only — the dragged height always lands on a multiple of 5 canvas
// px, same as the chart-width drag. Unlike width dragging, there's no
// "strong" alignment snap here: slicers/KPIs live above the chart area, not
// between chart rows, so there's nothing meaningful to align a row boundary
// against.

function finishRowResize() {
  if (!activeRowResize) return;

  window.removeEventListener("pointermove", activeRowResize.moveHandler);
  window.removeEventListener("pointerup", activeRowResize.upHandler);
  window.removeEventListener("pointercancel", activeRowResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");
  state.setWarnings([]);
  renderWarnings();
  activeRowResize = null;
}

function handleRowPointerMove(event) {
  if (!activeRowResize) return;

  const deltaPx = event.clientY - activeRowResize.startY;
  const delta = Math.round(deltaPx / state.EFFECTIVE_SCALE);
  const totalHeight = activeRowResize.startHeight + activeRowResize.startNextHeight;
  const minCurrent = activeRowResize.minCurrent;
  const minNext = activeRowResize.minNext;
  let newCurrentHeight = snapToStep(activeRowResize.startHeight + delta);

  let newNextHeight = totalHeight - newCurrentHeight;

  if (newCurrentHeight < minCurrent) {
    newCurrentHeight = minCurrent;
    newNextHeight = totalHeight - newCurrentHeight;
  }

  if (newNextHeight < minNext) {
    newNextHeight = minNext;
    newCurrentHeight = totalHeight - newNextHeight;
  }

  if (newCurrentHeight === activeRowResize.currentHeight && newNextHeight === activeRowResize.nextHeight) {
    return;
  }

  activeRowResize.currentHeight = newCurrentHeight;
  activeRowResize.nextHeight = newNextHeight;

  const rowA = state.chartRows[activeRowResize.rowIndex];
  const rowB = state.chartRows[activeRowResize.rowIndex + 1];
  if (!rowA || !rowB) return;

  // Only these two rows' heights change — their combined total stays fixed
  // throughout the drag, so no other row's auto-computed height is
  // affected, and no new overflow risk is introduced by this operation.
  rowA.height = newCurrentHeight;
  rowA.locked = true;
  rowB.height = newNextHeight;
  rowB.locked = true;

  activeRowResize.onResize();
  refreshSelectedChartAfterResize();
}

function handleRowPointerUp() {
  finishRowResize();
}

export function attachRowResizeHandle(handle, rowIndex, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const v = computeVerticalLayout();
    const heights = computeChartRowHeights(v);
    const currentHeight = heights[rowIndex];
    const nextHeight = heights[rowIndex + 1];
    if (currentHeight == null || nextHeight == null) return;

    activeRowResize = {
      rowIndex,
      startY: event.clientY,
      startHeight: currentHeight,
      startNextHeight: nextHeight,
      currentHeight,
      nextHeight,
      minCurrent: rowEffectiveMinHeight(state.chartRows[rowIndex]),
      minNext: rowEffectiveMinHeight(state.chartRows[rowIndex + 1]),
      onResize,
      moveHandler: handleRowPointerMove,
      upHandler: handleRowPointerUp
    };

    window.addEventListener("pointermove", activeRowResize.moveHandler);
    window.addEventListener("pointerup", activeRowResize.upHandler);
    window.addEventListener("pointercancel", activeRowResize.upHandler);
    document.body.style.cursor = "ns-resize";
    // Reuses the same flicker-suppression class as chart-width dragging —
    // #canvas is rebuilt on every height change too, for the same reason.
    document.body.classList.add("is-resizing-chart");
  });
}