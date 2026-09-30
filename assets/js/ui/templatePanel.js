// assets/js/ui/templatePanel.js
//
// The Šablona panel folds down to its head. The canvas is set up once, then
// the work happens in the selection and add panels, which on a short screen
// would sit below the fold under an unused panel. Folded, a small spec sheet
// (resolution, scope, slicer placement, KPIs per row) stands in for the
// controls. Clicking it opens the panel again.
//
// The fold state is per page, not remembered across visits:
//   - a new page (and so every app load) starts open;
//   - the first real work on the canvas folds it: a pointer on the sheet
//     (selecting, dragging, resizing) or an add button. Changing the setup
//     doesn't count, that is what the open panel is for;
//   - the head toggles it either way, and the next work folds it again;
//   - each page keeps its own state, so a page already worked on comes back
//     folded.
//
// The cross-fade is CSS (the fold section in style.css). The rest is here,
// because CSS can't ease a height between two contents or follow a panel
// that changes grid cell:
//   - the fold's height eases from its current value to the new layer's;
//   - stacked, the folded panel becomes a bar across both columns and moves
//     its two neighbours to other cells. They glide there (motion.js R1) on
//     the same timing, so it reads as one movement.

import * as state from "../state/state.js";
import { placementLabel } from "../theme/themeModel.js";
import { reducedMotion } from "./motion.js";
import { getTabs, getActiveTabIndex } from "../state/tabs.js";
import { t } from "../i18n/i18n.js";

// The sheet with its slicer strip filled, per placement.
const PLACEMENT_GLYPHS = {
  "horizontal": '<rect x="2" y="6" width="12" height="3" rx="1" fill="currentColor"/>',
  "vertical-left": '<rect x="2" y="6" width="3.5" height="7" rx="1" fill="currentColor"/>',
  "vertical-right": '<rect x="10.5" y="6" width="3.5" height="7" rx="1" fill="currentColor"/>',
};

let panel;
let toggle;
let fold;
let body;
let summary;
let heightAnim;
let unfreezeTimer;
// Ids of pages whose panel is folded. Memory only, like the pages.
const foldedPages = new Set();
// Whether the DOM shows a state yet. The first call must always apply one.
let shown = false;

/** A duration token as ms, without the slack motion.js's durationMs() adds
 *  for fallback timeouts. */
function tokenMs(token) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) ? ms : 0;
}

/** The fold's duration and curve, straight from the tokens (R6). */
function motionTiming() {
  const easing = getComputedStyle(document.documentElement).getPropertyValue("--ease-panel").trim();
  return { duration: tokenMs("--slower"), easing: easing || "ease-out" };
}

function isStacked() {
  const app = document.querySelector(".app");
  return !!app && getComputedStyle(app).flexDirection === "column";
}

const activePageId = () => getTabs()[getActiveTabIndex()]?.id;

export function initTemplatePanel() {
  panel = document.querySelector(".panel-template");
  toggle = document.getElementById("template-toggle");
  fold = document.querySelector(".panel-template .template-fold");
  body = document.getElementById("template-body");
  summary = document.getElementById("template-summary");
  if (!panel || !toggle || !fold || !body || !summary) return;

  const flip = () => setTemplateCollapsed(!panel.classList.contains("is-collapsed"));
  toggle.addEventListener("click", flip);
  summary.addEventListener("click", flip);

  // Work on the canvas means the setup is done for now. It folds when the
  // gesture ends, not starts: stacked, the sheet would slide up from under a
  // click or drag still in progress.
  const foldNow = () => setTemplateCollapsed(true);
  // A cancelled gesture (a touch that became a scroll) isn't work.
  document.getElementById("canvas")?.addEventListener("pointerdown", () => {
    const end = e => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (e.type === "pointerup") foldNow();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
  document.querySelector(".add-elements")?.addEventListener("click", e => {
    if (e.target.closest("button")) foldNow();
  });

  // The state a page loads with isn't a change, so no animation.
  panel.classList.add("is-instant");
  syncTemplateFoldForPage();
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove("is-instant")));
}

/** Shows the active page's fold (open for a page not worked on yet). Called
 *  whenever another page comes up. */
export function syncTemplateFoldForPage() {
  setTemplateCollapsed(foldedPages.has(activePageId()));
}

export function setTemplateCollapsed(collapsed) {
  if (!panel) return;
  const id = activePageId();
  if (collapsed) foldedPages.add(id);
  else foldedPages.delete(id);

  // Every pointer on the canvas lands here. Most find the panel folded.
  if (shown && panel.classList.contains("is-collapsed") === collapsed) return;
  const animate = shown && !panel.classList.contains("is-instant") && !reducedMotion();
  shown = true;

  const incoming = collapsed ? summary : body;
  const outgoing = collapsed ? body : summary;

  const panels = panel.parentElement;
  glideNeighbours(animate, () => {
    const from = fold.getBoundingClientRect().height;
    const panelsBefore = isStacked() ? panels.getBoundingClientRect().height : null;
    heightAnim?.cancel();

    // The outgoing layer keeps its width while fading. Stacked, the panel
    // changes width with the fold and its text would rewrap mid-fade.
    clearTimeout(unfreezeTimer);
    incoming.style.width = "";
    outgoing.style.width = animate ? `${outgoing.getBoundingClientRect().width}px` : "";
    unfreezeTimer = setTimeout(() => { outgoing.style.width = ""; }, tokenMs("--fast"));

    // Hold the current height while the layers swap and read the target from
    // the incoming layer. The page must not lay out at the new height ahead
    // of the animation: it could be hundreds of px shorter and the browser
    // would clamp the scroll.
    if (animate) fold.style.height = `${from}px`;

    panel.classList.toggle("is-collapsed", collapsed);
    incoming.classList.replace("is-out", "is-in");
    outgoing.classList.replace("is-in", "is-out");

    if (!animate) return;
    const to = incoming.getBoundingClientRect().height;
    const start = panelsBefore === null ? from : stackedStart(from, to, panelsBefore);
    fold.style.height = "";
    if (Math.abs(to - start) < 1) return;
    fold.classList.add("is-animating");
    heightAnim = fold.animate([{ height: `${start}px` }, { height: `${to}px` }], motionTiming());
    const done = () => fold.classList.remove("is-animating");
    heightAnim.onfinish = done;
    heightAnim.oncancel = done;
  });

  toggle.setAttribute("aria-expanded", String(!collapsed));
  // The outgoing layer is only faded and hidden. inert removes its controls
  // from the tab order and screen readers at once.
  incoming.inert = false;
  outgoing.inert = true;
  syncTemplateSummary();
}

/** Stacked, the swap also moves the other panels to other cells: folding
 *  drops them into a row under the bar, opening lifts them into the right
 *  column. From the fold's old height that would change the sidebar height
 *  in one frame and jolt the sheet. So the height starts at whatever keeps
 *  the sidebar as tall as it was, then eases to `to`, staying between `from`
 *  and `to` so it never runs backwards. */
function stackedStart(from, to, panelsBefore) {
  const panels = panel.parentElement;
  const clamp = v => Math.min(Math.max(v, Math.min(from, to)), Math.max(from, to));

  // Folding: the new row under the bar adds its height 1:1.
  let start = clamp(from - (panels.getBoundingClientRect().height - panelsBefore));
  fold.style.height = `${start}px`;

  // Opening: the right column can be taller and the grid stretches the panel
  // to it, so the sidebar follows the fold only once the panel's own content
  // (up to the fold's bottom) is as tall as the sidebar was.
  if (panels.getBoundingClientRect().height < panelsBefore - 0.5) {
    const top = panel.getBoundingClientRect().top;
    const content = fold.getBoundingClientRect().bottom - top + parseFloat(getComputedStyle(panel).paddingBottom);
    start = clamp(start + panelsBefore - content);
  }
  return start;
}

/** FLIP for the stacked layout, where the fold moves the other panels to
 *  another grid cell. They are measured, `change` runs, and each eases back
 *  from its old spot on the fold's duration and curve, so it joins the height
 *  change as one glide. Beside the sheet nothing changes cell and this just
 *  runs `change`. A glide caught mid-way is measured where it shows, so it
 *  turns around without a jump. */
function glideNeighbours(animate, change) {
  if (!animate || !isStacked()) {
    change();
    return;
  }
  const others = [...panel.parentElement.children].filter(el => el !== panel);
  const before = others.map(el => el.getBoundingClientRect());
  others.forEach(el => el._glide?.cancel());
  change();
  const timing = motionTiming();
  others.forEach((el, i) => {
    const after = el.getBoundingClientRect();
    const dx = before[i].left - after.left;
    const dy = before[i].top - after.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el._glide = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      timing
    );
  });
}

/** Fills the spec sheet from the controls' state. Kept current even when
 *  hidden, so a fold never shows stale values. */
export function syncTemplateSummary() {
  if (!summary) return;
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("sum-res", state.activeTheme.label);
  set("sum-size", `${state.CANVAS_WIDTH} × ${state.CANVAS_HEIGHT}`);
  set("sum-scope", document.querySelector(".theme-scope-option.active")?.textContent.trim() ?? "");

  const placement = state.activeTheme.placement;
  const where = placementLabel(placement);
  set("sum-placement", state.isVerticalSlicers() ? where : t("template.summary.placementPerRow", { placement: where, count: state.MAX_SLICERS }));
  const glyph = document.getElementById("sum-placement-glyph");
  if (glyph) {
    glyph.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><rect x="1.25" y="3.25" width="13.5" height="10.5" rx="1.75" stroke="currentColor" stroke-width="1.5"/>${PLACEMENT_GLYPHS[placement] || PLACEMENT_GLYPHS.horizontal}</svg>`;
  }

  set("sum-kpi", t("template.summary.perRow", { count: state.MAX_KPIS }));
}
