import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import { computeKpiLayoutForBand } from "../layout/computeKpiLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import {
  handleAddSlicer,
  handleRemoveSlicer,
  handleSelectSlicer,
  handleToggleSlicerLock
} from "../events/slicerEvents.js";
import { handleAddKpi, handleRemoveKpi, handleSelectKpi, handleToggleKpiLock } from "../events/kpiEvents.js";
import {
  handleAddChartLeft,
  handleAddChartRight,
  handleAddChartRow,
  handleRemoveChart,
  handleSelectChart,
  handleToggleChartLock
} from "../events/chartEvents.js";
import {
  handleAddStackChart,
  handleRemoveStackChart,
  handleToggleStackLock,
  handleSelectStackChart
} from "../events/stackEvents.js";
import { attachChartResizeHandle } from "../events/chartResizeEvents.js";
import { attachRowResizeHandle } from "../events/rowResizeEvents.js";
import { attachStackResizeHandle } from "../events/stackResizeEvents.js";
import { snapshotCanvas, playCanvas } from "./motion.js";
import { attachSlicerColumnResizeHandle } from "../events/slicerColumnResizeEvents.js";
import { setSelected, syncSelectionLockState } from "../ui/selection.js";
import { renderWarnings } from "../ui/warnings.js";
import { icon } from "../ui/icon.js";
import { t } from "../i18n/i18n.js";
import { scheduleSave } from "../state/persist.js";
import { noteChange } from "../state/history.js";
import { getElementStyles } from "../elements/elementStyles.js";
import { resolveColor, rgba, shadowCss } from "../elements/elementStyleModel.js";

const canvas = document.getElementById("canvas");

// The canvas is rebuilt on every render, so a clicked button is replaced by a
// new one under the resting cursor. Tracking the last pointer position lets
// a new button see that the cursor is already on it and suppress its hover
// state until the mouse leaves and returns, instead of flashing straight to
// the hover-preview icon.
let lastPointer = { x: -Infinity, y: -Infinity };
window.addEventListener("pointermove", (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
});

// Clicking the empty canvas background deselects. Registered once here, not
// in renderLayout, because #canvas persists across renders (only its
// children are rebuilt).
canvas.addEventListener("click", () => setSelected(null));

// The project's element styles (Customize Elements) drawn lightly on the
// card: corner radius, background, border and shadow, at canvas scale.
// style.css reads the variables and falls back to the plain card. Selection
// and hover rings still draw over them.
function styleCard(el, type) {
  const v = getElementStyles()[type];
  const s = state.EFFECTIVE_SCALE;
  el.style.setProperty("--el-radius", `${Math.max(2, v["border.radius"] * s)}px`);
  if (v["background.show"]) {
    el.style.setProperty("--el-bg", rgba(resolveColor(v["background.color"]), 1 - v["background.transparency"] / 100));
  }
  if (v["border.show"]) {
    // A border matching the sheet (the default white) would vanish, so the
    // plain card's line stays.
    const color = resolveColor(v["border.color"]);
    if (color !== "#FFFFFF") el.style.setProperty("--el-ring", `inset 0 0 0 ${Math.max(1, v["border.width"] * s)}px ${color}`);
  }
  if (v["dropShadow.show"] && v["dropShadow.position"] !== "Inner") {
    el.style.setProperty("--el-shadow", shadowCss(v, s) + ",");
  }
}

function scale(v) {
  return v * state.EFFECTIVE_SCALE;
}

// The one place a lock becomes visible. Every kind of lock (chart width, row
// height, a slicer or KPI value set by Apply) goes through here, so the card,
// its lock button and the inspector show the same state:
//   .is-locked + data-lock="width" | "height" | "both"  — for CSS/inspector
//   .width-locked / .height-locked                      — the dashed outline
// The always-on mark is the card's lock button (.icon-btn.is-on), which the
// CSS keeps visible on a locked card and slides aside on hover.
function markLocked(el, width, height) {
  if (!width && !height) return;
  el.classList.add("is-locked");
  if (width) el.classList.add("width-locked");
  if (height) el.classList.add("height-locked");
  el.dataset.lock = width && height ? "both" : width ? "width" : "height";
}

// Every card's lock/× cluster sits in the top-right corner. A card too short
// for that (a slicer bar on a small window) centres the cluster instead:
// below this rendered height a corner placement leaves less than a button's
// height beneath it. Decided here from the real rendered height, not a
// container query, because size containment would make every card a stacking
// context and put the × under the resize handles.
const COMPACT_HEIGHT = 48;

function placeControls(el, renderedHeight) {
  el.classList.toggle("is-compact", renderedHeight < COMPACT_HEIGHT);
}

function buildLockButton(locked, onClick, lockedTitle, unlockedTitle) {
  const lockBtn = document.createElement("button");
  lockBtn.className = "icon-btn" + (locked ? " is-on" : "");
  lockBtn.innerHTML = locked
    ? `<span class="icon-default">${icon("lock")}</span><span class="icon-hover">${icon("unlock")}</span>`
    : `<span class="icon-default">${icon("unlock")}</span><span class="icon-hover">${icon("lock")}</span>`;
  lockBtn.title = locked ? lockedTitle : unlockedTitle;
  lockBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return lockBtn;
}

// Fits the canvas to the .main content area (width and height) instead of
// capping at the base SCALE, so it grows on large windows and shrinks on
// small ones with no scrollbars. Floors at 0.12 so tiny windows still render
// something usable.
function computeEffectiveScale() {
  const main = document.querySelector(".main");
  const wrapper = document.getElementById("canvas-wrapper");
  if (!main || !wrapper) return state.SCALE;

  const mainStyles = getComputedStyle(main);
  const wrapperStyles = getComputedStyle(wrapper);
  const paddingX = parseFloat(mainStyles.paddingLeft || 0) + parseFloat(mainStyles.paddingRight || 0);
  const wrapperPaddingX = parseFloat(wrapperStyles.paddingLeft || 0) + parseFloat(wrapperStyles.paddingRight || 0);

  // Below the responsive breakpoint (.app media query in style.css) the
  // sidebar panels stack above the canvas.
  const stacked = getComputedStyle(document.querySelector(".app")).flexDirection === "column";

  // main.clientWidth is unreliable once stacked: with flex-direction:column,
  // .main's width can be driven by its content, which is the canvas we are
  // about to size. That is circular: a stale wide canvas keeps measuring a
  // stale wide "available" width. The document root's clientWidth is the true
  // viewport (minus scrollbar), so use it while stacked.
  const availableWidth = stacked
    ? document.documentElement.clientWidth - paddingX - wrapperPaddingX
    : main.clientWidth - paddingX - wrapperPaddingX;

  // Nothing to measure (e.g. .main is display:none while another rail
  // section is up): keep the last fitted scale, don't snap to the base one.
  if (availableWidth <= 0) return state.EFFECTIVE_SCALE || state.SCALE;
  const fitScaleW = availableWidth / state.CANVAS_WIDTH;

  // Fitting by height when stacked would shrink the canvas to almost nothing
  // (the stacked panels push the wrapper far down the page). Fit by width
  // only and let the page scroll.
  if (stacked) return Math.max(0.12, fitScaleW);

  const wrapperPaddingY = parseFloat(wrapperStyles.paddingTop || 0) + parseFloat(wrapperStyles.paddingBottom || 0);
  const wrapperBorderY = parseFloat(wrapperStyles.borderTopWidth || 0) + parseFloat(wrapperStyles.borderBottomWidth || 0);
  // .main is the scroll container here (the shell is locked to the
  // viewport), so the room for the canvas is .main's height minus everything
  // above the wrapper inside it. Comparing the wrapper's rect to .main's rect
  // alone depends on scroll: once an overflowing render made .main
  // scrollable, a re-render while scrolled would see a small or negative
  // availableHeight and the scale would collapse toward the 0.12 floor.
  // Adding scrollTop gives the room the wrapper would have at scrollTop 0,
  // wherever .main is scrolled.
  const wrapperTopInMain = wrapper.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  const mainPaddingBottom = parseFloat(mainStyles.paddingBottom || 0);
  const availableHeight = main.clientHeight - wrapperTopInMain - wrapperPaddingY - wrapperBorderY - mainPaddingBottom;

  if (availableHeight <= 0) return state.SCALE;
  const fitScaleH = availableHeight / state.CANVAS_HEIGHT;
  return Math.max(0.12, Math.min(fitScaleW, fitScaleH));
}

function clearCanvas() {
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
}

// Appends a hover-activated "+" control at an element edge or gap. Three
// pieces, always in this order so the CSS adjacent-sibling selectors
// (canvas-add-zone:hover + canvas-add-btn, canvas-add-btn:hover +
// canvas-add-scope) can reveal the button on hovering its trigger and the
// scope preview on hovering the button:
//   1. `zone` (optional): an invisible hover-trigger strip. Omitted when a
//      resize handle already occupies that spot (it is in the DOM right
//      before this call and acts as the trigger).
//   2. the circular "+" button.
//   3. the scope preview: an invisible rect matching the element the new one
//      goes next to, drawn only as a solid bar along `scope.edge` (the side
//      it will appear on).
//
// The zone/button (input layer) and the scope preview (visual layer) are
// independent. A caller may nudge its hover zone off a boundary to avoid
// another control's zone while the preview still draws on the real insertion
// edge. So never fold positional nudges into `scope`.
//
// Coordinates are final canvas-relative px (already scaled by the caller),
// like every other #canvas child.
function appendEdgeAddControl({ zone, btnPos, scope, onClick, title }) {
  if (zone) {
    const zoneEl = document.createElement("div");
    zoneEl.className = "canvas-add-zone";
    zoneEl.style.left = zone.left + "px";
    zoneEl.style.top = zone.top + "px";
    zoneEl.style.width = zone.width + "px";
    zoneEl.style.height = zone.height + "px";
    canvas.appendChild(zoneEl);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-circle canvas-add-btn";
  btn.innerHTML = icon("plus");
  btn.title = title;
  btn.style.left = btnPos.x + "px";
  btn.style.top = btnPos.y + "px";
  // A "+" click must not start a drag on the resize strip beneath it.
  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  canvas.appendChild(btn);

  const preview = document.createElement("div");
  preview.className = `canvas-add-scope canvas-add-scope--${scope.edge}`;
  preview.style.left = scope.left + "px";
  preview.style.top = scope.top + "px";
  preview.style.width = scope.width + "px";
  preview.style.height = scope.height + "px";
  canvas.appendChild(preview);
}

// `opts.motion`: undefined replays the change as movement (motion.js R1/R2),
// "swap" fades the new content in (R3, page/theme switch), false rebuilds
// silently. app.js passes a resize Event, which reads as undefined; the size
// gate in playCanvas() skips it anyway.
export function renderLayout(opts) {
  const before = snapshotCanvas(canvas);
  state.setEffectiveScale(computeEffectiveScale());
  clearCanvas();
  // Floored so fractional scale math can't round the box up past the space
  // computeEffectiveScale() measured.
  canvas.style.width = Math.floor(scale(state.CANVAS_WIDTH)) + "px";
  canvas.style.height = Math.floor(scale(state.CANVAS_HEIGHT)) + "px";
  // Drives the font-size of every generic element label (.canvas-element-label
  // in assets/style.css), so names scale with the canvas. It is 10px at the
  // base SCALE, clamped to stay legible.
  const labelFontSize = Math.max(6, Math.min(16, 10 * (state.EFFECTIVE_SCALE / state.SCALE)));
  canvas.style.setProperty("--label-font-size", labelFontSize + "px");

  const v = computeVerticalLayout();

  const titleId = "title-bar";
  const title = document.createElement("div");
  title.className = "canvas-element title";
  title.id = titleId;
  title.style.left = scale(state.MARGIN) + "px";
  title.style.top = scale(v.TITLE_Y) + "px";
  title.style.width = scale(state.USABLE_WIDTH) + "px";
  title.style.height = scale(state.TITLE_HEIGHT) + "px";

  const titleLabel = document.createElement("div");
  titleLabel.className = "canvas-element-label";
  titleLabel.textContent = t("canvas.header", { width: state.USABLE_WIDTH, height: state.TITLE_HEIGHT });
  // Scales like other labels, but is also capped by the title box's height
  // (which shrinks with the template, e.g. HD), so at extreme zoom-out the
  // text can't outgrow the box.
  const titleFontSize = Math.min(labelFontSize, Math.max(6, scale(state.TITLE_HEIGHT) * 0.45));
  titleLabel.style.fontSize = titleFontSize + "px";
  title.appendChild(titleLabel);

  title.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelected({
      kind: "title",
      labelType: t("selection.kind.header"),
      x: state.MARGIN,
      y: v.TITLE_Y,
      width: state.USABLE_WIDTH,
      height: state.TITLE_HEIGHT,
      domId: titleId
    });
  });

  canvas.appendChild(title);

  const verticalSlicers = state.isVerticalSlicers();
  const slicerRowsLayout = computeSlicersLayout(v);

  slicerRowsLayout.forEach(row => {
    row.forEach(item => {
      const domId = `slicer-${item.globalIndex}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element slicer";
      styleCard(el, "slicer");
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";
      placeControls(el, scale(item.height));

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = t("canvas.slicer", { n: item.globalIndex });
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      // A horizontal slicer locks its width, a vertical one its height: the
      // one dimension it owns (the other comes from the row or column).
      markLocked(el, !verticalSlicers && item.stateRef.locked, verticalSlicers && item.stateRef.locked);
      const slicerLockBtn = buildLockButton(
        item.stateRef.locked,
        () => handleToggleSlicerLock(item.globalIndex),
        verticalSlicers ? t("canvas.unlockSlicerHeight") : t("canvas.unlockSlicerWidth"),
        verticalSlicers ? t("canvas.lockSlicerHeight") : t("canvas.lockSlicerWidth")
      );
      controls.appendChild(slicerLockBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = icon("close");
      removeBtn.title = t("canvas.removeSlicer");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveSlicer(item.globalIndex);
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectSlicer(item, domId);
      });

      canvas.appendChild(el);
      // Must run after the button is in the document (see the helper).
      if (slicerLockBtn) suppressHoverIfCursorOver(slicerLockBtn);

      // Hover "+" is the only way to add another slicer. It sits on the edge
      // the slicers grow toward: right in a row, bottom in a vertical column.
      appendEdgeAddControl({
        zone: verticalSlicers
          ? {
              left: scale(item.x),
              top: scale(item.y + item.height) - 8,
              width: scale(item.width),
              height: 16
            }
          : {
              left: scale(item.x + item.width) - 8,
              top: scale(item.y),
              width: 16,
              height: scale(item.height)
            },
        btnPos: verticalSlicers
          ? { x: scale(item.x + item.width / 2), y: scale(item.y + item.height) }
          : { x: scale(item.x + item.width), y: scale(item.y + item.height / 2) },
        scope: {
          left: scale(item.x),
          top: scale(item.y),
          width: scale(item.width),
          height: scale(item.height),
          edge: verticalSlicers ? "bottom" : "right"
        },
        onClick: () => handleAddSlicer(item.globalIndex),
        title: t("canvas.addSlicer")
      });
    });
  });

  // Every KPI band renders in the same pass. Bands past the first differ only
  // in position (typically inside the chart area) and in their item list,
  // which computeKpiLayoutForBand has already resolved.
  const kpiRows = state.kpiBandIds().flatMap(id => computeKpiLayoutForBand(v, id));

  kpiRows.forEach(row => {
    row.forEach(item => {
      const band = item.band ?? 0;
      const domId = band === 0 ? `kpi-${item.index}` : `kpi-b${band}-${item.index}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element kpi";
      styleCard(el, "kpi");
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";
      placeControls(el, scale(item.height));

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      // Numbering restarts at 1 in each band.
      label.textContent = t("canvas.kpi", { n: item.index + 1 });
      el.appendChild(label);
      // One flag covers both values. Which values are set says what is locked.
      markLocked(el, item.stateRef.locked && item.stateRef.width != null, item.stateRef.locked && item.stateRef.height != null);
      el.dataset.kpi = `${item.bandId}:${item.index}`;

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const kpiLockBtn = buildLockButton(
        item.stateRef.locked,
        () => handleToggleKpiLock(item.index, item.bandId),
        t("canvas.unlockKpiWidth"),
        t("canvas.lockKpiWidth")
      );
      controls.appendChild(kpiLockBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = icon("close");
      removeBtn.title = t("canvas.removeKpi");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveKpi(item.index, item.bandId);
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectKpi(item, domId);
      });

      canvas.appendChild(el);

      // Right-edge hover "+" is the only way to add another KPI.
      appendEdgeAddControl({
        zone: {
          left: scale(item.x + item.width) - 8,
          top: scale(item.y),
          width: 16,
          height: scale(item.height)
        },
        btnPos: { x: scale(item.x + item.width), y: scale(item.y + item.height / 2) },
        scope: {
          left: scale(item.x),
          top: scale(item.y),
          width: scale(item.width),
          height: scale(item.height),
          edge: "right"
        },
        onClick: () => handleAddKpi(item.index, item.bandId),
        title: t("canvas.addKpi")
      });
    });
  });

  const chartsLayout = computeChartsLayout(v);

  // Suppresses a new icon button's hover-preview swap if the cursor already
  // rests on it (see the lock button comment in the chart loop below).
  // Shared by the cell width-lock button and every stack height-lock button.
  // Must run after the button is attached to the document.
  function suppressHoverIfCursorOver(btn) {
    const rect = btn.getBoundingClientRect();
    const cursorIsOver =
      lastPointer.x >= rect.left && lastPointer.x <= rect.right &&
      lastPointer.y >= rect.top && lastPointer.y <= rect.bottom;
    if (cursorIsOver) {
      btn.classList.add("suppress-hover");
      btn.addEventListener("mouseleave", () => {
        btn.classList.remove("suppress-hover");
      }, { once: true });
    }
  }

  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      const domId = `chart-${rowIndex}-${i}`;
      const chartStateItem = state.chartRows[rowIndex].items[i];

      if (chartStateItem.stack && chartStateItem.stack.length >= 2) {
        // Invisible anchor at the cell's full box, with the plain
        // `chart-${rowIndex}-${i}` id. The chart-width and row-height handle
        // passes below look charts up by that id, and only need the cell's
        // outer box, so they work unchanged for stacked cells.
        const anchor = document.createElement("div");
        anchor.id = domId;
        anchor.style.position = "absolute";
        anchor.style.left = scale(item.x) + "px";
        anchor.style.top = scale(item.y) + "px";
        anchor.style.width = scale(item.width) + "px";
        anchor.style.height = scale(item.height) + "px";
        anchor.style.pointerEvents = "none";
        anchor.style.visibility = "hidden";
        canvas.appendChild(anchor);

        item.subCharts.forEach((sub, s) => {
          const subDomId = `chart-${rowIndex}-${i}-${s}`;
          const stackEntry = chartStateItem.stack[s];

          const el = document.createElement("div");
          el.id = subDomId;
          el.className = "canvas-element chart";
          styleCard(el, "chart");
          // Use only the sub-chart's own lock. The cell's item.locked is
          // derived from the sub-charts (see handleToggleStackLock in
          // stackEvents.js), so mirroring it would double-apply the lock.
          markLocked(el, false, stackEntry.locked);
          el.style.left = scale(sub.x) + "px";
          el.style.top = scale(sub.y) + "px";
          el.style.width = scale(sub.width) + "px";
          el.style.height = scale(sub.height) + "px";
          placeControls(el, scale(sub.height));

          const label = document.createElement("div");
          label.className = "canvas-element-label";
          label.textContent = t("canvas.stackChart", { row: rowIndex + 1, col: i + 1, stack: s + 1 });
          el.appendChild(label);

          const controls = document.createElement("div");
          controls.className = "element-controls";

          // The top-right cluster has only lock and remove. Adding a chart or
          // stacked chart uses the hover "+" on the relevant edge (see the
          // add-control passes below).
          const stackLockBtn = buildLockButton(
            stackEntry.locked,
            () => handleToggleStackLock(rowIndex, i, s),
            t("canvas.unlockChartHeight"),
            t("canvas.lockChartHeight")
          );
          controls.appendChild(stackLockBtn);

          // Remove is always the last (rightmost) control.
          const stackRemoveBtn = document.createElement("button");
          stackRemoveBtn.className = "icon-btn";
          stackRemoveBtn.innerHTML = icon("close");
          stackRemoveBtn.title = t("canvas.removeChart");
          stackRemoveBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleRemoveStackChart(rowIndex, i, s);
          });
          controls.appendChild(stackRemoveBtn);

          el.appendChild(controls);

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            handleSelectStackChart(rowIndex, i, s, subDomId);
          });

          canvas.appendChild(el);

          suppressHoverIfCursorOver(stackLockBtn);
        });

        // Bottom-edge hover "+" that adds another stacked chart to this
        // column. The zone/button sit a few px above the row boundary, not on
        // it, so they don't overlap the full-width row-add "+" / row-resize
        // handle on that boundary. The nudge is input-layer only: the scope
        // preview covers the last sub-chart and draws its bar on that
        // sub-chart's real bottom edge, so it doesn't cross the label or show
        // the wrong insertion point. It is also clearly different from the
        // row-add preview at the same Y (a one-column bar, not full width).
        const lastSub = item.subCharts[item.subCharts.length - 1];
        const stackBtnY = scale(item.y + item.height) - 10;
        appendEdgeAddControl({
          zone: {
            left: scale(item.x),
            top: stackBtnY - 7,
            width: scale(item.width),
            height: 14
          },
          btnPos: { x: scale(item.x + item.width / 2), y: stackBtnY },
          scope: {
            left: scale(lastSub.x),
            top: scale(lastSub.y),
            width: scale(lastSub.width),
            height: scale(lastSub.height),
            edge: "bottom"
          },
          onClick: () => handleAddStackChart(rowIndex, i, item.subCharts.length - 1),
          title: t("canvas.addChartBelow")
        });

        return;
      }

      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element chart";
      styleCard(el, "chart");
      // Width is the chart's own lock. Height is the row's (set by Apply).
      markLocked(el, chartStateItem.locked, state.chartRows[rowIndex].locked);
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";
      placeControls(el, scale(item.height));

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = t("canvas.chart", { row: rowIndex + 1, col: i + 1 });
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      // The top-right cluster has only lock and remove. Adding a chart uses
      // the hover "+" on the relevant edge (see the add-control passes below).

      // Lock/unlock the chart's width. Locking freezes the current width so
      // sibling add/remove doesn't redistribute it. Height stays auto unless
      // the row's height is locked via the sidebar height editor.
      //
      // The button shows the current state and swaps to a preview of the
      // click on hover (unlocked shows the lock icon, locked the unlock
      // icon). Both icons are always in the DOM and toggled by CSS
      // (.icon-btn:hover), so no re-render is needed.
      const rowLocked = state.chartRows[rowIndex].locked;
      const lockBtn = buildLockButton(
        chartStateItem.locked || rowLocked,
        () => handleToggleChartLock(rowIndex, i),
        rowLocked ? (chartStateItem.locked ? t("canvas.unlockChartWidthAndRow") : t("canvas.unlockRowHeight")) : t("canvas.unlockChartWidth"),
        t("canvas.lockChartWidth")
      );
      controls.appendChild(lockBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = icon("close");
      removeBtn.title = t("canvas.removeChart");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveChart(rowIndex, i);
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      // The resize handle for this pair is created in a later pass, once
      // every chart exists in the DOM. It is a direct child of #canvas, not
      // of the chart div, so its position doesn't have to account for the
      // chart's border/padding.

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const heights = computeChartRowHeights(v);
        handleSelectChart(item, rowIndex, domId, heights);
      });

      canvas.appendChild(el);

      // If the cursor is already on the lock button when it is (re)created
      // (e.g. right after a click re-rendered the canvas), suppress the
      // hover-preview icon swap until the cursor leaves and returns.
      // Otherwise the icon flips to the opposite state at once and the click
      // looks like it did nothing (see .icon-btn.suppress-hover in
      // style.css). Must run after canvas.appendChild(el) above:
      // getBoundingClientRect() on a detached button returns a zero rect.
      suppressHoverIfCursorOver(lockBtn);
    });
  });

  // Horizontal drag handles (and hover "+" add-controls) between adjacent
  // charts in a vertical stack. The stack counterpart of the chart-width and
  // row-height passes below. The drag handle is skipped for a pair when
  // either neighbor is height-locked (nothing to redistribute into). The
  // add-control appears regardless of locks, with its own hover zone when no
  // handle exists to serve as one.
  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      if (!item.subCharts) return;
      const chartStateItem = state.chartRows[rowIndex].items[i];
      const canvasRect = canvas.getBoundingClientRect();

      for (let s = 0; s < item.subCharts.length - 1; s++) {
        const currentEl = document.getElementById(`chart-${rowIndex}-${i}-${s}`);
        const nextEl = document.getElementById(`chart-${rowIndex}-${i}-${s + 1}`);
        if (!currentEl || !nextEl) continue;

        const currentRect = currentEl.getBoundingClientRect();
        const nextRect = nextEl.getBoundingClientRect();
        const midScreenY = (currentRect.bottom + nextRect.top) / 2;
        const left = currentRect.left - canvasRect.left;
        const top = midScreenY - canvasRect.top;
        const width = currentRect.width;

        const draggable = !chartStateItem.stack[s].locked && !chartStateItem.stack[s + 1].locked;
        let handle = null;
        if (draggable) {
          handle = document.createElement("div");
          handle.className = "stack-resize-handle";
          handle.style.left = left + "px";
          handle.style.width = width + "px";
          handle.style.top = top + "px";

          attachStackResizeHandle(handle, rowIndex, i, s, renderLayout);
          canvas.appendChild(handle);
        }

        appendEdgeAddControl({
          zone: handle ? null : { left, top: top - 7, width, height: 14 },
          btnPos: { x: left + width / 2, y: top },
          // Scoped to the sub-chart above the gap: the new chart lands
          // directly below it.
          scope: {
            left,
            top: currentRect.top - canvasRect.top,
            width,
            height: currentRect.height,
            edge: "bottom"
          },
          onClick: () => handleAddStackChart(rowIndex, i, s),
          title: t("canvas.addChartBelow")
        });
      }
    });
  });

  // Each row's resize handles are direct children of #canvas (the same
  // coordinate system as the snap guide), not nested in a chart div. They are
  // positioned from each pair's rendered bounding boxes relative to the
  // canvas, so every chart must already be in the DOM. Hence a separate pass
  // after the loop above.
  const canvasRect = canvas.getBoundingClientRect();

  // The vertical column's right-edge drag handle: one for the whole column
  // (its slicers share a width), spanning top to bottom, positioned from real
  // rendered rects like the other handles.
  if (v.hasColumn) {
    const firstEl = document.getElementById("slicer-1");
    const lastEl = document.getElementById(`slicer-${state.slicers.length}`);
    if (firstEl && lastEl) {
      const firstRect = firstEl.getBoundingClientRect();
      const lastRect = lastEl.getBoundingClientRect();

      const handleX = state.SLICER_SIDE === "right" ? firstRect.left : firstRect.right;

      const columnHandle = document.createElement("div");
      columnHandle.className = "chart-resize-handle";
      columnHandle.style.left = (handleX - canvasRect.left) + "px";
      columnHandle.style.top = (firstRect.top - canvasRect.top) + "px";
      columnHandle.style.height = (lastRect.bottom - firstRect.top) + "px";

      attachSlicerColumnResizeHandle(columnHandle, renderLayout);
      canvas.appendChild(columnHandle);
    }
  }

  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      // Left edge of the first chart: a "+" here adds a chart to its left.
      // There is nothing to drag against, so it always gets its own hover
      // zone, not a resize handle.
      if (i === 0) {
        const el = document.getElementById(`chart-${rowIndex}-0`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const left = rect.left - canvasRect.left;
          const top = rect.top - canvasRect.top;
          appendEdgeAddControl({
            zone: { left: left - 8, top, width: 16, height: rect.height },
            btnPos: { x: left, y: top + rect.height / 2 },
            scope: { left, top, width: rect.width, height: rect.height, edge: "left" },
            onClick: () => handleAddChartLeft(rowIndex, 0),
            title: t("canvas.addChartLeft")
          });
        }
      }

      // Right edge of the last chart: the same, mirrored. A single-chart row
      // hits both branches for the same chart and correctly gets a "+" on each
      // edge.
      if (i === row.length - 1) {
        const el = document.getElementById(`chart-${rowIndex}-${i}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const left = rect.right - canvasRect.left;
          const top = rect.top - canvasRect.top;
          appendEdgeAddControl({
            zone: { left: left - 8, top, width: 16, height: rect.height },
            btnPos: { x: left, y: top + rect.height / 2 },
            scope: {
              left: rect.left - canvasRect.left,
              top,
              width: rect.width,
              height: rect.height,
              edge: "right"
            },
            onClick: () => handleAddChartRight(rowIndex, i),
            title: t("canvas.addChartRight")
          });
        }
      }

      if (i >= row.length - 1) return;

      const currentEl = document.getElementById(`chart-${rowIndex}-${i}`);
      const nextEl = document.getElementById(`chart-${rowIndex}-${i + 1}`);
      if (!currentEl || !nextEl) return;

      const currentRect = currentEl.getBoundingClientRect();
      const nextRect = nextEl.getBoundingClientRect();
      const midScreen = (currentRect.right + nextRect.left) / 2;

      const handle = document.createElement("div");
      handle.className = "chart-resize-handle";
      // Relative to #canvas like every other canvas child, so no chart
      // border or padding to account for.
      handle.style.left = (midScreen - canvasRect.left) + "px";
      handle.style.top = (currentRect.top - canvasRect.top) + "px";
      handle.style.height = currentRect.height + "px";

      attachChartResizeHandle(handle, rowIndex, i, renderLayout);
      canvas.appendChild(handle);

      // One shared "+" for the gap between the two charts, using the resize
      // handle above as its hover trigger (see appendEdgeAddControl).
      appendEdgeAddControl({
        zone: null,
        btnPos: { x: midScreen - canvasRect.left, y: (currentRect.top + currentRect.bottom) / 2 - canvasRect.top },
        // Scoped to the chart left of the gap: the new chart lands to its
        // right and pushes the rest of the row along.
        scope: {
          left: currentRect.left - canvasRect.left,
          top: currentRect.top - canvasRect.top,
          width: currentRect.width,
          height: currentRect.height,
          edge: "right"
        },
        onClick: () => handleAddChartRight(rowIndex, i),
        title: t("canvas.addChartRight")
      });
    });
  });

  // Row-height resize handles: one per adjacent pair of chart rows
  // (chartsLayout.length - 1, so none for a single row). Same canvas-sibling
  // and real-DOM-rect approach as the chart-width handles, on the vertical
  // axis. The handle spans the full usable width, and its CSS centres the
  // grip dots horizontally, like the chart-width handle's grip.
  for (let rowIndex = 0; rowIndex < chartsLayout.length - 1; rowIndex++) {
    const rowA = chartsLayout[rowIndex];
    const rowB = chartsLayout[rowIndex + 1];
    if (!rowA.length || !rowB.length) continue;

    const aEl = document.getElementById(`chart-${rowIndex}-0`);
    const bEl = document.getElementById(`chart-${rowIndex + 1}-0`);
    if (!aEl || !bEl) continue;

    const aRect = aEl.getBoundingClientRect();
    const bRect = bEl.getBoundingClientRect();
    const midScreenY = (aRect.bottom + bRect.top) / 2;

    const rowHandle = document.createElement("div");
    rowHandle.className = "row-resize-handle";
    // The content box, not the whole canvas: a row boundary lies between
    // charts, so in a vertical layout it must stop where the charts do, not
    // run through the slicer column. In the default layout contentLeft /
    // contentWidth equal MARGIN / USABLE_WIDTH.
    rowHandle.style.left = scale(v.contentLeft) + "px";
    rowHandle.style.width = scale(v.contentWidth) + "px";
    rowHandle.style.top = (midScreenY - canvasRect.top) + "px";

    attachRowResizeHandle(rowHandle, rowIndex, renderLayout);
    canvas.appendChild(rowHandle);

    // If a stacked cell in the row above is roughly centred on the row's
    // midpoint, its bottom-edge "+" (added above) would sit almost on top of
    // this row-add "+". Nudge this one aside so both stay clickable.
    const rowCenterX = v.contentLeft + v.contentWidth / 2;
    const hasCenteredStack = rowA.some(cell =>
      cell.subCharts && Math.abs((cell.x + cell.width / 2) - rowCenterX) * state.EFFECTIVE_SCALE < 32
    );
    const btnX = scale(rowCenterX) + (hasCenteredStack ? -40 : 0);

    appendEdgeAddControl({
      zone: null,
      btnPos: { x: btnX, y: midScreenY - canvasRect.top },
      // Scoped to the whole row above the boundary. That distinguishes it
      // from a stacked cell's bottom-edge "+" on the same boundary, whose bar
      // spans one column.
      scope: {
        left: scale(v.contentLeft),
        top: aRect.top - canvasRect.top,
        width: scale(v.contentWidth),
        height: aRect.height,
        edge: "bottom"
      },
      onClick: () => handleAddChartRow(rowIndex),
      title: t("canvas.addChartRowBelow")
    });
  }

  // Bottom edge of the last row: the same "+" / full-width line as the row
  // boundaries above, adding a row after the last one. There is nothing below
  // to drag against, so it gets its own hover zone.
  const lastRowIndex = chartsLayout.length - 1;
  if (lastRowIndex >= 0 && chartsLayout[lastRowIndex].length) {
    const el = document.getElementById(`chart-${lastRowIndex}-0`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const top = rect.bottom - canvasRect.top;
      appendEdgeAddControl({
        zone: { left: scale(v.contentLeft), top: top - 7, width: scale(v.contentWidth), height: 14 },
        btnPos: { x: scale(v.contentLeft + v.contentWidth / 2), y: top },
        scope: {
          left: scale(v.contentLeft),
          top: rect.top - canvasRect.top,
          width: scale(v.contentWidth),
          height: rect.height,
          edge: "bottom"
        },
        onClick: () => handleAddChartRow(lastRowIndex),
        title: t("canvas.addChartRowBelow")
      });
    }
  }

  renderWarnings();
  syncSelectionLockState();
  // Last: the handle and "+" passes above measured the cards at final
  // geometry, so a card mid-glide must not give them a moving box.
  playCanvas(canvas, before, opts);
  // Every page change ends in a render, so this is the one place that saves
  // the session (state/persist.js) and records undo (state/history.js).
  scheduleSave();
  noteChange();
}