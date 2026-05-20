import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";

// Access renderLayout from global scope (temporary until renderLayout.js exists)
const renderLayout = window.renderLayout;

// Add KPI at index
export function handleAddKpi(index) {
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
export function handleSelectKpi(item, domId) {
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
  });
}
