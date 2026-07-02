import * as state from "../state/state.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { renderWarnings } from "../ui/warnings.js";

const MIN_CHART_WIDTH = 150;
let activeResize = null;

function finishResize() {
  if (!activeResize) return;

  window.removeEventListener("pointermove", activeResize.moveHandler);
  window.removeEventListener("pointerup", activeResize.upHandler);
  window.removeEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "default";
  // Clear any stale warnings that may have been resolved by the resize
  state.setWarnings([]);
  renderWarnings();
  activeResize = null;
}

function handlePointerMove(event) {
  if (!activeResize) return;

  const deltaPx = event.clientX - activeResize.startX;
  const delta = Math.round(deltaPx / state.SCALE);
  const totalWidth = activeResize.startWidth + activeResize.startNextWidth;
  const minCurrent = MIN_CHART_WIDTH;
  const minNext = MIN_CHART_WIDTH;
  let newCurrentWidth = activeResize.startWidth + delta;
  let newNextWidth = totalWidth - newCurrentWidth;

  if (newCurrentWidth < minCurrent) {
    newCurrentWidth = minCurrent;
    newNextWidth = totalWidth - newCurrentWidth;
  }

  if (newNextWidth < minNext) {
    newNextWidth = minNext;
    newCurrentWidth = totalWidth - newNextWidth;
  }

  if (newCurrentWidth === activeResize.currentWidth && newNextWidth === activeResize.nextWidth) {
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

    activeResize = {
      rowIndex,
      itemIndex,
      startX: event.clientX,
      startWidth: currentWidth,
      startNextWidth: nextWidth,
      currentWidth,
      nextWidth,
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
