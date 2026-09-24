// assets/js/ui/dialog.js
//
// The app's own confirm dialog, in place of window.confirm(): styled like the
// rest of the app, translated, and not subject to a browser's "prevent this
// page from creating additional dialogs" switch or a policy that silences
// native dialogs (where confirm() quietly returns false).
//
// Built on <dialog>.showModal(): the browser keeps focus inside, makes the
// page behind it inert and puts it in the top layer above every z-index. All
// text goes in through textContent — a template's name is user input.

import { leave } from "./motion.js";
import { t } from "../i18n/i18n.js";

let current = null;

/**
 * Asks a yes/no question. Resolves true only when the confirm button is
 * pressed; Escape, Cancel, a click on the backdrop or another dialog opening
 * over it all resolve false.
 *
 * danger: styles the confirm button as destructive and puts the initial
 * focus on Cancel, so a stray Enter never deletes anything.
 */
export function confirmDialog({ title, message, confirmLabel, cancelLabel = t("dialog.cancel"), danger = false }) {
  if (current) current.settle(false);

  return new Promise(resolve => {
    const returnFocus = document.activeElement;

    const dialog = document.createElement("dialog");
    dialog.className = "app-dialog m-enter";
    const titleId = "app-dialog-title";
    const messageId = "app-dialog-message";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", messageId);
    if (danger) dialog.setAttribute("role", "alertdialog");

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

    // The card is a child, so the <dialog> box itself is only the backdrop's
    // hit area (see the click handler below).
    const card = document.createElement("div");
    card.className = "app-dialog__card";
    card.append(heading, body, actions);
    dialog.appendChild(card);

    let settled = false;
    const settle = answer => {
      if (settled) return;
      settled = true;
      if (current && current.dialog === dialog) current = null;
      leave(dialog, () => {
        if (dialog.open) dialog.close();
        dialog.remove();
      });
      // Back to where the user was, unless that element went away meanwhile.
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
      resolve(answer);
    };
    current = { dialog, settle };

    cancel.addEventListener("click", () => settle(false));
    confirm.addEventListener("click", () => settle(true));

    // A modal answers its own keys: nothing behind it (the template editor's
    // Escape-to-close, the undo shortcuts) may react while it is open.
    dialog.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        settle(false);
      }
    });
    // Escape reaching the dialog some other way (a close request from the
    // browser or assistive tech) is still a "no".
    dialog.addEventListener("cancel", e => {
      e.preventDefault();
      settle(false);
    });
    // A click on the backdrop lands on the <dialog> itself; one inside the
    // card lands on a child. The press has to start there too, so selecting
    // the message text and releasing outside the card doesn't dismiss it.
    let pressedBackdrop = false;
    dialog.addEventListener("pointerdown", e => { pressedBackdrop = e.target === dialog; });
    dialog.addEventListener("click", e => {
      if (e.target === dialog && pressedBackdrop) settle(false);
    });

    document.body.appendChild(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    (danger ? cancel : confirm).focus();
  });
}

function makeButton(label, variant) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${variant}`;
  b.textContent = label;
  return b;
}
