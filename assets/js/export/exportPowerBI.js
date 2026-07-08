// assets/js/export/exportPowerBI.js
//
// Exports the current layout as the content of a PBIR definition/pages
// folder: pages.json + <pageHash>/page.json + one
// <pageHash>/visuals/<hash>/visual.json per slicer, KPI and chart, zipped
// for download.
// Styling comes verbatim from visualTemplates.js; positions come from the
// same pure layout functions the renderer uses. The header/title element is
// intentionally not exported.

import * as state from "../state/state.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeSlicersLayout } from "../layout/computeSlicersLayout.js";
import { computeKpiLayout } from "../layout/computeKpiLayout.js";
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

  const charts = computeChartsLayout(v).flat();
  const slicers = computeSlicersLayout(v).flat();
  const kpis = computeKpiLayout(v).flat();

  // The slicer/KPI layouts return [] when the row overflows the usable
  // width — in that case the on-screen layout is invalid and so would be
  // the export.
  if (
    (state.slicers.length > 0 && slicers.length === 0) ||
    (state.kpis.length > 0 && kpis.length === 0)
  ) {
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
  const visuals = collectVisuals();

  if (visuals === null) {
    alert("Rozložení obsahuje chyby (prvky se nevejdou na plátno) – před exportem je opravte.");
    return;
  }

  if (visuals.length === 0) {
    alert("Není co exportovat – přidejte alespoň jeden prvek.");
    return;
  }

  const pageName = genHash();

  const page = {
    $schema: PAGE_SCHEMA,
    name: pageName,
    displayName: "Page 1",
    displayOption: "FitToPage",
    height: state.CANVAS_HEIGHT,
    width: state.CANVAS_WIDTH
  };

  // pages.json registers the page — without it Power BI reports
  // "ActivePageName not found" when the pasted page isn't listed.
  const pages = {
    $schema: PAGES_SCHEMA,
    pageOrder: [pageName],
    activePageName: pageName
  };

  const files = [
    { path: "pages.json", data: JSON.stringify(pages, null, 2) },
    { path: `${pageName}/page.json`, data: JSON.stringify(page, null, 2) }
  ];

  visuals.forEach((entry, n) => {
    const visualJson = buildVisualJson(entry, n);
    files.push({
      path: `${pageName}/visuals/${visualJson.name}/visual.json`,
      data: JSON.stringify(visualJson, null, 2)
    });
  });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  downloadBlob(createZip(files), `kb-layout-${state.activeTemplate}-${timestamp}.zip`);
}

export function initExportEvents() {
  const exportBtn = document.getElementById("export-layout");
  exportBtn.addEventListener("click", exportPowerBILayout);
}
