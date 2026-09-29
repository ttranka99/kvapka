// assets/js/ui/help.js
//
// Help, opened from the rail's ? button or the ? key: the three steps, how to
// bring the export into Power BI (where people get stuck) and the keyboard
// shortcuts. Also the welcome shown once on a first visit (the same steps).
//
// Both are built on every open, so they are always in the current language.
// Text comes from the locale files; a `backticked` part is shown as code.

import { openModal, makeButton } from "./dialog.js";
import { SHORTCUTS } from "./shortcuts.js";
import { storageAvailable } from "../state/persist.js";
import { t } from "../i18n/i18n.js";

// Set once the welcome has been shown.
const WELCOME_KEY = "kvapka-onboarded-v1";

const STEPS = ["help.step1", "help.step2", "help.step3"];
const IMPORT_STEPS = ["help.import.step1", "help.import.step2", "help.import.step3", "help.import.step4", "help.import.step5"];

export function initHelp() {
  const button = document.getElementById("help-btn");
  if (button) button.addEventListener("click", () => openHelp({ returnFocus: button }));
}

// Text with `backticked` parts as <code>. Everything goes in as textContent.
function rich(tag, text, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  text.split("`").forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      const code = document.createElement("code");
      code.textContent = part;
      el.appendChild(code);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
  return el;
}

// The three steps as a numbered list: a bold title, then what to do.
function stepList() {
  const list = document.createElement("ol");
  list.className = "help-steps";
  for (const key of STEPS) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = t(`${key}.title`);
    li.append(title, rich("span", t(`${key}.text`)));
    list.appendChild(li);
  }
  return list;
}

function keyCombo(combo) {
  const span = document.createElement("span");
  span.className = "help-combo";
  combo.forEach((key, i) => {
    if (i > 0) span.appendChild(document.createTextNode("+"));
    const kbd = document.createElement("kbd");
    kbd.textContent = key;
    span.appendChild(kbd);
  });
  return span;
}

function shortcutTable() {
  const wrap = document.createElement("div");
  wrap.className = "legal-table";
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const key of ["help.keys.colKeys", "help.keys.colAction"]) {
    const th = document.createElement("th");
    th.textContent = t(key);
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const { keys, text } of SHORTCUTS) {
    const row = body.insertRow();
    const keysCell = row.insertCell();
    keysCell.className = "help-keys";
    keys.forEach((combo, i) => {
      if (i > 0) keysCell.appendChild(document.createTextNode(" "));
      keysCell.appendChild(keyCombo(combo));
    });
    row.insertCell().textContent = t(text);
  }
  wrap.appendChild(table);
  return wrap;
}

function heading(key) {
  const h = document.createElement("h2");
  h.textContent = t(key);
  return h;
}

/**
 * section: "import" scrolls the Power BI guide into view.
 * returnFocus: where focus goes on close (the focused element otherwise).
 */
export function openHelp({ section, returnFocus } = {}) {
  const titleId = "help-title";

  const title = document.createElement("h2");
  title.id = titleId;
  title.className = "app-dialog__title";
  title.textContent = t("help.title");

  const body = document.createElement("div");
  body.className = "legal-doc help-doc";
  body.tabIndex = 0;
  body.setAttribute("aria-labelledby", titleId);

  const importSteps = document.createElement("ol");
  for (const key of IMPORT_STEPS) importSteps.appendChild(rich("li", t(key)));

  const importHeading = heading("help.import.title");
  body.append(
    heading("help.how.title"),
    stepList(),
    rich("p", t("help.how.note"), "help-note"),
    importHeading,
    rich("p", t("help.import.intro")),
    importSteps,
    rich("p", t("help.import.note"), "help-note"),
    heading("help.keys.title"),
    shortcutTable(),
  );

  const actions = document.createElement("div");
  actions.className = "app-dialog__actions";
  const closeButton = makeButton(t("about.close"), "btn-secondary");
  actions.appendChild(closeButton);

  const card = document.createElement("div");
  card.className = "app-dialog__card legal-card";
  card.append(title, body, actions);

  const { close } = openModal({
    card,
    labelledBy: titleId,
    initialFocus: closeButton,
    returnFocus,
    className: "app-dialog--doc",
  });
  closeButton.addEventListener("click", () => close());

  // Both sit in the same offset parent, so this ignores the entry animation's
  // transform.
  if (section === "import") body.scrollTop = importHeading.offsetTop - body.offsetTop;
}

function welcomeSeen() {
  try {
    return localStorage.getItem(WELCOME_KEY) !== null;
  } catch {
    return true;
  }
}

function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // Can't be remembered; storageAvailable() kept us from getting here.
  }
}

/**
 * Opens the welcome on a first visit: nothing was restored and it hasn't been
 * shown before. It stays closed where the browser keeps no data, or it would
 * show on every visit.
 */
export function maybeShowWelcome({ restored }) {
  if (restored || !storageAvailable() || welcomeSeen()) return;
  // Marked on open, so a reload mid-welcome doesn't repeat it.
  markWelcomeSeen();

  const titleId = "welcome-title";
  const introId = "welcome-intro";

  const title = document.createElement("h2");
  title.id = titleId;
  title.className = "app-dialog__title";
  title.textContent = t("welcome.title");

  const intro = document.createElement("p");
  intro.id = introId;
  intro.className = "app-dialog__message";
  intro.textContent = t("welcome.intro");

  const note = rich("p", t("help.how.note"), "app-dialog__message help-note");

  const actions = document.createElement("div");
  actions.className = "app-dialog__actions";
  const guideButton = makeButton(t("welcome.guide"), "btn-secondary");
  const startButton = makeButton(t("welcome.start"), "btn-primary");
  actions.append(guideButton, startButton);

  const card = document.createElement("div");
  card.className = "app-dialog__card welcome-card";
  card.append(title, intro, stepList(), note, actions);

  const { close } = openModal({
    card,
    labelledBy: titleId,
    describedBy: introId,
    initialFocus: startButton,
  });
  startButton.addEventListener("click", () => close());
  guideButton.addEventListener("click", () => {
    close();
    openHelp({ returnFocus: document.getElementById("help-btn") });
  });
}
