import * as state from "../state/state.js";
import { computeVerticalLayout, contentBoxFor } from "../layout/computeVerticalLayout.js";
import { snapToStep } from "../layout/sizeStep.js";
import { rowFitsMin, kpiRowsOf } from "../layout/rowFit.js";
import { addWarning } from "../ui/warnings.js";
import { refreshSelectedSlicerAfterEdit } from "./slicerEvents.js";
import { t } from "../i18n/i18n.js";

// Dragging the vertical slicer column's edge resizes the whole column (all
// slicers share one width). Widening takes space from the KPI/chart content
// box, so it only applies while the unlocked visuals there can absorb it.

let activeResize = null;

// Whether the content box still fits at `contentWidth`. Mirrors canAddChart's
// horizontal test (a stored width is reserved even if unlocked) as plain
// arithmetic. canAddChart isn't reused because it swaps state.chartRows and
// calls setWarnings([]), which would flicker the warning panel on every
// pointermove.
function contentFits(contentWidth) {
  for (const row of state.chartRows) {
    const gaps = (row.items.length - 1) * state.GAP_SMALL;
    const fixed = row.items.filter(item => Number.isFinite(item.width));
    const fixedSum = fixed.reduce((sum, item) => sum + item.width, 0);
    const freeCount = row.items.length - fixed.length;
    if (fixedSum + freeCount * state.MIN_CHART_WIDTH + gaps > contentWidth) return false;
  }

  // Every KPI band must fit.
  return state.kpiBandIds().every(id =>
    kpiRowsOf(id).every(row => row.length === 0 || rowFitsMin(row, state.MIN_KPI_WIDTH, contentWidth))
  );
}

function finishResize() {
  if (!activeResize) return;

  window.removeEventListener("pointermove", activeResize.moveHandler);
  window.removeEventListener("pointerup", activeResize.upHandler);
  window.removeEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");

  if (activeResize.blocked) {
    addWarning(
      t("warnings.slicer.columnWidthMax"),
      "warning"
    );
  }

  // No setWarnings([]) here, see finishResize() in chartResizeEvents.js.
  activeResize = null;
}

function handlePointerMove(event) {
  if (!activeResize) return;

  // The handle is on the column's outer edge, so a rightward drag grows the
  // column on the left side and shrinks it on the right. Flip the sign.
  const dir = state.SLICER_SIDE === "right" ? -1 : 1;
  const delta = dir * Math.round((event.clientX - activeResize.startX) / state.EFFECTIVE_SCALE);
  let width = snapToStep(activeResize.startWidth + delta);
  width = Math.min(
    state.MAX_SLICER_COLUMN_WIDTH,
    Math.max(state.MIN_SLICER_COLUMN_WIDTH, width)
  );

  if (width === state.SLICER_COLUMN_WIDTH) return;

  // Only growth can be refused. Flag it so one warning is raised when the
  // drag ends, not one per tick.
  if (width > state.SLICER_COLUMN_WIDTH && !contentFits(contentBoxFor(width, state.SLICER_SIDE).contentWidth)) {
    activeResize.blocked = true;
    return;
  }

  activeResize.blocked = false;
  state.setSlicerColumnWidth(width);
  activeResize.onResize();
  refreshSelectedSlicerAfterEdit();
}

function handlePointerUp() {
  finishResize();
}

export function attachSlicerColumnResizeHandle(handle, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const v = computeVerticalLayout();

    activeResize = {
      startX: event.clientX,
      startWidth: v.slicerColumnWidth,
      blocked: false,
      onResize,
      moveHandler: handlePointerMove,
      upHandler: handlePointerUp
    };

    window.addEventListener("pointermove", activeResize.moveHandler);
    window.addEventListener("pointerup", activeResize.upHandler);
    window.addEventListener("pointercancel", activeResize.upHandler);
    document.body.style.cursor = "ew-resize";
    // Hides hover controls during the drag, as in the chart width drag.
    document.body.classList.add("is-resizing-chart");
  });
}
