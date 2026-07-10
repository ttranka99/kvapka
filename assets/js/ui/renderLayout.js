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
import {
  handleAddStackChart,
  handleRemoveStackChart,
  handleToggleStackLock,
  handleSelectStackChart
} from "../events/stackEvents.js";
import { attachChartResizeHandle } from "../events/chartResizeEvents.js";
import { attachRowResizeHandle } from "../events/rowResizeEvents.js";
import { attachStackResizeHandle } from "../events/stackResizeEvents.js";
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

// Scales the canvas to fully fit the available space of the .main content
// area — both width and height — instead of capping at the base SCALE. This
// lets the canvas grow on large windows and shrink on small ones, so the
// window can always show the whole layout with no scrollbars. Floors at 0.12
// so extremely small windows still render something usable.
function computeEffectiveScale() {
  const main = document.querySelector(".main");
  const wrapper = document.getElementById("canvas-wrapper");
  if (!main || !wrapper) return state.SCALE;

  const mainStyles = getComputedStyle(main);
  const wrapperStyles = getComputedStyle(wrapper);
  const paddingX = parseFloat(mainStyles.paddingLeft || 0) + parseFloat(mainStyles.paddingRight || 0);
  const wrapperPaddingX = parseFloat(wrapperStyles.paddingLeft || 0) + parseFloat(wrapperStyles.paddingRight || 0);

  // Below the responsive breakpoint (see the .app media query in style.css)
  // the sidebar panels stack above the canvas instead of sitting beside it.
  const stacked = getComputedStyle(document.querySelector(".app")).flexDirection === "column";

  // main.clientWidth is unreliable once stacked: with flex-direction:column,
  // .main's cross-axis (width) stretch can end up driven by its own content
  // instead of the viewport — and that content is the canvas we're about to
  // size, creating a circular dependency where a stale large canvas width
  // keeps measuring a stale large "available" width forever. The document
  // root's clientWidth reflects the true viewport (minus scrollbar) and
  // isn't affected by that, so use it as the width basis while stacked.
  const availableWidth = stacked
    ? document.documentElement.clientWidth - paddingX - wrapperPaddingX
    : main.clientWidth - paddingX - wrapperPaddingX;

  if (availableWidth <= 0) return state.SCALE;
  const fitScaleW = availableWidth / state.CANVAS_WIDTH;

  // Fitting by height too in the stacked layout would starve the canvas
  // down to almost nothing (the canvas-wrapper's top position is pushed far
  // down the page by the stacked panels above it), so fit by width only and
  // let the page scroll vertically to reach it.
  if (stacked) return Math.max(0.12, fitScaleW);

  const wrapperPaddingY = parseFloat(wrapperStyles.paddingTop || 0) + parseFloat(wrapperStyles.paddingBottom || 0);
  const wrapperBorderY = parseFloat(wrapperStyles.borderTopWidth || 0) + parseFloat(wrapperStyles.borderBottomWidth || 0);
  // The wrapper's top position already accounts for everything stacked above
  // it (heading, hint text, tab bar, main's own top padding), so subtracting
  // it from the viewport height gives exactly the room left below it.
  const wrapperTop = wrapper.getBoundingClientRect().top;
  const mainPaddingBottom = parseFloat(mainStyles.paddingBottom || 0);
  const availableHeight = window.innerHeight - wrapperTop - wrapperPaddingY - wrapperBorderY - mainPaddingBottom;

  if (availableHeight <= 0) return state.SCALE;
  const fitScaleH = availableHeight / state.CANVAS_HEIGHT;
  return Math.max(0.12, Math.min(fitScaleW, fitScaleH));
}

function clearCanvas() {
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
}

export function renderLayout() {
  state.setEffectiveScale(computeEffectiveScale());
  clearCanvas();
  canvas.style.width = scale(state.CANVAS_WIDTH) + "px";
  canvas.style.height = scale(state.CANVAS_HEIGHT) + "px";
  // Drives every generic element label's font-size (assets/style.css
  // .canvas-element-label) so slicer/KPI/chart names scale with the canvas
  // instead of staying a fixed size as the window grows or shrinks. Reproduces
  // the previous fixed 10px at the base SCALE, clamped so it stays legible.
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
  titleLabel.textContent = `Hlavička (${state.USABLE_WIDTH} × ${state.TITLE_HEIGHT})`;
  // Scale like every other element label, but also cap by the title box's own
  // height (which shrinks with the template, e.g. HD) so at extreme zoom-out
  // the text never grows taller than the box and spills outside it.
  const titleFontSize = Math.min(labelFontSize, Math.max(6, scale(state.TITLE_HEIGHT) * 0.45));
  titleLabel.style.fontSize = titleFontSize + "px";
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

  // Suppresses a freshly-(re)created icon button's hover-preview swap if the
  // cursor already happens to be resting on top of it (see the lock button's
  // original comment above chartsLayout.forEach below for the full
  // rationale) — shared by the cell width-lock button and every per-stack
  // height-lock button, since #canvas is torn down/rebuilt for all of them
  // alike. Must run after the button is attached to the document.
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

  function buildLockButton(locked, onClick, lockedTitle, unlockedTitle) {
    const lockBtn = document.createElement("button");
    lockBtn.className = "icon-btn";
    lockBtn.innerHTML = locked
      ? `<span class="icon-default">${LOCK_ICON}</span><span class="icon-hover">${UNLOCK_ICON}</span>`
      : `<span class="icon-default">${UNLOCK_ICON}</span><span class="icon-hover">${LOCK_ICON}</span>`;
    lockBtn.title = locked ? lockedTitle : unlockedTitle;
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return lockBtn;
  }

  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      const domId = `chart-${rowIndex}-${i}`;
      const chartStateItem = state.chartRows[rowIndex].items[i];

      if (chartStateItem.stack && chartStateItem.stack.length >= 2) {
        // Invisible geometry anchor at the cell's full x/y/width/height,
        // kept at the plain `chart-${rowIndex}-${i}` id so the existing
        // chart-width and row-height resize-handle passes below (which look
        // up charts by that id to read their real rendered rects) keep
        // working unchanged for stacked cells too — they only ever need the
        // cell's outer box, never its internal split.
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
          // A sub-chart's locked visual reflects only its own lock state —
          // the cell's item.locked is *derived* from the sub-charts (see
          // handleToggleStackLock in stackEvents.js), so mirroring it here
          // too would just double-apply the same lock as a second class.
          if (stackEntry.locked) el.classList.add("height-locked");
          el.style.left = scale(sub.x) + "px";
          el.style.top = scale(sub.y) + "px";
          el.style.width = scale(sub.width) + "px";
          el.style.height = scale(sub.height) + "px";

          const label = document.createElement("div");
          label.className = "canvas-element-label";
          label.textContent = `Graf ${rowIndex + 1}.${i + 1}.${s + 1}`;
          el.appendChild(label);

          const controls = document.createElement("div");
          controls.className = "element-controls";
          const isFirst = s === 0;
          const isLast = s === item.subCharts.length - 1;

          // Only the first sub-chart carries the cell-level insert controls
          // (left/right) — they act on the cell as a unit (its position
          // within the row), so showing them on every sub-chart would be
          // redundant. There's no whole-stack remove control: the stack has
          // no size/identity of its own beyond its individual charts, so
          // removal only makes sense per-chart (see the stack +/-/lock
          // controls below, always present on every sub-chart). There's also
          // no separate whole-stack width-lock control — the cell's width
          // lock is derived from the sub-charts' own locks instead (see
          // handleToggleStackLock in stackEvents.js): the column is
          // width-locked while any sub-chart is locked, and unlocking every
          // sub-chart frees the column's width again.
          if (isFirst) {
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

            controls.appendChild(addLeftBtn);
            controls.appendChild(addRightBtn);
          }

          // Only the last sub-chart carries "add row below" — it acts on
          // the whole row, and visually sits closest to the row's bottom
          // edge (where a new row would appear) on the last sub-chart.
          if (isLast) {
            const addDownBtn = document.createElement("button");
            addDownBtn.className = "icon-btn";
            addDownBtn.innerHTML = ARROW_DOWN_ICON;
            addDownBtn.title = "Přidat řadu grafů pod";
            addDownBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              handleAddChartRow(rowIndex);
            });
            controls.appendChild(addDownBtn);
          }

          const stackAddBtn = document.createElement("button");
          stackAddBtn.className = "icon-btn";
          stackAddBtn.innerHTML = ADD_ICON;
          stackAddBtn.title = "Přidat graf pod";
          stackAddBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleAddStackChart(rowIndex, i, s);
          });
          controls.appendChild(stackAddBtn);

          const stackLockBtn = buildLockButton(
            stackEntry.locked,
            () => handleToggleStackLock(rowIndex, i, s),
            "Odemknout výšku grafu",
            "Zamknout výšku grafu"
          );
          controls.appendChild(stackLockBtn);

          // Remove is always the last (rightmost) control.
          const stackRemoveBtn = document.createElement("button");
          stackRemoveBtn.className = "icon-btn";
          stackRemoveBtn.innerHTML = REMOVE_ICON;
          stackRemoveBtn.title = "Odebrat graf";
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

        return;
      }

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
      const lockBtn = buildLockButton(
        chartStateItem.locked,
        () => handleToggleChartLock(rowIndex, i),
        "Odemknout šířku grafu",
        "Zamknout šířku grafu"
      );
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

      // The resize handle for this pair (if any) is created in a dedicated
      // pass after every chart in this render exists in the DOM — see
      // below. It's appended directly to #canvas as a sibling of the chart
      // elements, not as a child of this one; nesting it inside a chart div
      // meant every position fix had to also account for that chart's own
      // border/padding box-model, which is exactly where earlier attempts
      // kept breaking.

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
      suppressHoverIfCursorOver(lockBtn);
    });
  });

  // Horizontal drag handles between adjacent charts within a vertical stack
  // — the stack counterpart of the chart-width/row-height handle passes
  // below. Skipped for a pair when either neighbor is height-locked, since
  // there'd be nothing left to redistribute the drag into on that side.
  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      if (!item.subCharts) return;
      const chartStateItem = state.chartRows[rowIndex].items[i];
      const canvasRect = canvas.getBoundingClientRect();

      for (let s = 0; s < item.subCharts.length - 1; s++) {
        if (chartStateItem.stack[s].locked || chartStateItem.stack[s + 1].locked) continue;

        const currentEl = document.getElementById(`chart-${rowIndex}-${i}-${s}`);
        const nextEl = document.getElementById(`chart-${rowIndex}-${i}-${s + 1}`);
        if (!currentEl || !nextEl) continue;

        const currentRect = currentEl.getBoundingClientRect();
        const nextRect = nextEl.getBoundingClientRect();
        const midScreenY = (currentRect.bottom + nextRect.top) / 2;

        const handle = document.createElement("div");
        handle.className = "stack-resize-handle";
        handle.style.left = (currentRect.left - canvasRect.left) + "px";
        handle.style.width = currentRect.width + "px";
        handle.style.top = (midScreenY - canvasRect.top) + "px";

        attachStackResizeHandle(handle, rowIndex, i, s, renderLayout);
        canvas.appendChild(handle);
      }
    });
  });

  // Create each row's resize handles as direct children of #canvas — the
  // exact same coordinate system already used successfully for the snap
  // guide line — instead of nesting them inside a chart div. Positioned
  // using each pair's ACTUAL rendered bounding boxes (relative to canvas),
  // which requires every chart element above to already exist in the DOM,
  // hence this running as its own pass afterward rather than inline in the
  // loop above.
  const canvasRect = canvas.getBoundingClientRect();
  chartsLayout.forEach((row, rowIndex) => {
    row.forEach((item, i) => {
      if (i >= row.length - 1) return;

      const currentEl = document.getElementById(`chart-${rowIndex}-${i}`);
      const nextEl = document.getElementById(`chart-${rowIndex}-${i + 1}`);
      if (!currentEl || !nextEl) return;

      const currentRect = currentEl.getBoundingClientRect();
      const nextRect = nextEl.getBoundingClientRect();
      const midScreen = (currentRect.right + nextRect.left) / 2;

      const handle = document.createElement("div");
      handle.className = "chart-resize-handle";
      // Relative to #canvas, exactly like every other canvas child (title,
      // slicers, KPIs, charts, the snap guide) — no chart-parent border or
      // padding to account for, since this is no longer nested inside one.
      handle.style.left = (midScreen - canvasRect.left) + "px";
      handle.style.top = (currentRect.top - canvasRect.top) + "px";
      handle.style.height = currentRect.height + "px";

      attachChartResizeHandle(handle, rowIndex, i, renderLayout);
      canvas.appendChild(handle);
    });
  });

  // Row-height resize handles: one per adjacent pair of chart rows, only
  // when a second row actually exists (chartsLayout.length - 1 iterations —
  // zero if there's only one row, which naturally skips creating any handle
  // at all). Same canvas-sibling + real-DOM-rect approach as the chart-width
  // handles above, just on the vertical axis: the handle spans the full
  // usable width (grab anywhere along the row boundary) and is centered
  // *horizontally* within that span via the grip dots in its CSS, matching
  // how the chart-width handle's grip is centered within its own strip.
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
    rowHandle.style.left = scale(state.MARGIN) + "px";
    rowHandle.style.width = scale(state.USABLE_WIDTH) + "px";
    rowHandle.style.top = (midScreenY - canvasRect.top) + "px";

    attachRowResizeHandle(rowHandle, rowIndex, renderLayout);
    canvas.appendChild(rowHandle);
  }

  renderWarnings();
}