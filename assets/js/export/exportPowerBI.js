// assets/js/export/exportPowerBI.js
//
// Exports every tab as a page of a PBIR report, zipped for download. The zip
// mirrors a report folder (<name>.Report), so it unzips straight into one:
//
//   definition/pages/pages.json                         pageOrder + activePageName
//   definition/pages/<pageHash>/page.json               one per tab
//   definition/pages/<pageHash>/visuals/<hash>/visual.json
//                                                       one per slicer, KPI and chart
//
// Styling is visualTemplates.js plus the project's element styles
// (styleToPbir.js). Positions come from the same pure layout functions the
// renderer uses. The header/title element is intentionally not exported.
//
// The layout functions read live state, which is current only for the active
// tab. Other tabs live in snapshots (state/tabs.js), so each snapshot is
// loaded in turn to compute its geometry, then the live state is restored.

import * as state from "../state/state.js";
import { getTabs, getActiveTabIndex, captureSnapshot, loadSnapshot } from "../state/tabs.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import { computeKpiLayoutForBand } from "../layout/computeKpiLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { VISUAL_SCHEMA, PAGE_SCHEMA, PAGES_SCHEMA } from "./visualTemplates.js";
import { buildVisual } from "./styleToPbir.js";
import { getElementStyles } from "../elements/elementStyles.js";
import { createZip } from "./zip.js";
import { addWarning, renderWarnings } from "../ui/warnings.js";
import { t, isFrom } from "../i18n/i18n.js";

// Where the pages folder sits inside a PBIR report folder.
const PAGES_ROOT = "definition/pages";

// 20-char lowercase hex, same format as PBIR object names.
// (crypto.getRandomValues also works on file://, unlike crypto.randomUUID.)
function genHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

// z-index bands mirroring the demo export: charts at the bottom (0+),
// slicers above them (1000+), KPI cards on top (8000+).
const Z_BASE = { chart: 0, slicer: 1000, kpi: 8000 };

function collectVisuals() {
  const v = computeVerticalLayout();

  const charts = computeChartsLayout(v).flat().flatMap(item => item.subCharts ?? [item]);
  const slicers = computeSlicersLayout(v).flat();

  const kpiBandIds = state.kpiBandIds();
  const kpiLayouts = kpiBandIds.map(id => computeKpiLayoutForBand(v, id).flat());
  const kpis = kpiLayouts.flat();

  // The slicer/KPI layouts return [] when a row overflows the usable width.
  // The on-screen layout is then invalid, and so would be the export.
  const anyKpiBandInvalid = kpiBandIds.some(
    (id, i) => state.getKpiBand(id).length > 0 && kpiLayouts[i].length === 0
  );
  if ((state.slicers.length > 0 && slicers.length === 0) || anyKpiBandInvalid) {
    return null;
  }

  return [
    ...charts.map(item => ({ kind: "chart", item })),
    ...slicers.map(item => ({ kind: "slicer", item })),
    ...kpis.map(item => ({ kind: "kpi", item }))
  ];
}

// Styling (element styles over the templates) is the same for every page, so
// it is built once per export.
function buildVisualJson({ kind, item }, n, visuals) {
  return {
    $schema: VISUAL_SCHEMA,
    name: genHash(),
    position: {
      x: Math.round(item.x),
      y: Math.round(item.y),
      z: Z_BASE[kind] + n,
      height: Math.round(item.height),
      width: Math.round(item.width),
      tabOrder: n * 1000
    },
    visual: structuredClone(visuals[kind])
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A refused or failed export shows an error toast, never alert(), which a
// browser may suppress and hide the reason.
export function exportPowerBILayout() {
  const liveSnap = captureSnapshot(); // active tab's true current state
  let result;
  try {
    result = buildExport(liveSnap);
  } catch (err) {
    console.error("[export]", err);
    result = { error: t("export.failed") };
  } finally {
    // Always return to the active tab's state, not the failed page's.
    loadSnapshot(liveSnap);
  }

  // The bell holds only the latest attempt's outcome. The same error is kept,
  // not dropped and re-added, so its toast doesn't fade out under a new one.
  const stale = state.warnings.filter(w => w !== result.error && isFrom(w, "export."));
  if (stale.length > 0) {
    state.setWarnings(state.warnings.filter(w => !stale.includes(w)));
    renderWarnings();
  }

  if (result.error) {
    addWarning(result.error, "error");
    return;
  }
  downloadBlob(result.zip, result.filename);
  // People get stuck getting the zip into Power BI, so every export points at
  // the guide. Under "export." like the errors, so only the latest outcome
  // stays in the bell.
  addWarning(t("export.done", { file: result.filename }), "info");
}

// The zip for every page, or { error } for the first page that can't be
// exported. Loads each tab's snapshot in turn; the caller restores the live
// one.
function buildExport(liveSnap) {
  const tabs = getTabs();
  const activeIndex = getActiveTabIndex();

  const styles = getElementStyles();
  const styledVisuals = {
    slicer: buildVisual("slicer", styles),
    kpi: buildVisual("kpi", styles),
    chart: buildVisual("chart", styles)
  };

  const pageOrder = [];
  const files = [];
  let activePageName = null;

  for (let i = 0; i < tabs.length; i++) {
    loadSnapshot(i === activeIndex ? liveSnap : tabs[i].snapshot);

    const visuals = collectVisuals();

    if (visuals === null) return { error: t("export.pageInvalid", { page: tabs[i].name }) };
    if (visuals.length === 0) return { error: t("export.pageEmpty", { page: tabs[i].name }) };

    const pageName = genHash();
    pageOrder.push(pageName);
    if (i === activeIndex) activePageName = pageName;

    const page = {
      $schema: PAGE_SCHEMA,
      name: pageName,
      displayName: tabs[i].name,
      displayOption: "FitToPage",
      height: state.CANVAS_HEIGHT,
      width: state.CANVAS_WIDTH
    };

    files.push({ path: `${PAGES_ROOT}/${pageName}/page.json`, data: JSON.stringify(page, null, 2) });

    visuals.forEach((entry, n) => {
      const visualJson = buildVisualJson(entry, n, styledVisuals);
      files.push({
        path: `${PAGES_ROOT}/${pageName}/visuals/${visualJson.name}/visual.json`,
        data: JSON.stringify(visualJson, null, 2)
      });
    });
  }

  // pages.json registers every page. Without it Power BI reports
  // "ActivePageName not found" for a pasted page that isn't listed.
  const pages = {
    $schema: PAGES_SCHEMA,
    pageOrder,
    activePageName
  };

  files.unshift({ path: `${PAGES_ROOT}/pages.json`, data: JSON.stringify(pages, null, 2) });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return { zip: createZip(files), filename: `kvapka-layout-${timestamp}.zip` };
}

export function initExportEvents() {
  const exportBtn = document.getElementById("export-layout");
  exportBtn.addEventListener("click", exportPowerBILayout);
}
