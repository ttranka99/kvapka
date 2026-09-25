// assets/js/ui/legalDialog.js
//
// The privacy policy and terms of use as a modal, so reading them never leaves
// the editor. privacy.html / terms.html stay the only copy of the text: the
// page is fetched, parsed (DOMParser runs no scripts, and it is our own
// same-origin file) and the article for the current language is imported.
//
// If the page can't be fetched (opened from file://, offline) the tab
// navigates to it instead — never a new window.

import { openModal, makeButton } from "./dialog.js";
import { t, getLocale } from "../i18n/i18n.js";

let loading = false;

/**
 * page: "privacy.html" | "terms.html".
 * onBack: called after the modal closes via Back (e.g. reopen About).
 * trigger: the link that was clicked; marked aria-busy while fetching.
 */
export async function openLegal(page, { onBack, trigger } = {}) {
  if (loading) return;
  loading = true;
  if (trigger) {
    trigger.setAttribute("aria-busy", "true");
    trigger.setAttribute("aria-label", t("legal.loading"));
  }

  let article;
  try {
    const res = await fetch(page);
    if (!res.ok) throw new Error(`${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    article = doc.getElementById(getLocale()) || doc.getElementById("cs");
    if (!article) throw new Error("no article");
  } catch {
    location.href = `${page}#${getLocale()}`;
    return;
  } finally {
    loading = false;
    if (trigger) {
      trigger.removeAttribute("aria-busy");
      trigger.removeAttribute("aria-label");
    }
  }

  const titleId = "legal-title";

  const heading = document.createElement("h2");
  heading.id = titleId;
  heading.className = "app-dialog__title";
  heading.textContent = article.querySelector("h1")?.textContent ?? "";

  const meta = document.createElement("p");
  meta.className = "about__meta";
  meta.textContent = article.querySelector(".legal-meta")?.textContent ?? "";

  const body = document.createElement("div");
  body.className = "legal-doc";
  body.tabIndex = 0;
  body.setAttribute("aria-labelledby", titleId);
  const source = article.querySelector(".legal-doc");
  for (const node of source ? source.childNodes : []) {
    body.appendChild(document.importNode(node, true));
  }
  // External sites open in a new tab so the editor stays where it is.
  for (const a of body.querySelectorAll('a[href^="http"]')) {
    a.target = "_blank";
    a.rel = "noopener";
  }

  const actions = document.createElement("div");
  actions.className = "app-dialog__actions";
  const backButton = makeButton(t("legal.back"), "btn-secondary legal-card__back");
  const closeButton = makeButton(t("about.close"), "btn-secondary");
  actions.append(backButton, closeButton);

  const card = document.createElement("div");
  card.className = "app-dialog__card legal-card";
  card.append(heading, meta, body, actions);

  const { close } = openModal({
    card,
    labelledBy: titleId,
    initialFocus: closeButton,
    returnFocus: document.getElementById("about-btn"),
    className: "app-dialog--doc",
  });
  closeButton.addEventListener("click", () => close());
  backButton.addEventListener("click", () => {
    close();
    if (onBack) onBack();
  });
}
