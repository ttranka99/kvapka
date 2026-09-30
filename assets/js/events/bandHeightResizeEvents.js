import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import {
  computeSlicerColumnHeights,
  slicerColumnFits
} from "../layout/computeSlicerColumnHeights.js";
import { chartRowsFit } from "../layout/canAddChart.js";
import { snapToStep, STEP } from "../layout/sizeStep.js";
import { addWarning } from "../ui/warnings.js";
import { refreshSelectedSlicerAfterEdit } from "./slicerEvents.js";
import { refreshSelectedKpiAfterEdit } from "./kpiEvents.js";
import { t } from "../i18n/i18n.js";

// Dragging a band's bottom edge changes its height.
//
//   Horizontal slicer band: one handle under the band. Every slicer shares
//   the height (state.SLICER_ROW_HEIGHT), and growing takes space from the
//   charts below, so it stops where they would no longer fit.
//
//   KPI band: the same, one handle per band (state.kpiBandHeights).
//
//   Vertical slicer column: one handle under each slicer. That slicer is
//   locked to the dragged height and the unlocked ones redistribute, as with
//   a height typed in the inspector. It stops where the column would
//   overflow.
//
// None goes below the theme's minimum (`minHeight`).
//
// Each attach function supplies three callbacks:
//   current()     the height now applied;
//   tryHeight(h)  applies h, returns whether the layout still fits;
//   restore(h)    puts back `h`, the height from before a refused tryHeight.

let activeResize = null;

function finishResize() {
  if (!activeResize) return;

  window.removeEventListener("pointermove", activeResize.moveHandler);
  window.removeEventListener("pointerup", activeResize.upHandler);
  window.removeEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "default";
  document.body.classList.remove("is-resizing-chart");

  // One warning per drag, not one per tick.
  if (activeResize.blocked) addWarning(t(activeResize.blockedMessage), "warning");

  // No setWarnings([]) here, see finishResize() in chartResizeEvents.js.
  activeResize = null;
}

// Tries `height`, stepping back toward `current` until one fits. A pointer
// jump past the limit still lands on the limit. Returns the height applied.
function largestFitting(height, current) {
  for (let h = height; h > current; h -= STEP) {
    if (activeResize.tryHeight(h)) return h;
  }
  activeResize.restore(current);
  return current;
}

function handlePointerMove(event) {
  if (!activeResize) return;

  const deltaPx = Math.round((event.clientY - activeResize.startY) / state.EFFECTIVE_SCALE);
  let height = snapToStep(activeResize.startHeight + deltaPx / activeResize.divisor);
  height = Math.max(activeResize.minHeight, height);

  const current = activeResize.current();
  if (height === current) return;

  // Shrinking always fits. Only growth can be refused.
  if (height > current) {
    const landed = largestFitting(height, current);
    activeResize.blocked = landed < height;
    if (landed === current) return;
  } else {
    activeResize.tryHeight(height);
    activeResize.blocked = false;
  }

  activeResize.onResize();
  activeResize.refreshSelection();
}

function handlePointerUp() {
  finishResize();
}

function startResize(event, config) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  activeResize = {
    startY: event.clientY,
    blocked: false,
    moveHandler: handlePointerMove,
    upHandler: handlePointerUp,
    ...config
  };

  window.addEventListener("pointermove", activeResize.moveHandler);
  window.addEventListener("pointerup", activeResize.upHandler);
  window.addEventListener("pointercancel", activeResize.upHandler);
  document.body.style.cursor = "ns-resize";
  // Hides hover controls during the drag, as in the chart width drag.
  document.body.classList.add("is-resizing-chart");
}

// Horizontal: the handle under the whole band.
export function attachSlicerBandResizeHandle(handle, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    const rowCount = state.slicers.length > state.MAX_SLICERS ? 2 : 1;
    startResize(event, {
      startHeight: state.SLICER_ROW_HEIGHT,
      // With two rows the band's bottom edge moves twice as far as each row
      // grows, so this keeps the edge under the pointer.
      divisor: rowCount,
      minHeight: state.SLICER_HEIGHT,
      blockedMessage: "warnings.slicer.rowHeightNoFit",
      onResize,
      refreshSelection: refreshSelectedSlicerAfterEdit,
      current: () => state.SLICER_ROW_HEIGHT,
      tryHeight: (h) => {
        state.setSlicerRowHeight(h);
        return chartRowsFit();
      },
      restore: (h) => state.setSlicerRowHeight(h)
    });
  });
}

// KPI band `bandId`: the handle under the band. `rowCount` is how many rows
// it renders (a band with allowSecondRow can have two).
export function attachKpiBandResizeHandle(handle, bandId, rowCount, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    startResize(event, {
      startHeight: state.kpiBandHeight(bandId),
      divisor: rowCount,
      minHeight: state.KPI_MIN_HEIGHT,
      blockedMessage: "warnings.kpi.bandHeightNoFit",
      onResize,
      refreshSelection: refreshSelectedKpiAfterEdit,
      current: () => state.kpiBandHeight(bandId),
      tryHeight: (h) => {
        state.setKpiBandHeight(bandId, h);
        return chartRowsFit();
      },
      restore: (h) => state.setKpiBandHeight(bandId, h)
    });
  });
}

// Vertical: the handle under slicer `globalIndex` (1-based).
export function attachSlicerHeightResizeHandle(handle, globalIndex, onResize) {
  handle.addEventListener("pointerdown", (event) => {
    const s = state.slicers[globalIndex - 1];
    if (!s) return;

    const v = computeVerticalLayout();
    const heights = computeSlicerColumnHeights(state.slicers, v.slicerColumnHeight);
    const startHeight = heights[globalIndex - 1] ?? state.SLICER_HEIGHT;
    // Put back if the very first attempt is refused, so a slicer the drag
    // never resized doesn't end up locked.
    const original = { height: s.height, locked: s.locked };
    let applied = startHeight;
    let changed = false;

    startResize(event, {
      startHeight,
      divisor: 1,
      minHeight: state.SLICER_HEIGHT,
      blockedMessage: "warnings.slicer.heightNoFit",
      onResize,
      refreshSelection: refreshSelectedSlicerAfterEdit,
      current: () => applied,
      tryHeight: (h) => {
        s.height = h;
        s.locked = true;
        if (slicerColumnFits(state.slicers, v.slicerColumnHeight)) {
          applied = h;
          changed = true;
          return true;
        }
        return false;
      },
      restore: (h) => {
        if (changed) {
          s.height = h;
          s.locked = true;
        } else {
          s.height = original.height;
          s.locked = original.locked;
        }
      }
    });
  });
}
