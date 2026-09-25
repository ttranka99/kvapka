// assets/js/ui/keys.js
//
// Small helpers shared by every keyboard shortcut (state/history.js for undo
// and redo, ui/shortcuts.js for the rest), so they all agree on what counts
// as typing and which letter was pressed.

/** True for elements that take typed text (or a keyboard choice) of their own. */
export function isTextField(el) {
  if (!el || !(el instanceof Element)) return false;
  return el.matches("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
}

// The letter the user pressed. e.key follows the keyboard layout, so the key
// labelled Z undoes on Czech QWERTZ as well as QWERTY. Layouts without Latin
// letters (Cyrillic, Greek) fall back to the physical key.
export function letterOf(e) {
  const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
  if (/^[a-z]$/.test(key)) return key;
  const match = /^Key([A-Z])$/.exec(e.code || "");
  return match ? match[1].toLowerCase() : "";
}

// ⌘ on Apple devices, Ctrl everywhere else — only what the help text shows;
// the handlers accept either modifier on every platform.
export const MOD_LABEL = /Mac|iPhone|iPad/i.test(navigator.userAgentData?.platform || navigator.platform || "")
  ? "⌘"
  : "Ctrl";
