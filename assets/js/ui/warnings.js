import * as state from "../state/state.js";
import { icon } from "./icon.js";
import { leave } from "./motion.js";
import { t, onLocaleChange } from "../i18n/i18n.js";


// Sprite icon per notification type (see the <defs> block in index.html).
const STATUS_ICON = { info: "info", warning: "warning", error: "error" };

// Higher is more serious. The bell takes the colour of the most serious
// notification it is showing, so an error is never dressed as info.
const SEVERITY = { info: 0, warning: 1, error: 2 };

// How long a notification stays as an active on-screen toast before it is
// moved into the bell's notification panel.
const TIMEOUT_MS = 5000;

// Per-message metadata that state.warnings (a plain array of strings) does
// not carry: which type/color/icon it is, and whether its 5s toast timeout
// has already elapsed (movedToPanel). Keyed by the warning message text,
// same as the DOM id hashing below, so it stays in sync with state.warnings
// without needing to change the shape of state.warnings itself.
const meta = new Map();

// Deterministic DOM-safe id derived from the warning text, so a toast can be
// matched, kept, or removed on re-render without needing separate id tracking.
function toastId(msg) {
  let hash = 0;
  for (let i = 0; i < msg.length; i++) {
    hash = (hash * 31 + msg.charCodeAt(i)) | 0;
  }
  return `toast-${Math.abs(hash)}`;
}

// Marks a message as having arrived in the panel, where it stays until the
// underlying condition resolves and its caller clears it from state.warnings.
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

// type: "info" | "warning" | "error". Defaults to "warning" so existing call
// sites that don't pass a type keep working unchanged.
//
// Callers that represent a *persistent condition* (e.g. "second row is over
// the limit") are expected to call this again on every render for as long as
// the condition holds, and to actively clear the same message from
// state.warnings once the condition stops holding (see computeSlicersLayout.js
// / computeKpiLayout.js). Because of that, the same message can legitimately
// recur after having already faded into the panel — e.g. the condition
// becomes true, false, then true again. That recurrence must re-surface the
// toast rather than being silently ignored just because the message string
// is still sitting in state.warnings from its first occurrence.
export function addWarning(msg, type = "warning") {
  if (!state.warnings.includes(msg)) {
    state.setWarnings([...state.warnings, msg]);
    meta.set(msg, { type, addedAt: Date.now(), movedToPanel: false, timerId: startTimeout(msg) });
    renderWarnings();
    ringBell();
    return;
  }

  // Message is still present. If it had already faded into the panel, this
  // call means the underlying condition has recurred — bring it back as an
  // active toast and restart its countdown.
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

// One swing of the bell glyph each time a toast surfaces, so the eye is
// drawn to where the notification will go once its toast has timed out.
// Removing and re-adding the class restarts the animation when toasts
// arrive in quick succession.
function ringBell() {
  const bell = document.getElementById("notification-bell");
  if (!bell) return;
  bell.classList.remove("ringing");
  void bell.offsetWidth;
  bell.classList.add("ringing");
}

// A language switch re-keys every warning under its translated wording. Each
// keeps its type and whether it is still a toast or already in the panel; a
// toast keeps the rest of its countdown, and its element on screen is
// retitled in place rather than faded out and rebuilt.
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

// Keeps `meta` in sync with `state.warnings`, which is the single source of
// truth for which warnings currently exist (mutated directly in some places
// via state.setWarnings()). Called at the top of every renderWarnings() pass.
function syncMeta() {
  // Drop metadata for resolved (removed) warnings and cancel their timers,
  // so a resolved issue disappears from both the toast area and the panel.
  for (const msg of Array.from(meta.keys())) {
    if (!state.warnings.includes(msg)) {
      clearTimeout(meta.get(msg).timerId);
      meta.delete(msg);
    }
  }

  // Anything present in state.warnings without metadata (e.g. set via a
  // direct state.setWarnings() call rather than addWarning()) gets sane
  // defaults, already marked as expired so it appears straight in the panel
  // instead of popping up as a fresh toast with a new 5s timer.
  state.warnings.forEach(msg => {
    if (!meta.has(msg)) {
      meta.set(msg, { type: "warning", addedAt: Date.now(), movedToPanel: true, timerId: null });
    }
  });
}

// A card tinted by type, with the type named above the message and a bar
// along the bottom that runs down over the toast's remaining time, so it is
// clear the toast will go to the bell rather than simply vanish. Errors are
// announced straight away (role="alert"); the rest wait their turn.
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

// Toasts persist until the underlying warning is resolved (i.e. no longer
// present in state.warnings), OR until TIMEOUT_MS elapses, at which point
// they move into the bell's panel instead of disappearing. There's no manual
// close control by design.
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

// Immediately moves every currently-active toast into the panel (instead of
// waiting for its 5s timeout), so opening the panel doesn't leave the same
// notification showing in both places at once. Called when the bell's panel
// is opened.
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

// Whether at least one warning is currently showing as an active toast (as
// opposed to already sitting quietly in the panel). Used to keep the bell
// icon highlighted for as long as there's something new on screen.
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
// notification in the panel, and fills the bell itself (via "pulse-active")
// in the colour of the most serious active toast for as long as at least one
// is on screen — reverting automatically once every toast has either
// resolved or moved into the panel. The bell SVG itself is never modified —
// only these classes and attributes are set.
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
    // Keeps the last count and colour while the badge fades out, so it
    // doesn't blank or turn grey on its way out.
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.dataset.severity = topSeverity(state.warnings);
    }
  }
}

// Rebuilds the full notification list shown inside the bell's panel. Unlike
// the toast area, the panel always lists every current warning (both the
// ones still visible as toasts and the ones that already timed out), so
// nothing is ever lost before it's resolved — and since resolved warnings are
// removed from state.warnings by the caller, they disappear from here too.
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

// Wires up the bell button (toggle panel open/closed) and closes the panel
// when clicking anywhere outside it. Runs once at module load, since the
// bell and panel are persistent DOM elements (not rebuilt by renderLayout).
// The "menu-open" class on the bell keeps its hover-style chrome (rounded
// background) visible for as long as the panel stays open, not just on hover.
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