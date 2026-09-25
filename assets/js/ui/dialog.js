// assets/js/ui/dialog.js
//
// The app's own modals: a confirm dialog in place of window.confirm() —
// styled like the rest of the app, translated, and not subject to a browser's
// "prevent this page from creating additional dialogs" switch or a policy
// that silences native dialogs (where confirm() quietly returns false) — and
// the shell it is built on, which other modals (ui/about.js) share.
//
// Built on <dialog>.showModal(): the browser keeps focus inside, makes the
// page behind it inert and puts it in the top layer above every z-index. All
// text goes in through textContent — a template's name is user input.

import { leave } from "./motion.js";
import { t } from "../i18n/i18n.js";

let current = null;

/**
 * Shows `card` in a modal. Escape, a click on the backdrop or another modal
 * opening over it all close it; so does calling the returned close(). Every
 * way out ends in onClose(value) exactly once — value is whatever close()
 * was given, or undefined for a dismissal.
 *
 * labelledBy / describedBy: ids of elements inside the card.
 * initialFocus: the element focused on open (the dialog itself otherwise).
 * returnFocus: where focus goes on close (the previously focused element otherwise).
 * className: extra class(es) for the <dialog>, e.g. a wider variant.
 */
export function openModal({ card, labelledBy, describedBy, role, initialFocus, className, returnFocus: returnTo, onClose }) {
  if (current) current.close();

  const returnFocus = returnTo || document.activeElement;

  const dialog = document.createElement("dialog");
  dialog.className = className ? `app-dialog m-enter ${className}` : "app-dialog m-enter";
  if (labelledBy) dialog.setAttribute("aria-labelledby", labelledBy);
  if (describedBy) dialog.setAttribute("aria-describedby", describedBy);
  if (role) dialog.setAttribute("role", role);

  // The card is a child, so the <dialog> box itself is only the backdrop's
  // hit area (see the click handler below).
  dialog.appendChild(card);

  let closed = false;
  const close = value => {
    if (closed) return;
    closed = true;
    if (current && current.dialog === dialog) current = null;
    leave(dialog, () => {
      if (dialog.open) dialog.close();
      dialog.remove();
      // Back to where the user was, unless that element went away meanwhile
      // or another modal took over. Only now: while the dialog is still
      // modal the page behind it is inert and focus() would be ignored, and
      // close() itself refocuses whatever was focused before showModal().
      if (!current && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
    });
    if (onClose) onClose(value);
  };
  current = { dialog, close: () => close() };

  // A modal answers its own keys: nothing behind it (the template editor's
  // Escape-to-close, the undo shortcuts) may react while it is open.
  dialog.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  // Escape reaching the dialog some other way (a close request from the
  // browser or assistive tech) is still a dismissal.
  dialog.addEventListener("cancel", e => {
    e.preventDefault();
    close();
  });
  // A click on the backdrop lands on the <dialog> itself; one inside the
  // card lands on a child. The press has to start there too, so selecting
  // the text and releasing outside the card doesn't dismiss it.
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", e => { pressedBackdrop = e.target === dialog; });
  dialog.addEventListener("click", e => {
    if (e.target === dialog && pressedBackdrop) close();
  });

  document.body.appendChild(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  if (initialFocus) initialFocus.focus();

  return { close };
}

/**
 * Asks a yes/no question. Resolves true only when the confirm button is
 * pressed; Escape, Cancel, a click on the backdrop or another dialog opening
 * over it all resolve false.
 *
 * danger: styles the confirm button as destructive and puts the initial
 * focus on Cancel, so a stray Enter never deletes anything.
 */
export function confirmDialog({ title, message, confirmLabel, cancelLabel = t("dialog.cancel"), danger = false }) {
  return new Promise(resolve => {
    const titleId = "app-dialog-title";
    const messageId = "app-dialog-message";

    const heading = document.createElement("h2");
    heading.id = titleId;
    heading.className = "app-dialog__title";
    heading.textContent = title;

    const body = document.createElement("p");
    body.id = messageId;
    body.className = "app-dialog__message";
    body.textContent = message;

    const actions = document.createElement("div");
    actions.className = "app-dialog__actions";
    const cancel = makeButton(cancelLabel, "btn-secondary");
    const confirm = makeButton(confirmLabel, danger ? "btn-danger app-dialog__danger" : "btn-primary");
    actions.append(cancel, confirm);

    const card = document.createElement("div");
    card.className = "app-dialog__card";
    card.append(heading, body, actions);

    const { close } = openModal({
      card,
      labelledBy: titleId,
      describedBy: messageId,
      role: danger ? "alertdialog" : undefined,
      initialFocus: danger ? cancel : confirm,
      onClose: answer => resolve(answer === true),
    });

    cancel.addEventListener("click", () => close(false));
    confirm.addEventListener("click", () => close(true));
  });
}

export function makeButton(label, variant) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${variant}`;
  b.textContent = label;
  return b;
}
