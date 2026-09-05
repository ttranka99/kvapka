import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeKpiLayout, computeKpiBand2Layout } from "../layout/computeKpiLayout.js";

// Both KPI bands are edited through the same handlers; `band` says which list
// is being changed. 0 is the header band (up to two rows, per the per-row
// limit), 1 the optional middle band, which is deliberately a single row.
const bandList = band => (band === 1 ? state.kpis2 : state.kpis);
const setBandList = (band, value) => (band === 1 ? state.setKpis2(value) : state.setKpis(value));

export function kpiBandCapacity(band) {
  return band === 1
    ? state.MAX_KPIS
    : state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS;
}

export function canAddKpi(band = 0) {
  if (band === 1 && !state.hasKpiBand2()) return false;
  return bandList(band).length < kpiBandCapacity(band);
}

export function kpiLimitMessage(band = 0) {
  return band === 1
    ? "Prostřední pás KPI je plný — zvyšte limit na řádek nebo odeberte KPI."
    : "Bylo dosaženo maximálního počtu KPI.";
}

// Add KPI at index within its band
export function handleAddKpi(index, band = 0) {
  if (!canAddKpi(band)) {
    addWarning(kpiLimitMessage(band), "error");
    renderLayout();
    return;
  }

  const next = [...bandList(band)];
  next.splice(index + 1, 0, { height: null, locked: false });
  setBandList(band, next);
  renderLayout();
}

// Append a KPI at the end of its band (used by the sidebar buttons)
export function handleAppendKpi(band = 0) {
  if (!canAddKpi(band)) {
    addWarning(kpiLimitMessage(band), "error");
    return;
  }

  setBandList(band, [...bandList(band), { height: null, locked: false }]);
  renderLayout();
}

// Remove KPI at index within its band
export function handleRemoveKpi(index, band = 0) {
  const next = [...bandList(band)];
  next.splice(index, 1);

  if (next.length < state.MAX_KPIS) {
    state.setWarnings(state.warnings.filter(w => !w.includes("KPI")));
  }

  setBandList(band, next);
  renderLayout();
}

// Select KPI
export function handleSelectKpi(item, domId, opts = {}) {
  setSelected({
    kind: "kpi",
    band: item.band ?? 0,
    labelType: item.band === 1 ? "KPI (prostřední pás)" : "KPI",
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
  const rows = [...computeKpiLayout(v), ...computeKpiBand2Layout(v)];
  const item = rows.flat().find(i => i.stateRef === selected.stateRef);
  if (!item) return;

  handleSelectKpi(item, selected.domId, { preservePending });
}
