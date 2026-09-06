// assets/js/export/exportPowerBI.js
//
// Exports every tab as a page in a PBIR definition/pages folder: pages.json
// (pageOrder + activePageName) + one <pageHash>/page.json +
// <pageHash>/visuals/<hash>/visual.json per slicer, KPI and chart per page,
// zipped for download.
// Styling comes verbatim from visualTemplates.js; positions come from the
// same pure layout functions the renderer uses. The header/title element is
// intentionally not exported.
//
// The layout functions read live module state, but only the active tab's
// live state is current — other tabs' layouts live in their snapshots
// (state/tabs.js). So each tab's snapshot is loaded into live state in turn
// to compute its geometry, and the original live state is restored after.

import * as state from "../state/state.js";
import { getTabs, getActiveTabIndex, captureSnapshot, loadSnapshot } from "../state/tabs.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import { computeKpiLayoutForBand } from "../layout/computeKpiLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import {
  VISUAL_SCHEMA,
  PAGE_SCHEMA,
  PAGES_SCHEMA,
  SLICER_TEMPLATE,
  KPI_TEMPLATE,
  CHART_TEMPLATE
} from "./visualTemplates.js";
import { createZip } from "./zip.js";

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

  // The slicer/KPI layouts return [] when the row overflows the usable
  // width — in that case the on-screen layout is invalid and so would be
  // the export.
  const anyKpiBandInvalid = kpiBandIds.some(
    (id, i) => state.getKpiBand(id).length > 0 && kpiLayouts[i].length === 0
  );
  if ((state.slicers.length > 0 && slicers.length === 0) || anyKpiBandInvalid) {
    return null;
  }

  return [
    ...charts.map(item => ({ kind: "chart", template: CHART_TEMPLATE, item })),
    ...slicers.map(item => ({ kind: "slicer", template: SLICER_TEMPLATE, item })),
    ...kpis.map(item => ({ kind: "kpi", template: KPI_TEMPLATE, item }))
  ];
}

function buildVisualJson({ kind, template, item }, n) {
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
    visual: structuredClone(template)
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

export function exportPowerBILayout() {
  const tabs = getTabs();
  const activeIndex = getActiveTabIndex();
  const liveSnap = captureSnapshot(); // active tab's true current state

  const pageOrder = [];
  const files = [];
  let activePageName = null;

  for (let i = 0; i < tabs.length; i++) {
    loadSnapshot(i === activeIndex ? liveSnap : tabs[i].snapshot);

    const visuals = collectVisuals();

    if (visuals === null) {
      loadSnapshot(liveSnap);
      alert(`Rozložení na stránce "${tabs[i].name}" obsahuje chyby (prvky se nevejdou na plátno), před exportem je opravte.`);
      return;
    }

    if (visuals.length === 0) {
      loadSnapshot(liveSnap);
      alert(`Stránka "${tabs[i].name}" je prázdná, přidejte alespoň jeden prvek.`);
      return;
    }

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

    files.push({ path: `${pageName}/page.json`, data: JSON.stringify(page, null, 2) });

    visuals.forEach((entry, n) => {
      const visualJson = buildVisualJson(entry, n);
      files.push({
        path: `${pageName}/visuals/${visualJson.name}/visual.json`,
        data: JSON.stringify(visualJson, null, 2)
      });
    });
  }

  loadSnapshot(liveSnap); // restore the active tab's live state

  // pages.json registers every page — without it Power BI reports
  // "ActivePageName not found" when a pasted page isn't listed.
  const pages = {
    $schema: PAGES_SCHEMA,
    pageOrder,
    activePageName
  };

  files.unshift({ path: "pages.json", data: JSON.stringify(pages, null, 2) });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  downloadBlob(createZip(files), `kb-layout-${timestamp}.zip`);
}

export function initExportEvents() {
  const exportBtn = document.getElementById("export-layout");
  exportBtn.addEventListener("click", exportPowerBILayout);
}
