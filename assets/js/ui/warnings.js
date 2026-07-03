import * as state from "../state/state.js";

const WARNING_ICON = `<path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

export function addWarning(msg) {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
    // Immediately update the toasts when a new warning is added
    renderWarnings();
  }
}

// Deterministic DOM-safe id derived from the warning text, so a toast can be
// matched, kept, or removed on re-render without needing separate id tracking.
function toastId(msg) {
  let hash = 0;
  for (let i = 0; i < msg.length; i++) {
    hash = (hash * 31 + msg.charCodeAt(i)) | 0;
  }
  return `toast-${Math.abs(hash)}`;
}

function buildToast(msg) {
  const toast = document.createElement("div");
  toast.id = toastId(msg);
  toast.className = "toast";
  toast.setAttribute("role", "status");

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" aria-hidden="true">${WARNING_ICON}</svg>
    <div class="toast-message"></div>
  `;
  toast.querySelector(".toast-message").textContent = msg;

  return toast;
}

// Toasts persist until the underlying warning is resolved (i.e. no longer
// present in state.warnings) — there's no manual close control by design.
export function renderWarnings() {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const activeIds = new Set(state.warnings.map(toastId));

  Array.from(container.children).forEach(toastEl => {
    if (activeIds.has(toastEl.id)) return;

    toastEl.classList.add("toast-leaving");
    toastEl.addEventListener("animationend", () => toastEl.remove(), { once: true });
  });

  state.warnings.forEach(msg => {
    const id = toastId(msg);
    if (document.getElementById(id)) return;
    container.appendChild(buildToast(msg));
  });
}