import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { snapToStep } from "../layout/sizeStep.js";
import { addWarning } from "../ui/warnings.js";
import { refreshSelectedSlicerAfterEdit } from "./slicerEvents.js";

// Dragging the vertical slicer column's right edge resizes the whole column
// at once — every slicer in it shares that one width. Widening it takes the
// space from the KPI/chart content box to its right, so the drag is only
// committed while the unlocked visuals there can absorb it.

let activeResize = null;

// Smallest width the KPI/chart content box can be squeezed to at a given
// column width. Charts have a real minimum; KPIs only have the 50px floor
// the Apply button enforces (there's no MIN_KPI_WIDTH constant).
const MIN_KPI_WIDTH = 50;

// Mirrors canAddChart's horizontal test — same "a stored width is reserved
// space whether or not it's still locked" rule — but as pure arithmetic
// against a hypothetical content width. canAddChart itself is deliberately
// not reused here: it swaps state.chartRows in and out and calls
// setWarnings([]) to run a real solve, which would strobe the warning panel
// on every pointermove of the drag.
function contentFits(contentWidth) {
  for (const row of state.chartRows) {
    const gaps = (row.items.length - 1) * state.GAP_SMALL;
    const fixed = row.items.filter(item => Number.isFinite(item.width));
    const fixedSum = fixed.reduce((sum, item) => sum + item.width, 0);
    const freeCount = row.items.length - fixed.length;
    if (fixedSum + freeCount * state.MIN_CHART_WIDTH + gaps > contentWidth) return false;
  }

  // KPI rows split at MAX_KPIS exactly as computeKpiLayout does.
  const kpiRows = [
    state.kpis.slice(0, state.MAX_KPIS),
    state.kpis.slice(state.MAX_KPIS, state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS)
  ];

  for (const row of kpiRows) {
    if (row.length === 0) continue;
    const gaps = (row.length - 1) * state.GAP_SMALL;
    const lockedSum = row
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);
    const freeCount = row.filter(k => !k.locked).length;
    if (lockedSum + freeCount * MIN_KPI_WIDTH + gaps > contentWidth) return false;
  }

  return true;
}

// The content box that `columnWidth` would leave — same formula as
// computeVerticalLayout, evaluated for a width not yet committed to state.
function contentWidthFor(columnWidth) {
  const contentLeft = state.MARGIN + columnWidth + state.GAP_KPI_TO_CHARTS;
  return state.CANVAS_WIDTH - state.MARGIN - contentLeft;
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
      "Šířku sloupce nelze dále zvětšit – odemkněte některé grafy nebo KPI.",
      "warning"
    );
  }

  // No setWarnings([]) here, for the same reason chartResizeEvents avoids it:
  // the layout solvers own the warning lifecycle and clearing the array would
  // make every still-true condition look brand new on the next render.
  activeResize = null;
}

function handlePointerMove(event) {
  if (!activeResize) return;

  const delta = Math.round((event.clientX - activeResize.startX) / state.EFFECTIVE_SCALE);
  let width = snapToStep(activeResize.startWidth + delta);
  width = Math.min(
    state.MAX_SLICER_COLUMN_WIDTH,
    Math.max(state.MIN_SLICER_COLUMN_WIDTH, width)
  );

  if (width === state.SLICER_COLUMN_WIDTH) return;

  // Shrinking always frees space, so only growth can be refused. Flag it so
  // a single warning is raised when the drag ends rather than one per tick.
  if (width > state.SLICER_COLUMN_WIDTH && !contentFits(contentWidthFor(width))) {
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
    // Same rationale as the chart width drag: #canvas is rebuilt on every
    // tick, so hover controls would otherwise flicker for the whole drag.
    document.body.classList.add("is-resizing-chart");
  });
}
