// assets/js/ui/stackedCover.js
//
// Below the stacked breakpoint the sidebar panels pin under the top bar
// (position: sticky) and the sheet scrolls up over them at the page's own
// speed — the browser does all the moving, so it is smooth, reversible and
// unbothered by the page changing height. See the stacked block in
// style.css.
//
// Sticky needs two numbers CSS cannot know on its own: how tall the top bar
// is (it wraps to two rows in this layout) and how tall the sidebar is (one
// taller than the viewport has to pin by its bottom edge, or its last panel
// could never be reached). Both are kept in custom properties on the root.
//
// The root also carries `cover-recede` while the sheet is short enough for
// the panels' fade to run over a real stretch of scroll. The fade is tied to
// the sheet's `contain` range, whose length is the scrollport minus the
// sheet; with a sheet nearly as tall as the scrollport that range collapses
// and the fade would land in one step, so it is switched off instead.

// The fade always spans at least this much scroll, or it doesn't run.
const MIN_RECEDE_RUN = 160;

let topbar;
let wrapper;

export function initStackedCover() {
  if (typeof ResizeObserver !== "function") return;
  topbar = document.querySelector(".topbar");
  wrapper = document.getElementById("canvas-wrapper");
  const root = document.documentElement.style;

  const watch = (el, prop) => {
    if (!el) return;
    new ResizeObserver(() => {
      if (prop) root.setProperty(prop, `${el.offsetHeight}px`);
      syncRecede();
    }).observe(el);
  };
  watch(topbar, "--topbar-h");
  watch(document.querySelector(".sidebar"), "--sidebar-h");
  watch(wrapper, null);
  window.addEventListener("resize", syncRecede);
  syncRecede();
}

function syncRecede() {
  if (!topbar || !wrapper) return;
  const scrollport = window.innerHeight - topbar.offsetHeight;
  const roomy = wrapper.offsetHeight <= scrollport - MIN_RECEDE_RUN;
  document.documentElement.classList.toggle("cover-recede", roomy);
}
