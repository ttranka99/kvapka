// assets/js/ui/dialog.js
//
// The app's own modals: a confirm dialog replacing window.confirm() (which
// can't be styled or translated, and can be blocked by the browser, where it
// quietly returns false), plus the shell other modals share (ui/about.js).
//
// Built on <dialog>.showModal(): the browser keeps focus inside, makes the
// page behind it inert and puts it above every z-index. All text goes in
// through textContent, because a template's name is user input.

import { leave } from "./motion.js";
import { t } from "../i18n/i18n.js";

let current = null;

/**
 * Shows `card` in a modal. Escape, a backdrop click, another modal opening
 * or the returned close() all close it. Every way out calls onClose(value)
 * exactly once: the value passed to close(), or undefined for a dismissal.
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

  // The card is a child, so the <dialog> itself is only the backdrop's hit
  // area (see the click handler below).
  dialog.appendChild(card);

  let closed = false;
  const close = value => {
    if (closed) return;
    closed = true;
    if (current && current.dialog === dialog) current = null;
    leave(dialog, () => {
      if (dialog.open) dialog.close();
      dialog.remove();
      // Restore focus unless that element is gone or another modal took over.
      // Must happen now: while the dialog is modal the page is inert and
      // focus() is ignored, and close() itself refocuses whatever had focus
      // before showModal().
      if (!current && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
    });
    if (onClose) onClose(value);
  };
  current = { dialog, close: () => close() };

  // Nothing behind a modal (template editor Escape, undo shortcuts) may
  // react to keys while it is open.
  dialog.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  // A close request from the browser or assistive tech is a dismissal too.
  dialog.addEventListener("cancel", e => {
    e.preventDefault();
    close();
  });
  // A backdrop click targets the <dialog> itself; a click in the card targets
  // a child. The press must start on the backdrop too, so selecting text and
  // releasing outside the card doesn't dismiss it.
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
 * Asks a yes/no question. Resolves true only if the confirm button is
 * pressed; Escape, Cancel, a backdrop click or another dialog resolve false.
 *
 * danger: styles the confirm button as destructive and focuses Cancel first,
 * so a stray Enter never deletes anything.
 */
export async function confirmDialog({ title, message, confirmLabel, cancelLabel = t("dialog.cancel"), danger = false }) {
  const answer = await choiceDialog({
    title,
    message,
    cancelLabel,
    choices: [{ label: confirmLabel, value: true, danger, primary: !danger }]
  });
  return answer === true;
}

/**
 * Asks a question with several answers besides Cancel, e.g. "Save" / "Don't
 * save". Resolves the pressed choice's value; Escape, Cancel, a backdrop
 * click or another dialog resolve null.
 *
 * choices: [{ label, value, primary?, danger? }], shown after Cancel in this
 * order. With a danger choice the dialog is an alertdialog and Cancel is
 * focused first, so a stray Enter never throws work away. Otherwise the
 * primary choice is focused.
 */
export function choiceDialog({ title, message, choices, cancelLabel = t("dialog.cancel") }) {
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
    actions.append(cancel);

    const danger = choices.some(choice => choice.danger);
    let primary = null;
    const buttons = choices.map(choice => {
      const variant = choice.danger ? "btn-danger app-dialog__danger" : choice.primary ? "btn-primary" : "btn-secondary";
      const button = makeButton(choice.label, variant);
      if (choice.primary && !primary) primary = button;
      actions.append(button);
      return button;
    });

    const card = document.createElement("div");
    card.className = "app-dialog__card";
    card.append(heading, body, actions);

    let answered = null;
    const { close } = openModal({
      card,
      labelledBy: titleId,
      describedBy: messageId,
      role: danger ? "alertdialog" : undefined,
      initialFocus: danger || !primary ? cancel : primary,
      onClose: () => resolve(answered),
    });

    cancel.addEventListener("click", () => close());
    buttons.forEach((button, i) => {
      button.addEventListener("click", () => {
        answered = choices[i].value;
        close();
      });
    });
  });
}

export function makeButton(label, variant) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${variant}`;
  b.textContent = label;
  return b;
}
