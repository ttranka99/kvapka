// assets/js/ui/about.js
//
// The About modal, opened from the rail's ⓘ button: version, copyright, a
// GitHub panel for bug reports and ideas, and footer-style links (privacy,
// terms, changelog). It is a modal so the canvas keeps its full height.
//
// Built on every open, so it is always in the current language.

import { openModal, makeButton } from "./dialog.js";
import { openLegal } from "./legalDialog.js";
import { icon } from "./icon.js";
import { t, getLocale } from "../i18n/i18n.js";
import { VERSION } from "../version.js";

const COPYRIGHT_YEAR = 2026;
const OWNER = "ttranka99";
const REPO_PATH = "ttranka99/kvapka";
const REPO_URL = `https://github.com/${REPO_PATH}`;

// The legal pages hold both languages; the hash picks one. A plain click opens
// a modal (ui/legalDialog.js). The href stays for middle-click, "copy link"
// and the fetch-failed fallback.
const LINKS = [
  { key: "about.privacy", href: "privacy.html", legal: true },
  { key: "about.terms", href: "terms.html", legal: true },
  { key: "about.changelog", href: "CHANGELOG.md" },
];

// A new-issue link with the label and body prefilled, so every report names
// its version. GitHub drops the label for users without triage rights.
function issueUrl(label, bodyKey) {
  const body = `${t(bodyKey)}---
${t("about.github.version", { version: VERSION })}
`;
  const params = new URLSearchParams({ labels: label, body });
  return `${REPO_URL}/issues/new?${params}`;
}

function externalLink(href, className, text) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.className = className;
  a.textContent = text;
  return a;
}

// The GitHub mark, the repo, and the two ways to write in: a bug or an idea.
function buildGithubPanel() {
  const mark = document.createElement("span");
  mark.className = "about__github-mark";
  mark.innerHTML = icon("github");

  const title = document.createElement("p");
  title.className = "about__github-title";
  title.textContent = t("about.github.title");

  const repo = externalLink(REPO_URL, "about__github-repo", REPO_PATH);

  const text = document.createElement("p");
  text.className = "about__github-text";
  text.textContent = t("about.github.text");

  const head = document.createElement("div");
  head.className = "about__github-head";
  head.append(title, repo);

  const actions = document.createElement("div");
  actions.className = "about__github-actions";
  actions.append(
    externalLink(issueUrl("bug", "about.github.bugBody"), "btn btn-secondary about__github-btn", t("about.github.bug")),
    externalLink(issueUrl("enhancement", "about.github.ideaBody"), "btn btn-secondary about__github-btn", t("about.github.idea")),
  );

  const panel = document.createElement("section");
  panel.className = "about__github";
  panel.setAttribute("aria-label", t("about.github.title"));
  panel.append(mark, head, text, actions);
  return panel;
}

export function initAbout() {
  const button = document.getElementById("about-btn");
  if (button) button.addEventListener("click", openAbout);
}

export function openAbout() {
  const titleId = "about-title";

  const heading = document.createElement("h2");
  heading.id = titleId;
  heading.className = "app-dialog__title";
  heading.textContent = t("about.title");

  const subtitle = document.createElement("p");
  subtitle.className = "app-dialog__message";
  subtitle.textContent = t("topbar.subtitle");

  const meta = document.createElement("p");
  meta.className = "about__meta";
  const version = document.createElement("span");
  version.textContent = t("about.version", { version: VERSION });
  const copyright = document.createElement("span");
  copyright.textContent = `© ${COPYRIGHT_YEAR} ${OWNER}`;
  meta.append(version, copyright);

  // External links open in a new tab so the editor stays open.
  const links = document.createElement("ul");
  links.className = "about__links";
  for (const { key, href, legal } of LINKS) {
    const a = document.createElement("a");
    a.textContent = t(key);
    if (legal) {
      a.href = `${href}#${getLocale()}`;
      a.addEventListener("click", e => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openLegal(href, { onBack: openAbout, trigger: a });
      });
    } else {
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
    }
    const li = document.createElement("li");
    li.appendChild(a);
    links.appendChild(li);
  }

  const actions = document.createElement("div");
  actions.className = "app-dialog__actions";
  const closeButton = makeButton(t("about.close"), "btn-secondary");
  actions.appendChild(closeButton);

  const card = document.createElement("div");
  card.className = "app-dialog__card";
  card.append(heading, subtitle, meta, buildGithubPanel(), links, actions);

  const { close } = openModal({ card, labelledBy: titleId, initialFocus: closeButton, returnFocus: document.getElementById("about-btn") });
  closeButton.addEventListener("click", () => close());
}
