import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeKpiLayoutForBand } from "../layout/computeKpiLayout.js";

// Every KPI band is edited through the same handlers, addressed by the id
// of its `kpi` section — however many a theme defines, each behaves the
// same way except for its own allowSecondRow flag (only the header band,
// by convention, ever grows a second row).
function sectionFor(bandId) {
  return state.activeTheme.sections.find(s => s.type === "kpi" && s.id === bandId);
}

export function kpiBandCapacity(bandId) {
  const section = sectionFor(bandId);
  return section && section.allowSecondRow
    ? state.MAX_KPIS + state.SECOND_ROW_MAX_ITEMS
    : state.MAX_KPIS;
}

export function canAddKpi(bandId) {
  if (!sectionFor(bandId)) return false;
  return state.getKpiBand(bandId).length < kpiBandCapacity(bandId);
}

export function kpiLimitMessage(bandId) {
  const section = sectionFor(bandId);
  return section && !section.allowSecondRow
    ? `Pás KPI „${bandId}“ je plný — zvyšte limit na řádek nebo odeberte KPI.`
    : "Bylo dosaženo maximálního počtu KPI.";
}

// Add KPI at index within its band
export function handleAddKpi(index, bandId) {
  if (!canAddKpi(bandId)) {
    addWarning(kpiLimitMessage(bandId), "error");
    renderLayout();
    return;
  }

  const next = [...state.getKpiBand(bandId)];
  next.splice(index + 1, 0, { height: null, locked: false });
  state.setKpiBand(bandId, next);
  renderLayout();
}

// Append a KPI at the end of its band (used by the sidebar buttons)
export function handleAppendKpi(bandId) {
  if (!canAddKpi(bandId)) {
    addWarning(kpiLimitMessage(bandId), "error");
    return;
  }

  state.setKpiBand(bandId, [...state.getKpiBand(bandId), { height: null, locked: false }]);
  renderLayout();
}

// Remove KPI at index within its band
export function handleRemoveKpi(index, bandId) {
  const next = [...state.getKpiBand(bandId)];
  next.splice(index, 1);

  if (next.length < state.MAX_KPIS) {
    state.setWarnings(state.warnings.filter(w => !w.includes("KPI")));
  }

  state.setKpiBand(bandId, next);
  renderLayout();
}

// Select KPI
export function handleSelectKpi(item, domId, opts = {}) {
  setSelected({
    kind: "kpi",
    band: item.band ?? 0,
    labelType: item.band === 0 ? "KPI" : "KPI (prostřední pás)",
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
  const rows = state.kpiBandIds().flatMap(id => computeKpiLayoutForBand(v, id));
  const item = rows.flat().find(i => i.stateRef === selected.stateRef);
  if (!item) return;

  handleSelectKpi(item, selected.domId, { preservePending });
}
