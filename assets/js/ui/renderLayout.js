import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import { computeKpiLayout } from "../layout/computeKpiLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { handleAddSlicer, handleRemoveSlicer, handleSelectSlicer } from "../events/slicerEvents.js";
import { handleAddKpi, handleRemoveKpi, handleSelectKpi } from "../events/kpiEvents.js";
import {
  handleAddChartLeft,
  handleAddChartRight,
  handleAddChartRow,
  handleRemoveChart,
  handleSelectChart,
  handleToggleChartLock
} from "../events/chartEvents.js";
import { attachChartResizeHandle } from "../events/chartResizeEvents.js";
import { setSelected } from "../ui/selection.js";
import { renderWarnings } from "../ui/warnings.js";

const canvas = document.getElementById("canvas");

// The canvas is fully destroyed and rebuilt on every render (see project
// notes), so a button clicked by the user does not survive its own click —
// a brand new one is created in its place, right under the still-resting
// cursor. Tracking the last known pointer position lets a freshly-created
// button detect "the cursor is already on top of me" and suppress its hover
// state until the user actually moves the mouse away and back, instead of
// flashing straight to the hover-preview icon the instant it's created.
let lastPointer = { x: -Infinity, y: -Infinity };
window.addEventListener("pointermove", (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
});

// Lock/unlock icons for the chart width-lock control. stroke uses
// currentColor so it inherits the button's (white) text color, matching the
// other icon-style controls (+/-/arrows) instead of hardcoding a color here.
const LOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 0 25 25" fill="none">
<path d="M16.5 9.32001H7.5C6.37366 9.25709 5.26818 9.64244 4.42503 10.3919C3.58188 11.1414 3.06958 12.1941 3 13.32V18.32C3.06958 19.446 3.58188 20.4986 4.42503 21.2481C5.26818 21.9976 6.37366 22.3829 7.5 22.32H16.5C17.6263 22.3829 18.7318 21.9976 19.575 21.2481C20.4181 20.4986 20.9304 19.446 21 18.32V13.32C20.9304 12.1941 20.4181 11.1414 19.575 10.3919C18.7318 9.64244 17.6263 9.25709 16.5 9.32001Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17 9.32001V7.32001C17 5.99392 16.4732 4.72217 15.5355 3.78448C14.5979 2.8468 13.3261 2.32001 12 2.32001C10.6739 2.32001 9.40214 2.8468 8.46446 3.78448C7.52678 4.72217 7 5.99392 7 7.32001V9.32001" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const UNLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 0 25 25" fill="none">
<path d="M16.5 9.32001H7.5C6.37366 9.25709 5.2682 9.64244 4.42505 10.3919C3.5819 11.1414 3.06958 12.1941 3 13.32V18.32C3.06958 19.446 3.5819 20.4986 4.42505 21.2481C5.2682 21.9976 6.37366 22.3829 7.5 22.32H16.5C17.6263 22.3829 18.7318 21.9976 19.575 21.2481C20.4181 20.4986 20.9304 19.446 21 18.32V13.32C20.9304 12.1941 20.4181 11.1414 19.575 10.3919C18.7318 9.64244 17.6263 9.25709 16.5 9.32001Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17 9.32001V7.32001C17 5.99392 16.4732 4.72217 15.5355 3.78448C14.5978 2.8468 13.3261 2.32001 12 2.32001" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Directional arrow icons for the chart add-left/add-right/add-row-below
// controls. Same thin-stroke, currentColor style as the lock icons above
// (stroke-width 2.2, round caps/joins) so all icon-based controls read as
// one consistent set instead of mixing plain unicode glyphs (←/→/↓) with a
// hand-drawn lock icon.
const ARROW_LEFT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ARROW_RIGHT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ARROW_DOWN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const REMOVE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ADD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Clicking the empty canvas background deselects the current element.
// Registered once here (not inside renderLayout) since the #canvas element
// itself persists across renders — only its children are cleared and rebuilt.
canvas.addEventListener("click", () => setSelected(null));

function scale(v) {
  return v * state.EFFECTIVE_SCALE;
}

// Shrinks the render scale down from the base SCALE, if needed, so the canvas
// fits within the available width of the .main content area. Never scales up
// beyond the base SCALE. Floors at 0.12 so extremely narrow viewports still
// render something usable (with horizontal scroll as a fallback).
function computeEffectiveScale() {
  const main = document.querySelector(".main");
  if (!main) return state.SCALE;

  const styles = getComputedStyle(main);
  const paddingX = parseFloat(styles.paddingLeft || 0) + parseFloat(styles.paddingRight || 0);
  const available = main.clientWidth - paddingX;
  if (available <= 0) return state.SCALE;

  const fitScale = available / state.CANVAS_WIDTH;
  return Math.min(state.SCALE, Math.max(0.12, fitScale));
}

function clearCanvas() {
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
}

export function renderLayout() {
  state.setEffectiveScale(computeEffectiveScale());
  clearCanvas();
  canvas.style.width = scale(state.CANVAS_WIDTH) + "px";
  canvas.style.height = scale(state.CANVAS_HEIGHT) + "px";

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
  titleLabel.textContent = `Hlavička (${state.USABLE_WIDTH} × ${state.TITLE_HEIGHT})`;
  title.appendChild(titleLabel);

  title.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelected({
      kind: "title",
      labelType: "Hlavička",
      x: state.MARGIN,
      y: v.TITLE_Y,
      width: state.USABLE_WIDTH,
      height: state.TITLE_HEIGHT,
      domId: titleId
    });
  });

  canvas.appendChild(title);

  const slicerRowsLayout = computeSlicersLayout(v);

  slicerRowsLayout.forEach(row => {
    row.forEach(item => {
      const domId = `slicer-${item.globalIndex}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element slicer";
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `Slicer ${item.globalIndex}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addBtn = document.createElement("button");
      addBtn.className = "icon-btn";
      addBtn.innerHTML = ADD_ICON;
      addBtn.title = "Přidat slicer";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddSlicer(item.globalIndex);
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = REMOVE_ICON;
      removeBtn.title = "Odebrat slicer";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveSlicer(item.globalIndex);
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectSlicer(item, domId);
      });

      canvas.appendChild(el);
    });
  });

  const kpiRows = computeKpiLayout(v);

  kpiRows.forEach(row => {
    row.forEach(item => {
      const domId = `kpi-${item.index}`;
      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element kpi";
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `KPI ${item.index + 1}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addBtn = document.createElement("button");
      addBtn.className = "icon-btn";
      addBtn.innerHTML = ADD_ICON;
      addBtn.title = "Add KPI";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddKpi(item.index);
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = REMOVE_ICON;
      removeBtn.title = "Remove KPI";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveKpi(item.index);
      });

      controls.appendChild(addBtn);
      controls.appendChild(removeBtn);
      el.appendChild(controls);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSelectKpi(item, domId);
      });

      canvas.appendChild(el);
    });
  });

  const chartsLayout = computeChartsLayout(v);

  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      const domId = `chart-${rowIndex}-${i}`;
      const chartStateItem = state.chartRows[rowIndex].items[i];

      const el = document.createElement("div");
      el.id = domId;
      el.className = "canvas-element chart";
      if (chartStateItem.locked) {
        el.classList.add("width-locked");
      }
      el.style.left = scale(item.x) + "px";
      el.style.top = scale(item.y) + "px";
      el.style.width = scale(item.width) + "px";
      el.style.height = scale(item.height) + "px";

      const label = document.createElement("div");
      label.className = "canvas-element-label";
      label.textContent = `Graf ${rowIndex + 1}.${i + 1}`;
      el.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "element-controls";

      const addLeftBtn = document.createElement("button");
      addLeftBtn.className = "icon-btn";
      addLeftBtn.innerHTML = ARROW_LEFT_ICON;
      addLeftBtn.title = "Přidat graf vlevo";
      addLeftBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartLeft(rowIndex, i);
      });

      const addRightBtn = document.createElement("button");
      addRightBtn.className = "icon-btn";
      addRightBtn.innerHTML = ARROW_RIGHT_ICON;
      addRightBtn.title = "Přidat graf vpravo";
      addRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartRight(rowIndex, i);
      });

      const addDownBtn = document.createElement("button");
      addDownBtn.className = "icon-btn";
      addDownBtn.innerHTML = ARROW_DOWN_ICON;
      addDownBtn.title = "Přidat řadu grafů pod";
      addDownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddChartRow(rowIndex);
      });

      controls.appendChild(addLeftBtn);
      controls.appendChild(addRightBtn);
      controls.appendChild(addDownBtn);

      // Lock/unlock the chart's width. Locking freezes its current width so
      // it's excluded from auto-redistribution when siblings are added or
      // removed; height stays independently auto-sized unless the row's
      // height is separately locked via the sidebar height editor.
      //
      // The button shows its *current state* by default, and swaps to a
      // preview of what clicking will do on hover (unlocked -> shows lock
      // icon on hover; locked -> shows unlock icon on hover). Both icons are
      // always in the DOM and toggled via CSS (.icon-btn:hover), so no
      // JS/re-render is needed just to preview the hover state.
      const lockBtn = document.createElement("button");
      lockBtn.className = "icon-btn";
      lockBtn.innerHTML = chartStateItem.locked
        ? `<span class="icon-default">${LOCK_ICON}</span><span class="icon-hover">${UNLOCK_ICON}</span>`
        : `<span class="icon-default">${UNLOCK_ICON}</span><span class="icon-hover">${LOCK_ICON}</span>`;
      lockBtn.title = chartStateItem.locked
        ? "Odemknout šířku grafu"
        : "Zamknout šířku grafu";
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleToggleChartLock(rowIndex, i);
      });
      controls.appendChild(lockBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "icon-btn";
      removeBtn.innerHTML = REMOVE_ICON;
      removeBtn.title = "Odebrat graf";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleRemoveChart(rowIndex, i);
      });

      controls.appendChild(removeBtn);
      el.appendChild(controls);

      if (i < row.length - 1) {
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "chart-resize-handle";
        attachChartResizeHandle(resizeHandle, rowIndex, i, renderLayout);
        el.appendChild(resizeHandle);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const heights = computeChartRowHeights(v);
        handleSelectChart(item, rowIndex, domId, heights);
      });

      canvas.appendChild(el);

      // If the cursor is already sitting on the lock button the instant it's
      // (re)created — e.g. right after the user clicked it and the whole
      // canvas re-rendered underneath the still-resting cursor — suppress
      // its hover-preview icon swap until the cursor actually leaves and
      // comes back. Otherwise the icon flips to the "opposite" state
      // immediately, which reads as if the click did nothing (see
      // .icon-btn.suppress-hover in style.css). Must run after canvas.append
      // -Child(el) above: getBoundingClientRect() on a button that isn't yet
      // attached to the document always returns a zero-sized rect.
      const lockBtnRect = lockBtn.getBoundingClientRect();
      const cursorIsOverLockBtn =
        lastPointer.x >= lockBtnRect.left && lastPointer.x <= lockBtnRect.right &&
        lastPointer.y >= lockBtnRect.top && lastPointer.y <= lockBtnRect.bottom;
      if (cursorIsOverLockBtn) {
        lockBtn.classList.add("suppress-hover");
        lockBtn.addEventListener("mouseleave", () => {
          lockBtn.classList.remove("suppress-hover");
        }, { once: true });
      }
    });
  });

  renderWarnings();
}