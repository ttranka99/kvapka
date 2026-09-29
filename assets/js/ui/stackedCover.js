// assets/js/ui/stackedCover.js
//
// Below the stacked breakpoint the sidebar panels are sticky under the top
// bar and the sheet scrolls up over them. The browser does the moving (see
// the stacked block in style.css).
//
// Sticky needs two numbers CSS can't know: the top bar height (it wraps to
// two rows here) and the sidebar height (a sidebar taller than the viewport
// must pin by its bottom edge, or its last panel is unreachable). Both are
// kept in custom properties on the root.
//
// It also keeps the sheet steady when the sidebar changes height while
// scrolled (the Šablona fold, selection details opening): the page scrolls by
// the same amount. Browser scroll anchoring could do this, but it may anchor
// to a panel that the fold moves to another grid cell, so it is off in
// style.css and done by hand.
//
// The root carries `cover-recede` while the sheet is short enough for the
// panels' fade to span real scroll. The fade follows the sheet's `contain`
// range (scrollport minus sheet). When the sheet is nearly as tall as the
// scrollport that range collapses and the fade would jump in one step, so it
// is switched off.

// The fade always spans at least this much scroll, or it doesn't run.
const MIN_RECEDE_RUN = 160;

let topbar;
let wrapper;
let app;
let sidebarHeight = null;

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
  app = document.querySelector(".app");
  watch(topbar, "--topbar-h");
  const sidebar = document.querySelector(".sidebar");
  watch(sidebar, "--sidebar-h");
  if (sidebar) new ResizeObserver(() => holdSheet(sidebar.offsetHeight)).observe(sidebar);
  watch(wrapper, null);
  window.addEventListener("resize", syncRecede);
  syncRecede();
}

/** Scrolls by the sidebar's height change, so the sheet doesn't move on
 *  screen. Only while stacked (otherwise the sidebar is its own column) and
 *  only when scrolled (at the top the sheet just follows the panels). Runs in
 *  the same frame as the layout change, so nothing is painted in between. */
function holdSheet(height) {
  const previous = sidebarHeight;
  sidebarHeight = height;
  if (previous === null || window.scrollY <= 0) return;
  if (getComputedStyle(app).flexDirection !== "column") return;
  const delta = height - previous;
  if (delta) window.scrollBy(0, delta);
}

function syncRecede() {
  if (!topbar || !wrapper) return;
  const scrollport = window.innerHeight - topbar.offsetHeight;
  const roomy = wrapper.offsetHeight <= scrollport - MIN_RECEDE_RUN;
  document.documentElement.classList.toggle("cover-recede", roomy);
}
