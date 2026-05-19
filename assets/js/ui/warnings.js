import * as state from "../state/state.js";

export function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
  }
}

export function renderWarnings() {
  const warningsEl = document.getElementById("warnings");
  if (!warningsEl) return;

  if (!state.warnings.length) {
    warningsEl.textContent = "Žádná upozornění.";
    return;
  }

  warningsEl.innerHTML = state.warnings
    .map(w => `<div>• ${w}</div>`)
    .join("");
}

