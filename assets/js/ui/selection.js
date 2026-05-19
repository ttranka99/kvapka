import * as state from "../state/state.js";

export function setSelected(info) {
  const noSelectionEl = document.getElementById("no-selection");
  const selectionDetailsEl = document.getElementById("selection-details");
  const selTypeEl = document.getElementById("sel-type");
  const selIndexEl = document.getElementById("sel-index");
  const selXEl = document.getElementById("sel-x");
  const selYEl = document.getElementById("sel-y");
  const selWidthEl = document.getElementById("sel-width");
  const selHeightEl = document.getElementById("sel-height");
  const editWidthEl = document.getElementById("edit-width");
  const editHeightEl = document.getElementById("edit-height");
  const inputWidth = document.getElementById("input-width");
  const inputHeight = document.getElementById("input-height");

  state.setSelectedElement(info);

  if (!info) {
    noSelectionEl.classList.remove("hidden");
    selectionDetailsEl.classList.add("hidden");
    document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
    return;
  }

  noSelectionEl.classList.add("hidden");
  selectionDetailsEl.classList.remove("hidden");

  selTypeEl.textContent = info.labelType;
  selIndexEl.textContent = info.labelIndex ?? "-";
  selXEl.textContent = info.x;
  selYEl.textContent = info.y;
  selWidthEl.textContent = info.width;
  selHeightEl.textContent = info.height;

  editWidthEl.classList.add("hidden");
  editHeightEl.classList.add("hidden");

  if (info.kind === "slicer") {
    editWidthEl.classList.remove("hidden");
    inputWidth.value = info.width;
  }

  if (info.kind === "chartRow") {
    editHeightEl.classList.remove("hidden");
    inputHeight.value = info.height;
  }

  if (info.kind === "kpi") {
    editWidthEl.classList.remove("hidden");
    inputWidth.value = info.width;
  }

  document.querySelectorAll(".canvas-element").forEach(el => el.classList.remove("selected"));
  if (info.domId) {
    const el = document.getElementById(info.domId);
    if (el) el.classList.add("selected");
  }
}
