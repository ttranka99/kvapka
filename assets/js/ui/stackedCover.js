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
// It also keeps the sheet steady when the sidebar changes height while the
// page is scrolled (the Šablona fold, the selection details opening): the
// page scrolls by the same amount, so the sheet stays where the user is
// looking. That is what the browser's scroll anchoring is for, but it may
// anchor to a panel inside the sidebar instead, and the fold moves those to
// other grid cells — so it is off here (style.css) and done by hand.
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

/** Scrolls by however much the sidebar just changed height, so the sheet
 *  under it doesn't move on screen. Only while stacked (beside the sheet the
 *  sidebar is a column of its own) and only when scrolled: at the top there
 *  is nothing to hold, and the sheet simply follows the panels. Runs in the
 *  same frame as the layout that changed, so nothing is painted in between. */
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
