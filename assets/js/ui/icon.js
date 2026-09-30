// assets/js/ui/icon.js
//
// The only way JS puts an icon on screen. Every glyph lives in the inline
// sprite at the top of index.html (<symbol id="i-…">). This returns the <use>
// that references one, so no module keeps its own copy of a path.

/**
 * Markup for one sprite icon, e.g. icon("plus") → <use href="#i-plus">.
 * `className` lands on the <svg> for consumers that size it by class
 * (.toast-icon, .notification-icon).
 */
export function icon(name, className) {
  const cls = className ? ` class="${className}"` : "";
  return `<svg${cls} aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
