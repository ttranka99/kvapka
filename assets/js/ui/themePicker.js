// assets/js/ui/themePicker.js
//
// The sidebar's theme control. It holds three separate decisions:
//
//   *what shape* — the placement switch (Nahoře / Vlevo / Vpravo). Slicers in
//   a band and in a column are separate layouts, so this picks a different
//   layout instead of bending the current one. The chip list shows only
//   layouts of the chosen shape, which keeps it short.
//
//   *which* layout — the chips: built-in presets, then saved custom ones,
//   then the button that opens the editor;
//
//   *how far it reaches* — the scope switch. "Tato stránka" changes only the
//   current page (so page one can use a wide dashboard canvas and the rest
//   the standard size). "Všechny stránky" applies it to the whole report and
//   makes it the default for new pages.

import * as state from "../state/state.js";
import {
  getTheme,
  setDefaultThemeId,
  themesForPlacement,
  availablePlacements
} from "../theme/themeStore.js";
import { openThemeEditor } from "../theme/themeEditor.js";
import { setActiveSection } from "./rail.js";
import { icon } from "./icon.js";
import { initThumb, syncThumb } from "./thumb.js";
import { applyThemeToAllTabs, retargetTabsToTheme, newPageTheme } from "../state/tabs.js";
import { addWarning } from "./warnings.js";
import { PLACEMENTS, placementLabel } from "../theme/themeModel.js";
import { syncTemplateSummary } from "./templatePanel.js";
import { t, onLocaleChange } from "../i18n/i18n.js";


let selectorEl;
let builtSignature = null;   // the theme list the chips were last built from
let scopeButtons;
let placementButtons;
let placementNote;
let refreshUI;

// "page" | "global". A UI preference, not layout state, so it is kept here and
// not in a page snapshot.
let scope = "page";

/** The shape the chip list shows: always the active layout's placement. A
 *  view of state, not a second source of truth. */
function currentPlacement() {
  return state.activeTheme.placement;
}

export function initThemePicker(options) {
  refreshUI = options.refreshUI;
  selectorEl = document.getElementById("theme-selector");
  scopeButtons = document.querySelectorAll(".theme-scope-option[data-scope]");
  placementButtons = document.querySelectorAll(".template-option[data-placement]");
  placementNote = document.getElementById("placement-note");

  scopeButtons.forEach(button => {
    button.addEventListener("click", () => {
      scope = button.dataset.scope === "global" ? "global" : "page";
      syncScopeButtons();
    });
  });

  placementButtons.forEach(button => {
    button.addEventListener("click", () => selectPlacement(button.dataset.placement));
  });

  document.getElementById("new-theme").addEventListener("click", () => {
    // Seeded from the current theme: "like this one but wider" is the usual
    // starting point, never a blank slate.
    openEditorFor(state.getActiveTheme(), "new");
  });

  syncScopeButtons();
  syncPlacementControls();
  // Both switchers slide their slate pill to the chosen option.
  initThumb(scopeButtons[0].parentElement);
  initThumb(placementButtons[0].parentElement);
  renderThemeSelector();
}

function syncScopeButtons() {
  scopeButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.scope === scope);
  });
  if (scopeButtons.length) syncThumb(scopeButtons[0].parentElement);
  syncTemplateSummary();
}

/**
 * Lights the active placement and disables the ones no layout exists for.
 * Layouts are fully independent, so there is nothing to switch to, and
 * inventing one would add a layout the user never authored.
 */
export function syncPlacementControls() {
  // The buttons are looked up in initThemePicker(), but refreshUIFromState is
  // handed to initTabsUI() before that runs. renderThemeSelector has the same
  // guard.
  if (!placementButtons) return;

  const active = currentPlacement();
  const available = availablePlacements();
  const missing = [];

  placementButtons.forEach(button => {
    const placement = button.dataset.placement;
    const usable = available.includes(placement);

    button.classList.toggle("active", placement === active);
    button.disabled = !usable;
    if (!usable) {
      missing.push(placementLabel(placement));
      button.title = t("template.placementMissingTitle");
    } else {
      button.removeAttribute("title");
    }
  });
  if (placementButtons.length) syncThumb(placementButtons[0].parentElement);

  if (placementNote) {
    placementNote.textContent = missing.length
      ? t("template.placementMissingNote", { list: missing.join(", ") })
      : "";
  }
}

/**
 * Switches to a layout of another shape. Layouts aren't linked as a family,
 * so the counterpart is searched for: same name first, then same canvas, then
 * anything. Name first makes FULL HD -> Vlevo land on the vertical FULL HD,
 * not the first vertical layout in the list.
 */
function pickCounterpart(current, placement) {
  const candidates = themesForPlacement(placement);
  if (!candidates.length) return null;

  return candidates.find(t => t.label === current.label)
    || candidates.find(t => t.canvasWidth === current.canvasWidth && t.canvasHeight === current.canvasHeight)
    || candidates[0];
}

function selectPlacement(placement) {
  if (!PLACEMENTS.includes(placement) || placement === currentPlacement()) return;

  const target = pickCounterpart(state.activeTheme, placement);
  if (!target) return;

  applyThemeEverywhereScopeSays(target);
}

export function renderThemeSelector() {
  if (!selectorEl) return;

  const activeId = state.activeTemplate;
  // Only this shape's layouts. The placement switch above chose it, and
  // listing all three would triple the list for no gain.
  const themes = themesForPlacement(currentPlacement());

  // A page can outlive its theme (deleted, or built in another browser). Its
  // snapshot holds the theme by value, so it still renders, but it needs its
  // own chip to stay selectable.
  if (!themes.some(t => t.id === activeId)) {
    themes.push({ ...state.getActiveTheme(), builtin: false, orphaned: true });
  }

  // Picking a theme only moves the lit chip. Patch the chips so their
  // transition plays (motion.js R4) and rebuild only when the list changed.
  const signature = JSON.stringify(themes.map(t => [t.id, t.label, t.canvasWidth, t.canvasHeight, t.builtin, t.orphaned]));
  if (signature === builtSignature) {
    Array.from(selectorEl.children).forEach((chip, i) => {
      chip.classList.toggle("active", themes[i].id === activeId);
    });
    return;
  }

  selectorEl.innerHTML = "";
  builtSignature = signature;

  themes.forEach(theme => {
    const chip = document.createElement("div");
    chip.className = "theme-chip"
      + (theme.id === activeId ? " active" : "")
      + (theme.orphaned ? " theme-chip--orphaned" : "");

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "theme-chip__label";
    // Marked, so it isn't mistaken for a live layout with the same name.
    pick.textContent = theme.orphaned ? t("template.chipDeleted", { label: theme.label }) : theme.label;
    pick.title = t("template.chipTitle", { label: theme.label, width: theme.canvasWidth, height: theme.canvasHeight });
    pick.addEventListener("click", () => selectTheme(theme.id));
    chip.appendChild(pick);

    // Built-ins stay untouched. Edit a copy via the "+" button below.
    if (!theme.builtin && !theme.orphaned) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "theme-chip__edit";
      edit.innerHTML = icon("pencil");
      edit.title = t("template.chipEdit", { label: theme.label });
      edit.setAttribute("aria-label", edit.title);
      edit.addEventListener("click", event => {
        event.stopPropagation();
        openEditorFor(getTheme(theme.id));
      });
      chip.appendChild(edit);
    }

    selectorEl.appendChild(chip);
  });
}

function selectTheme(id) {
  const theme = getTheme(id);
  if (!theme || id === state.activeTemplate) return;
  applyThemeEverywhereScopeSays(theme);
}

function applyThemeEverywhereScopeSays(theme) {
  if (scope === "global") {
    applyThemeToAllTabs(theme);
    setDefaultThemeId(theme.id);
  }

  state.applyTheme(theme);
  // A theme changes the canvas in both axes, so every kind of locked size
  // may be out of date (as with any template switch).
  state.resetSizingLocks();
  state.setWarnings([]);

  syncPlacementControls();
  renderThemeSelector();
  refreshUI();
}

/**
 * The rail's "Vlastní layout" section: the active layout, edited in place if
 * it is a custom one, forked into a new copy if it is a built-in (built-ins
 * are read-only baselines).
 */
export function openActiveThemeEditor() {
  const theme = state.getActiveTheme();
  openEditorFor(theme, theme.builtin ? "new" : undefined);
}

function openEditorFor(theme, mode) {
  // The editor is its own section: opening it from anywhere (rail, chip
  // pencil, "Vlastní šablona…") lights it on the rail, and any close returns
  // to the template section.
  setActiveSection("layout");
  openThemeEditor({
    theme,
    mode,
    onClose: () => setActiveSection("studio"),
    onApply: saved => {
      if (!saved) {
        // The theme was deleted. Pages keep their settings (snapshots hold
        // themes by value), so nothing needs re-solving. Only the chip list
        // is stale, and if it was the last layout of its shape, that
        // placement is now disabled.
        syncPlacementControls();
        renderThemeSelector();
        addWarning(t("warnings.theme.deleted"), "info");
        return;
      }

      // Pages on this theme follow the edit. Pages on other themes are
      // untouched whatever the scope says, since editing isn't choosing.
      retargetTabsToTheme(saved.id, saved);
      applyThemeEverywhereScopeSays(saved);
      addWarning(t("warnings.theme.saved", { label: saved.label }), "info");
    }
  });
}

/**
 * Rebuilds the per-row dropdowns for the active theme. A theme sets its own
 * bounds, so the choices aren't hardcoded in the markup.
 */
export function syncRowLimitOptions() {
  [
    ["slicers-per-row", state.MAX_SLICERS],
    ["kpis-per-row", state.MAX_KPIS]
  ].forEach(([id, current]) => {
    const select = document.getElementById(id);
    if (!select) return;

    const wanted = [];
    for (let n = state.MIN_COMPONENTS_PER_ROW; n <= state.MAX_COMPONENTS_PER_ROW; n++) wanted.push(n);

    const existing = [...select.options].map(o => Number(o.value));
    const same = existing.length === wanted.length && existing.every((v, i) => v === wanted[i]);
    if (!same) {
      select.innerHTML = "";
      wanted.forEach(n => {
        const option = document.createElement("option");
        option.value = String(n);
        option.textContent = String(n);
        select.appendChild(option);
      });
    }

    select.value = String(current);
  });
}

// The chip cache is keyed by the theme list, which a language switch doesn't
// change. Clear it so the tooltips are rebuilt in the new language.
onLocaleChange(() => {
  builtSignature = null;
  renderThemeSelector();
  syncPlacementControls();
});

/** The layout a new page from "+" would use, for the sidebar's
 *  "new pages: …" hint. */
export function defaultThemeLabel() {
  return newPageTheme(state.getActiveTheme()).label;
}
