import * as state from "../state/state.js";
import { icon } from "./icon.js";
import { leave } from "./motion.js";
import { t, onLocaleChange } from "../i18n/i18n.js";


// Sprite icon per notification type (see the <defs> block in index.html).
const STATUS_ICON = { info: "info", warning: "warning", error: "error" };

// Higher is more serious. The bell takes the colour of the most serious
// notification, so an error never looks like info.
const SEVERITY = { info: 0, warning: 1, error: 2 };

// How long a toast stays on screen before it moves into the bell's panel.
const TIMEOUT_MS = 5000;

// Per-message metadata that state.warnings (a plain array of strings) can't
// hold: its type/color/icon, and whether its toast timeout has elapsed
// (movedToPanel). Keyed by the message text, like the DOM ids below.
const meta = new Map();

// A DOM-safe id derived from the warning text, so a toast can be matched on
// re-render without separate id tracking.
function toastId(msg) {
  let hash = 0;
  for (let i = 0; i < msg.length; i++) {
    hash = (hash * 31 + msg.charCodeAt(i)) | 0;
  }
  return `toast-${Math.abs(hash)}`;
}

// Moves a message into the panel, where it stays until its caller clears it
// from state.warnings.
function moveToPanel(msg) {
  const m = meta.get(msg);
  if (!m) return;

  m.movedToPanel = true;
}

function startTimeout(msg) {
  return setTimeout(() => {
    moveToPanel(msg);
    renderWarnings();
  }, TIMEOUT_MS);
}

// type: "info" | "warning" | "error". Defaults to "warning".
//
// A persistent condition (e.g. "second row is over the limit") calls this on
// every render while it holds, and clears the message from state.warnings
// when it stops (see computeSlicersLayout.js / computeKpiLayout.js). So the
// same message can recur after it already moved into the panel (true, false,
// true again). The recurrence must bring the toast back, even though the
// string is still in state.warnings from before.
export function addWarning(msg, type = "warning") {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
    meta.set(msg, { type, addedAt: Date.now(), movedToPanel: false, timerId: startTimeout(msg) });
    renderWarnings();
    ringBell();
    return;
  }

  // Already present. If it had moved into the panel, the condition has
  // recurred: bring it back as a toast and restart its countdown.
  const m = meta.get(msg);
  if (m && m.movedToPanel) {
    clearTimeout(m.timerId);
    m.movedToPanel = false;
    m.type = type;
    m.timerId = startTimeout(msg);
    m.addedAt = Date.now();
    renderWarnings();
    ringBell();
  }
}

// One swing of the bell each time a toast surfaces, to draw the eye to where
// it will go. Removing and re-adding the class restarts the animation when
// toasts arrive in quick succession.
function ringBell() {
  const bell = document.getElementById("notification-bell");
  if (!bell) return;
  bell.classList.remove("ringing");
  void bell.offsetWidth;
  bell.classList.add("ringing");
}

// A language switch re-keys every warning under its translated text. Each
// keeps its type and toast/panel state. A toast keeps the rest of its
// countdown and is retitled in place, not rebuilt.
onLocaleChange(convert => {
  const now = Date.now();
  const next = new Map();
  meta.forEach((m, msg) => {
    const text = convert(msg);
    clearTimeout(m.timerId);
    const toast = document.getElementById(toastId(msg));
    if (toast) {
      toast.id = toastId(text);
      toast.querySelector(".toast-message").textContent = text;
      toast.querySelector(".toast-label").textContent = t(`notifications.type.${m.type}`);
    }
    const timerId = m.movedToPanel
      ? null
      : setTimeout(() => { moveToPanel(text); renderWarnings(); }, Math.max(0, TIMEOUT_MS - (now - m.addedAt)));
    next.set(text, { ...m, timerId });
  });
  meta.clear();
  next.forEach((m, text) => meta.set(text, m));
  state.setWarnings(state.warnings.map(convert));
  renderWarnings();
});

// Keeps `meta` in sync with `state.warnings`, the single source of truth for
// which warnings exist (some code sets it directly via state.setWarnings()).
// Called at the top of every renderWarnings() pass.
function syncMeta() {
  // Drop metadata and timers for resolved warnings, so they leave both the
  // toast area and the panel.
  for (const msg of Array.from(meta.keys())) {
    if (!state.warnings.includes(msg)) {
      clearTimeout(meta.get(msg).timerId);
      meta.delete(msg);
    }
  }

  // A warning with no metadata (set via state.setWarnings(), not
  // addWarning()) gets defaults and goes straight to the panel, not a fresh
  // toast with a new timer.
  state.warnings.forEach(msg => {
    if (!meta.has(msg)) {
      meta.set(msg, { type: "warning", addedAt: Date.now(), movedToPanel: true, timerId: null });
    }
  });
}

// A card tinted by type, with the type above the message and a bottom bar
// that runs down over the toast's remaining time, showing it will go to the
// bell and not just vanish. Errors are announced at once (role="alert");
// the rest wait their turn.
function buildToast(msg, type, addedAt) {
  const toast = document.createElement("div");
  toast.id = toastId(msg);
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.style.setProperty("--toast-life", `${TIMEOUT_MS}ms`);
  toast.style.setProperty("--toast-elapsed", `${-Math.min(TIMEOUT_MS, Date.now() - addedAt)}ms`);

  toast.innerHTML = `
    <span class="toast-badge">${icon(STATUS_ICON[type] || "warning", "toast-icon")}</span>
    <div class="toast-body">
      <div class="toast-label"></div>
      <div class="toast-message"></div>
    </div>
    <span class="toast-countdown" aria-hidden="true"></span>
  `;
  toast.querySelector(".toast-label").textContent = t(`notifications.type.${type}`);
  toast.querySelector(".toast-message").textContent = msg;

  return toast;
}

function buildPanelItem(msg, type) {
  const item = document.createElement("div");
  item.className = `notification-item notification-${type}`;

  item.innerHTML = `
    ${icon(STATUS_ICON[type] || "warning", "notification-icon")}
    <div class="notification-message"></div>
  `;
  item.querySelector(".notification-message").textContent = msg;

  return item;
}

// A toast stays until its warning is resolved (gone from state.warnings) or
// TIMEOUT_MS passes, when it moves into the bell's panel. There is
// deliberately no close button.
function renderToasts() {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const activeMsgs = state.warnings.filter(msg => !meta.get(msg)?.movedToPanel);
  const activeIds = new Set(activeMsgs.map(toastId));

  Array.from(container.children).forEach(toastEl => {
    if (activeIds.has(toastEl.id) || toastEl.classList.contains("m-leave")) return;
    leave(toastEl, () => toastEl.remove());
  });

  activeMsgs.forEach(msg => {
    const id = toastId(msg);
    if (document.getElementById(id)) return;
    const m = meta.get(msg);
    container.appendChild(buildToast(msg, m?.type || "warning", m?.addedAt ?? Date.now()));
  });
}

// Moves every active toast into the panel at once, so opening the panel
// doesn't show the same notification in both places. Called when the panel
// opens.
function collapseActiveToastsToPanel() {
  let changed = false;
  meta.forEach((m, msg) => {
    if (!m.movedToPanel) {
      clearTimeout(m.timerId);
      moveToPanel(msg);
      changed = true;
    }
  });
  if (changed) renderWarnings();
}

// Whether any warning is showing as an active toast (not yet in the panel).
// Keeps the bell highlighted while something new is on screen.
function hasActiveToast() {
  return state.warnings.some(msg => !meta.get(msg)?.movedToPanel);
}

// The most serious type among the given messages, or null for none.
function topSeverity(msgs) {
  let top = null;
  msgs.forEach(msg => {
    const type = meta.get(msg)?.type || "warning";
    if (top === null || SEVERITY[type] > SEVERITY[top]) top = type;
  });
  return top;
}

// Shows the count badge on the bell, coloured by the most serious
// notification in the panel. While a toast is on screen it also fills the
// bell ("pulse-active") in the colour of the most serious active toast. The
// bell SVG is never modified, only these classes and attributes.
function renderBell() {
  const bell = document.getElementById("notification-bell");
  if (!bell) return;
  const count = state.warnings.length;
  bell.classList.toggle("has-notifications", count > 0);
  bell.classList.toggle("pulse-active", hasActiveToast());

  const active = state.warnings.filter(msg => !meta.get(msg)?.movedToPanel);
  bell.dataset.severity = topSeverity(active) || "info";

  const badge = bell.querySelector(".notification-badge");
  if (badge) {
    // Keep the last count and colour while the badge fades out, so it
    // doesn't blank or turn grey.
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.dataset.severity = topSeverity(state.warnings);
    }
  }
}

// Rebuilds the notification list in the bell's panel. Unlike the toast area,
// it lists every current warning (toasts and timed-out ones), so nothing is
// lost before it's resolved. Resolved ones leave when the caller clears them
// from state.warnings.
function renderPanel() {
  const list = document.getElementById("notification-list");
  if (!list) return;
  list.innerHTML = "";

  if (state.warnings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notification-empty";
    empty.textContent = t("notifications.empty");
    list.appendChild(empty);
    return;
  }

  state.warnings.forEach(msg => {
    list.appendChild(buildPanelItem(msg, meta.get(msg)?.type || "warning"));
  });
}

export function renderWarnings() {
  syncMeta();
  renderToasts();
  renderBell();
  renderPanel();
}

// Wires the bell button (toggles the panel) and closes the panel on a click
// outside it. Runs once at module load, since the bell and panel aren't
// rebuilt by renderLayout. The "menu-open" class keeps the bell's hover
// chrome (rounded background) visible while the panel is open.
function initBell() {
  const bell = document.getElementById("notification-bell");
  const panel = document.getElementById("notification-panel");
  if (!bell || !panel) return;

  bell.addEventListener("animationend", () => bell.classList.remove("ringing"));

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.toggle("open");
    bell.classList.toggle("menu-open", isOpen);
    if (isOpen) collapseActiveToastsToPanel();
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("open")) return;
    if (panel.contains(e.target) || bell.contains(e.target)) return;
    panel.classList.remove("open");
    bell.classList.remove("menu-open");
  });
}

initBell();