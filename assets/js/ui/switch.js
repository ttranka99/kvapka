// assets/js/ui/switch.js
//
// The app's one on/off control: a pill with a thumb that slides across,
// pink when on. Used wherever a setting is simply on or off — the Customize
// Elements fields and group heads, the layout editor's KPI band "Second
// Row" — so the same choice never looks two ways. Styled in style.css
// (.switch).

/**
 * @param {object} options
 * @param {string} options.label      accessible name (the visible label
 *                                    usually sits beside it, outside)
 * @param {(on: boolean) => void} options.onToggle  called with the new state
 * @param {string} [options.id]
 * @returns {{ node: HTMLButtonElement, set: (on: boolean) => void }}
 */
export function createSwitch({ label, onToggle, id }) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "switch";
  node.setAttribute("role", "switch");
  node.setAttribute("aria-checked", "false");
  node.setAttribute("aria-label", label);
  if (id) node.id = id;

  const thumb = document.createElement("span");
  thumb.className = "switch__thumb";
  node.appendChild(thumb);

  node.addEventListener("click", e => {
    // A switch in a clickable row or head must not also fire the row.
    e.stopPropagation();
    onToggle(node.getAttribute("aria-checked") !== "true");
  });

  return {
    node,
    set: on => node.setAttribute("aria-checked", String(on === true))
  };
}
