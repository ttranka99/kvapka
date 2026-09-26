// assets/js/ui/thumb.js
//
// The sliding thumb of a segmented control (style.css .has-thumb): one slate
// pill that slides to the chosen option, rather than each option lighting its
// own background — the same object moving is what reads as a switch. Every
// switcher in the app uses it: the CS / EN switch, Studio's scope and slicer
// placement, Customize Elements' types, Custom Layout's placement and a KPI
// band's gap.
//
// Pure CSS maths over equal columns (--thumb-count, --thumb-step), nothing is
// measured, so it is right even while its section is display:none.

const options = group => Array.from(group.children).filter(node => node.tagName === "BUTTON");

/** Turns `group` into a thumbed switcher. The thumb only slides once it has
 *  landed, so the first paint doesn't show it travelling in from option one. */
export function initThumb(group) {
  group.classList.add("has-thumb");
  group.style.setProperty("--thumb-count", String(options(group).length));
  syncThumb(group);
  requestAnimationFrame(() => requestAnimationFrame(() => { group.dataset.ready = ""; }));
}

/** Moves the thumb under whichever option carries .active / .is-active. */
export function syncThumb(group) {
  const index = options(group).findIndex(b => b.classList.contains("active") || b.classList.contains("is-active"));
  group.style.setProperty("--thumb-step", String(Math.max(0, index)));
}
