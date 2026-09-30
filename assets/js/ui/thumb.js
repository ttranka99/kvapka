// assets/js/ui/thumb.js
//
// The sliding thumb of a segmented control (style.css .has-thumb): one slate
// pill that slides to the chosen option instead of each option lighting its
// own background. Used by every switcher: CS / EN, Studio's scope and slicer
// placement, Customize Elements' types, Custom Layout's placement and a KPI
// band's gap.
//
// Pure CSS maths over equal columns (--thumb-count, --thumb-step). Nothing is
// measured, so it works even while its section is display:none.

const options = group => Array.from(group.children).filter(node => node.tagName === "BUTTON");

/** Turns `group` into a thumbed switcher. The thumb slides only after it has
 *  landed, so the first paint doesn't animate it in from option one. */
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
