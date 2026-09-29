import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { renderLayout } from "../ui/renderLayout.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeKpiLayoutForBand } from "../layout/computeKpiLayout.js";
import { flash } from "../ui/motion.js";
import { t, isFrom } from "../i18n/i18n.js";

// All KPI bands share these handlers, addressed by the id of the `kpi`
// section. They differ only in allowSecondRow (by convention, only the
// header band has it).
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
    ? t("warnings.kpi.bandFull", { band: bandId })
    : t("warnings.kpi.limit");
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
    state.setWarnings(state.warnings.filter(w => !isFrom(w, "warnings.kpi.")));
  }

  state.setKpiBand(bandId, next);
  renderLayout();
}

// Freezes (or releases) a KPI's width at the solver's current value, so
// add/remove doesn't redistribute it. One flag covers width and height (Apply
// locks the same way), so releasing it frees both.
export function handleToggleKpiLock(index, bandId) {
  const k = state.getKpiBand(bandId)[index];
  if (!k) return;

  if (k.locked) {
    k.locked = false;
    k.width = null;
    k.height = null;
  } else {
    const v = computeVerticalLayout();
    const item = computeKpiLayoutForBand(v, bandId).flat().find(i => i.index === index);
    k.width = item ? item.width : k.width;
    k.locked = true;
  }

  state.setKpiBand(bandId, [...state.getKpiBand(bandId)]);
  renderLayout();
  // Flash on lock only. The dom id has the band ordinal, not its id, so find
  // the card by the data-kpi tag from renderLayout.
  if (k.locked) flash(document.querySelector(`.canvas-element.kpi[data-kpi="${bandId}:${index}"]`)?.id);
}

// Select KPI
//
// `item.band` is the section's ordinal in the theme's band list. The label
// uses it because a theme can have any number of bands, so "middle band"
// would be wrong for most.
export function handleSelectKpi(item, domId, opts = {}) {
  const band = item.band ?? 0;
  setSelected({
    kind: "kpi",
    band,
    labelType: band === 0 ? t("selection.kind.kpi") : t("selection.kind.kpiBand", { n: band + 1 }),
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
