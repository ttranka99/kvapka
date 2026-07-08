import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeKpiLayout } from "../layout/computeKpiLayout.js";


// Add KPI at index
export function handleAddKpi(index) {
  if (state.kpis.length >= state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS) {
    addWarning("Bylo dosaženo maximálního počtu KPI.", "error");
    renderLayout();
    return;
  }

  const newKpis = [...state.kpis];
  newKpis.splice(index + 1, 0, { height: null, locked: false });
  state.setKpis(newKpis);
  renderLayout();
}

// Remove KPI at index
export function handleRemoveKpi(index) {
  const newKpis = [...state.kpis];
  newKpis.splice(index, 1);

  if (newKpis.length < state.MAX_KPIS) {
    state.setWarnings(state.warnings.filter(w => !w.includes("KPI")));
  }

  state.setKpis(newKpis);
  renderLayout();
}

// Select KPI
export function handleSelectKpi(item, domId, opts = {}) {
  setSelected({
    kind: "kpi",
    labelType: "KPI",
    labelIndex: item.index + 1,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    domId,
    stateRef: item.stateRef
  }, opts);
}

// Re-syncs the selection panel to a KPI's current geometry after an edit.
// Mirrors refreshSelectedSlicerAfterEdit in slicerEvents.js.
export function refreshSelectedKpiAfterEdit(preservePending = false) {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "kpi" || !selected.domId) return;

  const v = computeVerticalLayout();
  const rows = computeKpiLayout(v);
  const item = rows.flat().find(i => i.stateRef === selected.stateRef);
  if (!item) return;

  handleSelectKpi(item, selected.domId, { preservePending });
}