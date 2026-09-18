// assets/js/ui/icon.js
//
// The only way JS puts an icon on screen. Every glyph lives in the inline
// sprite at the top of index.html (<symbol id="i-…">); this returns the
// <use> that references one, so no module carries its own copy of a path —
// which is how the close "×" ended up defined three times at two different
// stroke weights, and how two buttons ended up with a text "+" instead.

/**
 * Markup for one sprite icon, e.g. icon("plus") → <use href="#i-plus">.
 * `className` lands on the <svg> for consumers that size it by class
 * (.toast-icon, .notification-icon).
 */
export function icon(name, className) {
  const cls = className ? ` class="${className}"` : "";
  return `<svg${cls} aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
