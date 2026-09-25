// assets/js/i18n/locales/en.js
//
// All UI text of the app, in English. Edit the text on the right; leave the
// keys on the left alone — they are how the code finds each string.
//
//   {name}  a value filled in by the app (a number, a page name, …). Keep it,
//           though you may move it anywhere in the sentence.
//   { one: "…", few: "…", many: "…", other: "…" }
//           a string may be a plural set instead of a single text; the form
//           is picked by the {count} value (see Czech cs.js for language rules).
//
// A new language is a copy of this file with the same keys (e.g. en.js),
// registered in ../i18n.js.

export default {
  // --- Page -------------------------------------------------------------
  // The browser tab title and the page description for search engines.
  "app.title": "kvapka",
  "app.description": "Power BI report layout designer.",

  // --- Top bar ----------------------------------------------------------
  "topbar.brand": "kvapka",
  "topbar.subtitle": "Report Layout Designer",
  "topbar.export": "Export Layout",
  "topbar.notifications": "Notifications",
  // The CS / EN switch (read by screen readers).
  "topbar.language": "Language",

  // --- Page tabs (top bar) ----------------------------------------------
  "tabs.list": "Report Pages",
  "tabs.prev": "Previous Pages",
  "tabs.next": "Next Pages",
  "tabs.add": "Add Page",
  "tabs.close": "Remove Page",
  // The name a new page gets until the user renames it.
  "tabs.defaultName": "Page {n}",
  // Shown once at start when the browser won't keep pages between visits.
  "session.storageUnavailable": "This browser doesn't keep data between visits. Your pages will be lost when you close it.",

  // --- Undo / redo (top bar) --------------------------------------------
  // Button tooltips and labels; the shortcut is shown for discoverability.
  "history.group": "Undo and redo",
  "history.undo": "Undo (Ctrl+Z)",
  "history.redo": "Redo (Ctrl+Y)",

  // --- Project file (top bar "Project" menu) ----------------------------
  // Save / open all pages as a .kvapka.json file.
  "project.menu": "Project",
  "project.save": "Save project",
  "project.open": "Open project…",
  // Tooltip on "Open project" while the template editor is open.
  "project.openDisabled": "Close the template editor first.",
  // {name} is the opened file's name.
  "project.opened": "Opened {name}.",
  "project.invalidJson": "This file can't be read as a project: it isn't valid JSON.",
  "project.notProject": "This file isn't a kvapka project.",
  "project.newerVersion": "This project was saved by a newer version of kvapka and can't be opened here.",
  "project.damaged": "This project file is damaged or was edited by hand, so it wasn't opened. Your pages are unchanged.",
  "project.tooLarge": "This file is too large to be a kvapka project.",
  "project.readFailed": "The file couldn't be read.",

  // --- Notifications (bell panel) ---------------------------------------
  "notifications.title": "Notifications",
  "notifications.empty": "No notifications.",
  // Severity label above each toast's message.
  "notifications.type.error": "Error",
  "notifications.type.warning": "Warning",
  "notifications.type.info": "Info",

  // --- Confirm dialog ---------------------------------------------------
  "dialog.cancel": "Cancel",

  // --- Left rail --------------------------------------------------------
  "rail.label": "Sections",
  "rail.template": "Template",
  "rail.layout": "Custom Layout",
  "rail.elements": "Customize Elements",
  "rail.about": "About",

  // --- About modal (opened from the rail) -------------------------------
  "about.title": "About kvapka",
  "about.version": "Version {version}",
  "about.privacy": "Privacy policy",
  "about.terms": "Terms of use",
  "about.changelog": "Changelog",
  "about.feedback": "Feedback & source (GitHub)",
  "about.close": "Close",
  "legal.back": "Back",
  "legal.loading": "Loading…",

  // --- Help (rail ? button, or the ? key) --------------------------------
  // A `backticked` part is shown as code (a file or folder name).
  "rail.help": "Help",
  "help.button": "Help (?)",
  "help.title": "Help",
  "help.how.title": "How it works",
  "help.step1.title": "Pick a template",
  "help.step1.text": "In the Template panel choose the page resolution, where the slicers go and how many fit in a row, or build your own layout.",
  "help.step2.title": "Add and arrange elements",
  "help.step2.text": "Add slicers and KPIs from the sidebar, or hover a card's edge and click +. Drag the handles between cards to resize, lock a size with the lock icon, and click a card to see its exact position and size.",
  "help.step3.title": "Export to Power BI",
  "help.step3.text": "Export Layout downloads a zip with every page, ready to go into a Power BI project.",
  "help.how.note": "Your pages are saved in this browser as you work. To keep a copy or share it, use Project › Save project.",
  "help.import.title": "Import into Power BI (PBIR)",
  "help.import.intro": "The export holds the `definition/pages` folder of a Power BI project in PBIR format. It is not a .pbix file and can't be opened directly.",
  "help.import.step1": "In Power BI Desktop, save the report as a Power BI project (.pbip) in PBIR format. If your version lists \"Power BI Project (.pbip) save option\" and \"Store reports using enhanced metadata format (PBIR)\" under Preview features, turn them on first.",
  "help.import.step2": "Close Power BI Desktop.",
  "help.import.step3": "Back up the project folder, then delete the `definition/pages` folder inside `<name>.Report`.",
  "help.import.step4": "Unzip the export into `<name>.Report`, so its `definition/pages` takes that place.",
  "help.import.step5": "Open the .pbip again and fill the placeholder visuals with your fields.",
  "help.import.note": "The export replaces all of the report's pages, so a new, empty report is the safest place to start.",
  "help.keys.title": "Keyboard shortcuts",
  "help.keys.colKeys": "Keys",
  "help.keys.colAction": "Action",
  "help.keys.save": "Save the project",
  "help.keys.export": "Export for Power BI",
  "help.keys.undo": "Undo",
  "help.keys.redo": "Redo",
  "help.keys.delete": "Remove the selected element",
  "help.keys.deselect": "Clear the selection",
  "help.keys.arrows": "Select the neighbouring element",
  "help.keys.rename": "Rename the focused page tab",
  "help.keys.help": "Open this help",

  // --- Welcome (first visit only) ----------------------------------------
  "welcome.title": "Welcome to kvapka",
  "welcome.intro": "Design the layout of a Power BI report page in three steps:",
  "welcome.guide": "Show the full guide",
  "welcome.start": "Start designing",

  // --- "Customize Elements" placeholder section ------------------------------
  "elements.title": "Customize Elements",
  "elements.text": "Element customization (coming soon)",

  // --- Slicer placement (sidebar switch, theme editor, summary) ---------
  "placement.horizontal": "Top",
  "placement.verticalLeft": "Left",
  "placement.verticalRight": "Right",

  // --- Sidebar: Template panel -------------------------------------------
  "template.title": "Template",
  "template.intro": "Configure report layout and appearance",
  "template.resolution": "Resolution",
  "template.custom": "Custom Template",
  "template.customButton": "Custom Template…",
  "template.scope": "Template Scope",
  "template.scopePage": "This Page",
  "template.scopeAll": "All",
  // Note under the scope switch.
  "template.scopeNote": "This page: {page} · new pages: {default}",
  "template.slicers": "Slicers",
  "template.slicersPerRow": "Slicers per Row",
  "template.kpisPerRow": "KPIs per Row",
  "template.reset": "Reset Layout",
  // A placement option with no template of that shape yet.
  "template.placementMissingTitle": "No template with this slicer placement yet; create one via “Custom Template…”.",
  "template.placementMissingNote": "Missing template: {list}. Create a new one via “Custom Template…”.",
  // Template chips.
  "template.chipTitle": "{label} - canvas {width} × {height}",
  "template.chipEdit": "Edit template {label}",
  // A deleted template a page still uses, kept on that page by value.
  "template.chipDeleted": "{label} (deleted)",
  // Shown when no default template can be found.
  "template.noDefault": "—",

  // The folded panel's summary.
  "template.summary.resolution": "Resolution",
  "template.summary.scope": "Scope",
  "template.summary.slicers": "Slicers",
  "template.summary.kpi": "KPI",
  "template.summary.perRow": "{count} per Row",
  "template.summary.placementPerRow": "{placement} · {count} per Row",

  // --- Sidebar: selected element panel ----------------------------------
  "selection.title": "Selected Element",
  "selection.empty": "Click an element in the preview. Hover to show controls.",
  "selection.type": "Type",
  "selection.index": "Index",
  "selection.width": "Width",
  "selection.height": "Height",
  "selection.x": "X",
  "selection.y": "Y",
  "selection.editHint": "Double-click to edit the value",
  "selection.editValue": "Edit Value",
  "selection.editWidth": "Edit Width",
  "selection.editHeight": "Edit Height",
  "selection.copyValue": "Copy Value",
  "selection.copyWidth": "Copy Width",
  "selection.copyHeight": "Copy Height",
  "selection.copyX": "Copy X Value",
  "selection.copyY": "Copy Y Value",
  "selection.apply": "Apply Changes",
  // The "Type" value for each kind of element.
  "selection.kind.header": "Header",
  "selection.kind.slicer": "Slicer",
  "selection.kind.kpi": "KPI",
  "selection.kind.kpiBand": "KPI (band {n})",
  "selection.kind.chartRow": "Chart Row",
  "selection.kind.stackChart": "Chart (column)",

  // --- Sidebar: Add panel -----------------------------------------------
  "add.title": "Add",
  "add.slicer": "Slicer",
  "add.kpi": "KPI",
  "add.chart": "Chart",
  // Buttons for KPI bands below the header band.
  "add.kpiBand": "KPI – band {n}",
  "add.kpiBandMiddle": "KPI – middle band",

  // --- Canvas -----------------------------------------------------------
  "canvas.header": "Header ({width} × {height})",
  "canvas.slicer": "Slicer {n}",
  "canvas.kpi": "KPI {n}",
  "canvas.chart": "Chart {row}.{col}",
  "canvas.stackChart": "Chart {row}.{col}.{stack}",
  // Lock buttons (tooltip shows what a click will do).
  "canvas.lockSlicerWidth": "Lock slicer width",
  "canvas.unlockSlicerWidth": "Unlock slicer width",
  "canvas.lockSlicerHeight": "Lock slicer height",
  "canvas.unlockSlicerHeight": "Unlock slicer height",
  "canvas.lockKpiWidth": "Lock KPI width",
  "canvas.unlockKpiWidth": "Unlock KPI width",
  "canvas.lockChartHeight": "Lock chart height",
  "canvas.unlockChartHeight": "Unlock chart height",
  "canvas.lockChartWidth": "Lock chart width",
  "canvas.unlockChartWidth": "Unlock chart width",
  "canvas.unlockRowHeight": "Unlock row height",
  "canvas.unlockChartWidthAndRow": "Unlock chart width and row height",
  // Remove (×) buttons.
  "canvas.removeSlicer": "Remove Slicer",
  "canvas.removeKpi": "Remove KPI",
  "canvas.removeChart": "Remove Chart",
  // Add (+) buttons.
  "canvas.addSlicer": "Add Slicer",
  "canvas.addKpi": "Add KPI",
  "canvas.addChartBelow": "Add Chart Below",
  "canvas.addChartLeft": "Add Chart Left",
  "canvas.addChartRight": "Add Chart Right",
  "canvas.addChartRowBelow": "Add Chart Row Below",

  // --- Notifications: slicers -------------------------------------------
  "warnings.slicer.limit": "Maximum number of slicers reached.",
  "warnings.slicer.columnFull": "The next slicer won't fit in the column; unlock heights or remove a slicer.",
  "warnings.slicer.maxPerRow": "Maximum slicers per row reached. Following slicers will be placed on the next row.",
  "warnings.slicer.secondRowLimit": "The second row of slicers exceeds the selected limit.",
  "warnings.slicer.secondRowOverflow": "Slicers won't fit in the second row; adjust widths or remove a slicer.",
  "warnings.slicer.columnOverflow": "Slicers won't fit in the column; reduce locked heights or remove a slicer.",
  "warnings.slicer.manualWidthSum": "The sum of manually set slicer widths exceeds available width.",
  "warnings.slicer.tightFit": "Insufficient space; some slicers may be too narrow.",
  "warnings.slicer.minHeight": "Minimum slicer height is {min}px.",
  "warnings.slicer.heightNoFit": "The specified height won't fit in the column; adjust the value.",
  "warnings.slicer.columnWidthMax": "Column width cannot be increased further; unlock some charts or KPIs.",

  // --- Notifications: KPI -----------------------------------------------
  "warnings.kpi.limit": "Maximum number of KPIs reached.",
  "warnings.kpi.bandFull": "KPI band “{band}” is full; increase the per-row limit or remove a KPI.",
  "warnings.kpi.maxPerRow": "Maximum KPIs per row reached. Following KPIs will be placed on the next row.",
  "warnings.kpi.hardLimit": "Maximum number of KPIs reached.",
  "warnings.kpi.secondRowLimit": "The second row of KPIs exceeds the selected limit.",
  "warnings.kpi.row1ManualWidthSum": "The sum of manually set KPI widths exceeds the maximum value.",
  "warnings.kpi.row1Overflow": "KPIs won't fit in available width; adjust widths or remove a KPI.",
  "warnings.kpi.row2ManualWidthSum": "The sum of manually set KPI widths on the second row exceeds the maximum value.",
  "warnings.kpi.row2Overflow": "KPIs won't fit in available width; adjust width or remove a KPI.",
  "warnings.kpi.bandOverflow": "KPIs in band “{band}” won't fit in available width; adjust width or remove a KPI.",
  "warnings.kpi.bandLimit": "KPIs in band “{band}” exceed the selected per-row limit.",
  "warnings.kpi.minHeight": "Minimum KPI height is {min}px.",
  "warnings.kpi.cardsDropped": "Template without KPI band - {count} KPIs from the removed band were dropped.",

  // --- Notifications: charts --------------------------------------------
  "warnings.chart.allLocked": "Cannot add another chart; all charts in the row are locked. Unlock at least one chart first.",
  "warnings.chart.allLockedStackNote": "{message} (For a column with multiple charts, all charts in that column must be unlocked.)",
  "warnings.chart.noSpace": "Insufficient space to add another chart.",
  "warnings.chart.tooSmall": "Cannot add another chart; other charts would become too small.",
  "warnings.chart.adjustRowHeights": "Cannot add another chart; adjust chart row heights first.",
  "warnings.chart.removeUnlockRow": "Cannot remove the chart; unlock at least one chart in the row first.",
  "warnings.chart.splitTooLow": "Cannot split the chart; the row is too low (min. {min}px).",
  "warnings.chart.stackAllLocked": "Cannot add another chart; all charts in the column are locked. Unlock at least one chart first.",
  "warnings.chart.stackTooSmall": "Cannot add another chart; charts in the column would become too small.",
  "warnings.chart.removeLocked": "Cannot remove a locked chart; unlock it first.",
  "warnings.chart.removeUnlockStack": "Cannot remove the chart; unlock at least one chart in the column first.",
  "warnings.chart.minWidth": "Minimum chart width is {min}px.",
  "warnings.chart.widthUnlockRow": "Cannot adjust chart width; unlock at least one chart in the row first.",
  "warnings.chart.stackMinHeight": "Minimum chart height in the column is {min}px.",
  "warnings.chart.heightUnlockStack": "Cannot adjust chart height; unlock at least one chart in the column first.",
  "warnings.chart.heightNoFitRow": "The specified height won't fit in the row; choose another value.",
  "warnings.chart.rowMinHeightStack": "Minimum row height is {min}px (contains a chart column).",
  "warnings.chart.rowMinHeight": "Minimum chart row height is {min}px.",
  "warnings.chart.singleRow": "Cannot adjust height; the single chart row always fills available space.",
  "warnings.chart.rowUnlockOther": "Cannot adjust row height; unlock at least one chart row first.",

  // --- Notifications: typed sizes (selected element panel) --------------
  "warnings.size.minWidth": "Minimum width is 50px.",
  "warnings.size.widthNoFit": "The specified width won't fit in the space; choose another value.",
  "warnings.size.heightNoFit": "The specified height won't fit in the space; choose another value.",
  "warnings.size.invalidNumber": "Enter a valid number.",
  "warnings.copyFailed": "Copy failed.",

  // --- Notifications: templates -----------------------------------------
  "warnings.theme.deleted": "Template deleted.",
  "warnings.theme.saved": "Template “{label}” applied and saved.",

  // --- Power BI export (error toasts) -----------------------------------
  "export.pageInvalid": "The layout on page \"{page}\" has errors (elements don't fit on the canvas); fix them before exporting.",
  "export.pageEmpty": "Page \"{page}\" is empty; add at least one element.",
  "export.failed": "Export failed unexpectedly. Your pages are unchanged; please try again.",
  // Info toast after a successful export; {file} is the zip's name.
  "export.done": "Exported {file}. See Help › Import into Power BI for the next step.",

  // --- Template editor: header ------------------------------------------
  "editor.region": "Custom Template Editor",
  "editor.name": "Template Name",
  // Suffix of the name a copied template starts with.
  "editor.copyName": "{label} - copy",
  "editor.import": "Import",
  "editor.importTitle": "Load a template from a JSON file",
  "editor.export": "Export",
  "editor.exportTitle": "Save this template as JSON",
  "editor.cancel": "Cancel",
  "editor.delete": "Delete",
  "editor.deleteTitle": "Delete this template",
  "editor.save": "Save & Apply",
  // File name of an exported template; {name} is the template name.
  "editor.exportFileName": "kvapka-template-{name}.json",
  "editor.exportFallbackName": "template",

  // --- Template editor: controls ----------------------------------------
  "editor.resetToBase": "Default Settings",
  "editor.placement": "Slicer Placement",
  "editor.placementLocked": "Slicer placement is part of the template and doesn't change after saving. Create an alternative as a new template.",
  "editor.dragToAdjust": "Drag to adjust: {field}",

  // KPI bands list.
  "editor.band.header": "KPI band (header)",
  "editor.band.afterRow": "KPI band {n} · below row {row}",
  "editor.band.remove": "Remove this KPI band",
  "editor.band.count": "KPI Count",
  "editor.band.secondRow": "Second Row",
  "editor.band.yes": "Yes",
  "editor.band.no": "No",
  "editor.band.gapBefore": "Gap Before",
  "editor.band.gapBeforeHint": "Auto: gap is derived from the layout. Small/Large: gap is fixed regardless of surroundings.",
  "editor.band.gapAuto": "Auto",
  "editor.band.gapSmall": "Small",
  "editor.band.gapBlock": "Large",
  "editor.band.hint": "Each KPI band represents its own section in the report layout; the first lies below the header, each subsequent one within the chart area.",
  "editor.band.add": "Add KPI Band",

  // --- Template editor: preview -----------------------------------------
  "editor.preview.title": "Rules Preview",
  "editor.preview.rows": "Sample Chart Rows",
  "editor.preview.usable": "Usable area {width} × {height}",
  "editor.preview.margin": "Canvas margin · {value} px",
  "editor.preview.header": "Header · {height} px",
  "editor.preview.slicerColumn": "Slicer column · {width} px ({min}–{max})",
  "editor.preview.slicers": "Slicers · {count}× {width} px · min {min} px · height {height} px",
  "editor.preview.kpi": "KPI · {count}× {width} px · height {height} px",
  "editor.preview.charts": "Charts · row {height} px (min {min}) · min width {width} px",
  "editor.preview.band": "KPI band · {count}× {width} px · below row {row}",
  "editor.preview.gap": "{value} px",
  "editor.preview.moveBand": "Move band: {label}",
  "editor.preview.moveBandHint": "Drag, or Ctrl + up/down arrow, to move this band.",

  // Readout under the preview.
  "editor.stat.canvas": "Canvas",
  "editor.stat.usable": "Usable Area",
  "editor.stat.rowHeight": "Chart Row Height",
  "editor.stat.contentWidth": "Content Width",
  "editor.stat.step": "Grid Step",
  "editor.stat.size": "{width} × {height}",
  "editor.stat.px": "{value} px",

  // --- Template editor: messages ----------------------------------------
  "editor.ok": "Template is valid.",
  "editor.nameRequired": "Enter a template name.",
  "editor.confirmDeleteTitle": "Delete template “{label}”?",
  "editor.confirmDelete": "Pages that use it will keep its current settings; new pages will start on FULL HD or HD.",
  "editor.imported": "Template “{label}” loaded.",
  "editor.readFailed": "Failed to read file.",

  // Checks shown under the preview.
  "editor.issue.usableWidth": "Usable width is less than 200 px; reduce margin or increase canvas width.",
  "editor.issue.usableHeight": "Usable height is less than 200 px; reduce margin or increase canvas height.",
  "editor.issue.columnTooWide": "Slicer column takes up most of the width; no minimum width left for charts.",
  "editor.issue.slicerRow": "A row of {count} slicers needs {need} px at minimum width. Available: {available} px.",
  "editor.issue.chartRow": "A row of {count} charts won't fit on the canvas at the set minimum width.",
  "editor.issue.height": "Header, slicers, and KPI need {need} px in height; available {available} px; charts will shrink below minimum.",
  "editor.issue.step": "Grid step is larger than gaps between elements; dimensions may be imprecise.",
  "editor.issue.manyBands": "The layout has {count} KPI bands; the selected settings make navigation difficult.",
  "editor.issue.rowsTooSmall": "With {rows} rows, row height falls below the absolute minimum of {min} px.",

  // --- Saving and importing templates -----------------------------------
  "themeStore.builtinOverwrite": "Cannot overwrite a built-in template; save it as a new one.",
  "themeStore.saveFailed": "Failed to save template to browser storage (storage unavailable or full).",
  "themeStore.builtinDelete": "Cannot delete a built-in template.",
  "themeStore.notFound": "Template not found.",
  "themeStore.changeFailed": "Failed to save the change.",
  "themeStore.invalidJson": "File is not valid JSON.",
  "themeStore.noThemes": "File contains no templates.",

  // --- Template editor: setting groups ----------------------------------
  "themeGroup.canvas": "Canvas",
  "themeGroup.spacing": "Margins & Gaps",
  "themeGroup.header": "Header",
  "themeGroup.slicers": "Slicers",
  "themeGroup.kpis": "KPIs",
  "themeGroup.charts": "Charts",
  "themeGroup.limits": "Slicer & KPI Counts",
  "themeGroup.limits.note": "The first two values set the range available in the “Slicers per Row” and “KPIs per Row” fields in the sidebar. Chart count per row is unlimited; it depends on minimum chart width.",
  "themeGroup.limits.verticalNote": "The first two values set the range available in the “KPIs per Row” field in the sidebar. The setting doesn't affect slicers in a column. Chart count per row is unlimited; it depends on minimum chart width.",
  "themeGroup.grid": "Grid",

  // --- Template editor: settings ----------------------------------------
  // .label is the setting's name, .hint the explanation under it. The
  // .vertical* variants replace them in a layout with slicers in a column.
  "themeField.canvasWidth.label": "Canvas Width",
  "themeField.canvasHeight.label": "Canvas Height",
  "themeField.margin.label": "Canvas Margin",
  "themeField.margin.hint": "Free space between canvas edge and usable area",
  "themeField.gapSmall.label": "Gap Between Elements",
  "themeField.gapSmall.hint": "Base spacing between adjacent elements in a row and between visual rows.",
  "themeField.gapKpiToCharts.label": "Gap Between Blocks",
  "themeField.gapKpiToCharts.hint": "Wider gap separating logical blocks: slicers from content, KPI from charts.",
  "themeField.titleHeight.label": "Header Height",
  "themeField.slicerHeight.label": "Slicer Height",
  "themeField.slicerHeight.hint": "Fixed height of slicers in a horizontal band.",
  "themeField.slicerHeight.verticalLabel": "Min. Slicer Height",
  "themeField.slicerHeight.verticalHint": "Minimum (and default) height of a single slicer in a column, from which the available slicer count is derived.",
  "themeField.minSlicerWidth.label": "Min. Slicer Width",
  "themeField.slicerColumnWidth.label": "Column Width",
  "themeField.slicerColumnWidth.hint": "Default width of a vertical slicer column.",
  "themeField.minSlicerColumnWidth.label": "Min. Column Width",
  "themeField.maxSlicerColumnWidth.label": "Max. Column Width",
  "themeField.slicerFillThreshold.label": "Column Fill Threshold",
  "themeField.slicerFillThreshold.hint": "Once slicers at minimum height fill at least this portion of the column, they expand evenly to fill the entire height.",
  "themeField.kpiMinHeight.label": "KPI Height",
  "themeField.minChartRowHeight.label": "Min. Row Height",
  "themeField.minChartWidth.label": "Min. Chart Width",
  "themeField.hardMinChartHeight.label": "Absolute Min. Height",
  "themeField.hardMinChartHeight.hint": "Hard floor for chart shrinking when rows otherwise won't fit on the canvas.",
  "themeField.minPerRow.label": "Min. Slicers/KPIs per Row",
  "themeField.minPerRow.verticalLabel": "Min. KPIs per Row",
  "themeField.maxPerRow.label": "Max. Slicers/KPIs per Row",
  "themeField.maxPerRow.verticalLabel": "Max. KPIs per Row",
  "themeField.secondRowMaxItems.label": "Max. Slicers/KPIs on 2nd Row",
  "themeField.secondRowMaxItems.hint": "How many fit on the second row when the first is full. The sum with the per-row limit is an absolute ceiling; 0 disables the second row. The middle KPI band is always single-row and not affected by this setting.",
  "themeField.secondRowMaxItems.verticalLabel": "Max. KPIs on 2nd Row",
  "themeField.secondRowMaxItems.verticalHint": "How many KPIs fit on the second row when the first is full. The sum with the per-row limit is an absolute ceiling; 0 disables the second row. The middle KPI band is always single-row and not affected by this setting.",
  "themeField.defaultSlicersPerRow.label": "Default Slicers per Row",
  "themeField.defaultSlicersPerRow.hint": "Value the page starts with when using this template. Can be changed anytime in the sidebar.",
  "themeField.defaultKpisPerRow.label": "Default KPIs per Row",
  "themeField.step.label": "Grid Step",
  "themeField.step.hint": "All computed and manually entered dimensions align to a multiple of this value."
};
