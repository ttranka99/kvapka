import { getTabs, getActiveTabIndex, switchTab, addTab, removeTab, renameTab, MAX_TABS } from "../state/tabs.js";

const REMOVE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

let tabBarEl;
let refreshUI;

export function initTabsUI(options) {
  refreshUI = options.refreshUI;
  tabBarEl = document.getElementById("tab-bar");
  renderTabBar();
}

export function renderTabBar(animate) {
  tabBarEl.innerHTML = "";
  const tabs = getTabs();
  const active = getActiveTabIndex();

  tabs.forEach((tab, index) => {
    const tabEl = document.createElement("div");
    tabEl.className = "tab" + (index === active ? " tab--active" : "");
    tabEl.setAttribute("role", "tab");
    tabEl.setAttribute("aria-selected", String(index === active));

    // Only the tab that just changed gets the entry/highlight animation —
    // the whole bar is torn down and rebuilt on every change (see project
    // render model), so an animation on the base .tab class would replay on
    // every tab, not just the one the user actually acted on.
    if (animate && index === animate.index) {
      const animClass = animate.type === "new" ? "tab--new" : "tab--renamed";
      tabEl.classList.add(animClass);
      tabEl.addEventListener("animationend", () => tabEl.classList.remove(animClass), { once: true });
    }

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    tabEl.appendChild(label);

    if (tabs.length > 1) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "tab-close";
      closeBtn.innerHTML = REMOVE_ICON;
      closeBtn.title = "Zavřít stránku";
      closeBtn.addEventListener("click", e => {
        e.stopPropagation();

        const commitRemoval = () => {
          const swapped = removeTab(index);
          renderTabBar();
          if (swapped) refreshUI();
        };

        // Unlike add/rename (which tag the *new* DOM after re-rendering),
        // the closed tab is destroyed by the re-render, so it has to play
        // its exit animation first and only then trigger the state change +
        // rebuild — reversed order from the other two animations.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          commitRemoval();
          return;
        }

        let done = false;
        const finish = () => { if (done) return; done = true; commitRemoval(); };
        tabEl.classList.add("tab--removing");
        closeBtn.disabled = true;
        tabEl.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, 250); // safety net in case animationend doesn't fire
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener("click", () => {
      if (switchTab(index)) { renderTabBar(); refreshUI(); }
    });
    tabEl.addEventListener("dblclick", () => startRename(tabEl, label, index));
    tabBarEl.appendChild(tabEl);
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "tab-add";
  addBtn.textContent = "+";
  addBtn.title = "Přidat stránku";
  addBtn.disabled = tabs.length >= MAX_TABS;
  addBtn.addEventListener("click", () => {
    if (addTab()) { renderTabBar({ index: getActiveTabIndex(), type: "new" }); refreshUI(); }
  });
  tabBarEl.appendChild(addBtn);
}

function startRename(tabEl, label, index) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tab-rename-input";
  input.value = getTabs()[index].name;
  input.maxLength = 40;
  tabEl.replaceChild(input, label);
  input.focus();
  input.select();

  let finished = false;   // guards against blur firing during DOM teardown
  const commit = () => { if (finished) return; finished = true; renameTab(index, input.value); renderTabBar({ index, type: "renamed" }); };
  const cancel = () => { if (finished) return; finished = true; renderTabBar(); };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
  input.addEventListener("click", e => e.stopPropagation());
  input.addEventListener("dblclick", e => e.stopPropagation());
}
