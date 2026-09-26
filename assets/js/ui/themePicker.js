// assets/js/ui/themePicker.js
//
// The sidebar's theme control. Three decisions live here, and keeping them
// visibly separate is the point of the panel:
//
//   *what shape* — the placement switch (Nahoře / Vlevo / Vpravo). Slicers in
//   a band and slicers in a column are separate layouts, so this does not
//   bend the current one: it picks a different one. The chip list below shows
//   only layouts of the chosen shape, which is what keeps three placements'
//   worth of layouts readable as one short list.
//
//   *which* layout — the chips, built-in presets first, then saved custom
//   ones, then the button that opens the editor;
//
//   *how far it reaches* — the scope switch. "Tato stránka" changes only the
//   page being looked at, which is what lets a report use a wide dashboard
//   canvas for page one and the standard size everywhere else. "Všechny
//   stránky" applies it across the report and makes it the default new pages
//   start on.

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

// "page" | "global" — a UI preference, not layout state, so it lives here
// rather than in a page snapshot.
let scope = "page";

/** The shape the chip list is currently showing. Always the active layout's
 *  own placement — this is a view of state, not a second source of truth. */
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
    // Seeded from the theme in force, since "like this one but wider" is the
    // overwhelmingly common starting point — never a blank slate.
    openEditorFor(state.getActiveTheme(), "new");
  });

  syncScopeButtons();
  syncPlacementControls();
  renderThemeSelector();
}

function syncScopeButtons() {
  scopeButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.scope === scope);
  });
  syncTemplateSummary();
}

/**
 * Lights the active placement and disables the ones no layout exists for.
 * A disabled option is the honest answer: with layouts fully independent,
 * there is nothing to switch *to*, and inventing one behind the user's back
 * would put a layout in their list they never authored.
 */
export function syncPlacementControls() {
  // The buttons are looked up in initThemePicker(), but refreshUIFromState is
  // handed to initTabsUI() before that runs — same guard renderThemeSelector
  // keeps for the same reason.
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

  if (placementNote) {
    placementNote.textContent = missing.length
      ? t("template.placementMissingNote", { list: missing.join(", ") })
      : "";
  }
}

/**
 * Switches to a layout of another shape. With no family link between
 * layouts, "the vertical version of this one" has to be *found* rather than
 * followed: prefer the same name, then the same canvas, then whatever exists.
 * Matching the name first is what makes FULL HD -> Vlevo land on the vertical
 * FULL HD instead of the first vertical layout in the list.
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
  // Only this shape's layouts — the placement switch above the list is what
  // chose it, and mixing all three would make the list three times as long
  // for no gain, since picking one always changes the shape too.
  const themes = themesForPlacement(currentPlacement());

  // A page can outlive the theme it was authored against (deleted, or built
  // in another browser). Its snapshot still carries the theme by value, so it
  // renders correctly — it just needs a chip of its own to stay selectable.
  if (!themes.some(t => t.id === activeId)) {
    themes.push({ ...state.getActiveTheme(), builtin: false, orphaned: true });
  }

  // Picking a theme leaves the list as it was; only the lit chip moves. The
  // chips are kept and patched so the chip's own transition plays (motion.js
  // R4) — rebuilt only when the list itself changed.
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
    // Marked, so it never reads as a twin of a live layout with the same name.
    pick.textContent = theme.orphaned ? t("template.chipDeleted", { label: theme.label }) : theme.label;
    pick.title = t("template.chipTitle", { label: theme.label, width: theme.canvasWidth, height: theme.canvasHeight });
    pick.addEventListener("click", () => selectTheme(theme.id));
    chip.appendChild(pick);

    // Built-ins are baselines and stay untouched; the editor opens a copy of
    // one instead, via the "+" button below.
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
  // A theme changes the canvas in both axes at once, so — exactly as a
  // template switch always did — every kind of locked size may now be out of
  // date.
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
  // The editor is a section of its own, so opening it from anywhere (rail,
  // chip pencil, "Vlastní šablona…") lights that section on the rail, and
  // closing it — however it closes — hands the screen back to the template
  // section.
  setActiveSection("layout");
  openThemeEditor({
    theme,
    mode,
    onClose: () => setActiveSection("studio"),
    onApply: saved => {
      if (!saved) {
        // The theme was deleted. Pages keep the settings they were authored
        // with (snapshots hold themes by value), so nothing needs re-solving
        // — only the chip list is now stale, and the deleted layout may have
        // been the last one of its shape, which disables that placement.
        syncPlacementControls();
        renderThemeSelector();
        addWarning(t("warnings.theme.deleted"), "info");
        return;
      }

      // Pages already on this theme follow the edit; pages on other themes
      // are untouched, whatever the scope switch says — editing a theme is
      // not the same act as choosing one.
      retargetTabsToTheme(saved.id, saved);
      applyThemeEverywhereScopeSays(saved);
      addWarning(t("warnings.theme.saved", { label: saved.label }), "info");
    }
  });
}

/**
 * Rebuilds the per-row dropdowns for the active theme. The choices used to be
 * hardcoded 4–7 in the markup; a theme sets its own bounds, so they are built
 * here instead.
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

// The chips are cached by their theme list, which a language switch leaves
// unchanged; forget it so their tooltips are rebuilt in the new language.
onLocaleChange(() => {
  builtSignature = null;
  renderThemeSelector();
  syncPlacementControls();
});

/** The layout "+" would create a page on from here, for the sidebar's
 *  "new pages: …" hint. */
export function defaultThemeLabel() {
  return newPageTheme(state.getActiveTheme()).label;
}
