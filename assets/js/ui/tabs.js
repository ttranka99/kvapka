import { getTabs, getActiveTabIndex, switchTab, addTab, removeTab, renameTab, MAX_TABS } from "../state/tabs.js";
import { icon } from "./icon.js";
import { reducedMotion, leave } from "./motion.js";
import { t } from "../i18n/i18n.js";
import { scheduleSave } from "../state/persist.js";

let tabBarEl;
let viewportEl;
let addBtnEl;
let scrollBtnEls;
let refreshUI;
let builtSignature = null;   // the tab list the bar was last built from

const scrollBehavior = () => (reducedMotion() ? "auto" : "smooth");

export function initTabsUI(options) {
  refreshUI = options.refreshUI;
  tabBarEl = document.getElementById("tab-bar");
  viewportEl = document.querySelector(".tab-viewport");
  addBtnEl = document.getElementById("tab-add");
  scrollBtnEls = Array.from(document.querySelectorAll(".tab-scroll"));

  // The bar is rebuilt on every change, so what must keep its identity (the
  // + button and the scroller) is wired once here. renderTabBar() only
  // refreshes its state.
  addBtnEl.addEventListener("click", () => {
    if (!addTab()) return;
    const index = getActiveTabIndex();
    renderTabBar({ index, type: "new" });
    refreshUI();
    // A new page opens straight into rename: that is when users want it, and
    // it shows that the pill can be renamed.
    const tabEl = tabBarEl.querySelector(".tab--active");
    if (tabEl) startRename(tabEl, tabEl.querySelector(".tab-label"), index);
  });

  scrollBtnEls.forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.dir === "prev" ? -1 : 1;
      viewportEl.scrollBy({ left: dir * viewportEl.clientWidth * 0.8, behavior: scrollBehavior() });
    });
  });

  viewportEl.addEventListener("scroll", updateScrollAffordances, { passive: true });

  // A mouse wheel only sends deltaY. Without this, users with no trackpad or
  // visible scrollbar can't scroll the strip.
  viewportEl.addEventListener("wheel", e => {
    if (e.deltaX !== 0 || e.deltaY === 0) return;
    if (viewportEl.scrollWidth <= viewportEl.clientWidth) return;
    e.preventDefault();
    viewportEl.scrollLeft += e.deltaY;
  }, { passive: false });

  // Catches window resizes and sidebar/rail width changes at the
  // breakpoints. Both change what fits.
  new ResizeObserver(updateScrollAffordances).observe(viewportEl);

  placeStrip();

  tabBarEl.addEventListener("keydown", onTabKeydown);

  renderTabBar();
}

const signatureOf = tabs => JSON.stringify(tabs.map(tab => [tab.name, tab.named]));

export function renderTabBar(animate) {
  const tabs = getTabs();
  const active = getActiveTabIndex();
  // Closing a page that isn't open re-renders only this bar, not the canvas.
  scheduleSave();

  // Switching pages only changes which pill is lit, so keep the pills and
  // patch their state. That lets the pill's colour transition play (motion.js
  // R4). The signature covers everything the build below derives from the
  // list: while it matches, every pill and closure `index` is still right.
  const signature = signatureOf(tabs);
  if (!animate && signature === builtSignature && !tabBarEl.querySelector(".tab--editing")) {
    Array.from(tabBarEl.children).forEach((tabEl, index) => {
      const isActive = index === active;
      tabEl.classList.toggle("tab--active", isActive);
      tabEl.setAttribute("aria-selected", String(isActive));
      tabEl.tabIndex = isActive ? 0 : -1;
    });
    scrollActiveIntoView();
    updateScrollAffordances();
    return;
  }

  // scrollLeft is lost with the DOM, so carry it over by hand. Otherwise a
  // rename would jump the strip back to the start.
  const savedScroll = viewportEl ? viewportEl.scrollLeft : 0;

  tabBarEl.innerHTML = "";
  builtSignature = signature;

  tabs.forEach((tab, index) => {
    const tabEl = document.createElement("div");
    tabEl.className = "tab" + (index === active ? " tab--active" : "") + (tab.named ? "" : " tab--untitled");
    tabEl.setAttribute("role", "tab");
    tabEl.setAttribute("aria-selected", String(index === active));
    // Roving tabindex: one stop for the whole tablist, arrows move within it.
    tabEl.tabIndex = index === active ? 0 : -1;
    tabEl.dataset.index = String(index);

    // Only the changed tab is animated. The bar is rebuilt on every change,
    // so an animation on the base .tab class would replay on all tabs.
    if (animate && index === animate.index) {
      const animClass = animate.type === "new" ? "m-enter" : "m-flash";
      tabEl.classList.add(animClass);
      tabEl.addEventListener("animationend", () => tabEl.classList.remove(animClass), { once: true });
    }

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    tabEl.appendChild(label);

    if (tabs.length > 1) {
      tabEl.classList.add("tab--closable");
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "icon-circle tab-close";
      closeBtn.innerHTML = icon("close");
      closeBtn.title = t("tabs.close");
      closeBtn.tabIndex = -1;
      closeBtn.addEventListener("click", e => {
        e.stopPropagation();

        const commitRemoval = () => {
          const swapped = removeTab(index);
          renderTabBar();
          if (swapped) refreshUI();
        };

        // Add/rename tag the new DOM after rendering, but a closed tab is
        // destroyed by the render. So play its exit first, then change state
        // and rebuild.
        closeBtn.disabled = true;
        leave(tabEl, commitRemoval);
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener("click", () => {
      if (switchTab(index)) { renderTabBar(); refreshUI(); }
    });
    tabEl.addEventListener("dblclick", () => startRename(tabEl, label, index));
    tabBarEl.appendChild(tabEl);
  });

  addBtnEl.disabled = tabs.length >= MAX_TABS;

  viewportEl.scrollLeft = savedScroll;
  scrollActiveIntoView();
  updateScrollAffordances();
}

/* The strip sits at the top of .main, above the sheet and independent of its
   size, so a page switch doesn't move it. In the stacked layout the sheet
   scrolls away under the panels, so the strip takes its own row of the top
   bar (style.css, max-width: 900px). It is one node that is moved, not
   duplicated, so its listeners and ResizeObserver come along. */
function placeStrip() {
  const strip = viewportEl.parentElement;
  const main = document.querySelector(".main");
  const topbar = document.querySelector(".topbar");

  const stacked = window.matchMedia("(max-width: 900px)");
  const place = () => {
    if (stacked.matches) topbar.insertBefore(strip, topbar.querySelector(".topbar-actions"));
    else main.prepend(strip);
    updateScrollAffordances();
    scrollActiveIntoView();
  };
  place();
  stacked.addEventListener("change", place);
}

/* Scrolls the minimum distance to reveal the active tab. scrollIntoView()
   also scrolls every ancestor, which drags the whole page when stacked.

   Uses rects, not offsetLeft: the tabs' offsetParent is the positioned
   ancestor holding the strip (the sticky .topbar when stacked), not
   .tab-bar, so offsetLeft would have the wrong origin. */
function scrollActiveIntoView(behavior) {
  const activeEl = tabBarEl.querySelector(".tab--active");
  if (!activeEl) return;

  const pad = 8; // keeps the tab clear of the edge fade
  const view = viewportEl.getBoundingClientRect();
  const tab = activeEl.getBoundingClientRect();

  let delta = 0;
  if (tab.left - pad < view.left) delta = tab.left - pad - view.left;
  else if (tab.right + pad > view.right) delta = tab.right + pad - view.right;
  if (delta === 0) return;

  // Snap through the last `pad` pixels at either end, so revealing the first
  // or last tab leaves no sliver of scroll that keeps an arrow lit.
  const max = viewportEl.scrollWidth - viewportEl.clientWidth;
  let left = viewportEl.scrollLeft + delta;
  if (left < pad) left = 0;
  else if (left > max - pad) left = max;

  viewportEl.scrollTo({ left, behavior: behavior || "auto" });
}

/* Arrows and edge fades both show which side has hidden tabs, so both come
   from the scroll position.

   The arrows are added or removed as a pair, using "would the tabs overflow
   even without the arrows?". One at a time would be a feedback loop: an
   arrow appearing narrows the viewport and changes the overflow that
   showed it. At the ends the spare arrow is dimmed, not removed, so the
   strip doesn't change width while scrolling. */
function updateScrollAffordances() {
  if (!viewportEl) return;

  const arrowsShown = !scrollBtnEls[0].hidden;
  const arrowsWidth = arrowsShown
    ? scrollBtnEls.reduce((sum, btn) => sum + btn.getBoundingClientRect().width + 6, 0)
    : 0;
  const needsArrows = tabBarEl.scrollWidth > viewportEl.clientWidth + arrowsWidth + 1;
  scrollBtnEls.forEach(btn => { btn.hidden = !needsArrows; });

  const max = viewportEl.scrollWidth - viewportEl.clientWidth;
  // 1px of slack: fractional widths mean scrollLeft rarely hits 0 or max.
  const canPrev = viewportEl.scrollLeft > 1;
  const canNext = viewportEl.scrollLeft < max - 1;

  viewportEl.classList.toggle("can-scroll-prev", canPrev);
  viewportEl.classList.toggle("can-scroll-next", canNext);

  scrollBtnEls.forEach(btn => {
    btn.disabled = btn.dataset.dir === "prev" ? !canPrev : !canNext;
  });
}

function onTabKeydown(e) {
  const tabEl = e.target.closest(".tab");
  if (!tabEl) return;

  const count = getTabs().length;
  const index = Number(tabEl.dataset.index);
  let next = null;

  if (e.key === "ArrowRight") next = (index + 1) % count;
  else if (e.key === "ArrowLeft") next = (index - 1 + count) % count;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = count - 1;
  else if (e.key === "F2" || e.key === "Enter") {
    e.preventDefault();
    startRename(tabEl, tabEl.querySelector(".tab-label"), index);
    return;
  } else return;

  e.preventDefault();
  if (!switchTab(next)) return;
  renderTabBar();
  refreshUI();
  const focused = tabBarEl.querySelector(".tab--active");
  if (focused) focused.focus();
  scrollActiveIntoView(scrollBehavior());
}

function startRename(tabEl, label, index) {
  if (tabEl.classList.contains("tab--editing")) return;

  // The label stays as the pill's sizer and the input sits over it, so the
  // pill keeps its shape (a fixed-width input would make it jump). Typing is
  // mirrored into the label, so the pill follows the text.
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tab-rename-input";
  input.value = getTabs()[index].name;
  input.maxLength = 40;
  tabEl.classList.add("tab--editing");
  label.appendChild(input);
  input.focus();
  input.select();

  const mirror = () => {
    label.firstChild.textContent = input.value || "​";  // never collapse to 0 width
    updateScrollAffordances();
  };
  input.addEventListener("input", mirror);

  // Ending the edit restores the pill in place instead of rebuilding the bar.
  // The edit usually ends on a mousedown (blur) on another pill. A rebuild
  // then would replace that pill before mouseup, so the click would never
  // fire and switching would take two clicks.
  let finished = false;   // guards against blur firing during DOM teardown
  const finish = changed => {
    if (finished) return;
    finished = true;
    const tab = getTabs()[index];
    // No renderTabBar() here, so save the session directly.
    if (changed) scheduleSave();
    input.remove();
    label.textContent = tab.name;
    tabEl.classList.remove("tab--editing");
    tabEl.classList.toggle("tab--untitled", !tab.named);
    builtSignature = signatureOf(getTabs());
    if (changed) {
      tabEl.classList.add("m-flash");
      tabEl.addEventListener("animationend", () => tabEl.classList.remove("m-flash"), { once: true });
    }
    updateScrollAffordances();
  };
  const commit = () => finish(renameTab(index, input.value));
  const cancel = () => { finish(false); tabEl.focus(); };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", e => {
    e.stopPropagation();          // the tablist's arrow keys are not for typing
    if (e.key === "Enter") { e.preventDefault(); commit(); tabEl.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
  input.addEventListener("click", e => e.stopPropagation());
  input.addEventListener("dblclick", e => e.stopPropagation());
}
