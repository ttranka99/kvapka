import * as state from "../state/state.js";
import { setSelected } from "../ui/selection.js";
import { addWarning } from "../ui/warnings.js";
import { computeVerticalLayout } from "../layout/computeVerticalLayout.js";
import { computeChartsLayout } from "../layout/computeChartsLayout.js";
import { computeChartRowHeights } from "../layout/computeChartRowHeights.js";
import { canAddChart } from "../layout/canAddChart.js";
import { renderLayout } from "../ui/renderLayout.js";
import { renderWarnings } from "../ui/warnings.js";

// Add chart to the left
export function handleAddChartLeft(rowIndex, itemIndex) {
  // Simulate: keep truly locked charts as-is; every unlocked chart —
  // including ones that were unlocked earlier and are still holding onto
  // their old width (see handleToggleChartLock) — gets freed back to auto
  // width here, at the moment of an actual structural change, so it can
  // shrink and make room for the newly inserted chart. Unlocking alone
  // never does this; only a real add/remove does.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  simulatedRow.items = simulatedRow.items.map(item =>
    item.locked ? item : { ...item, width: null }
  );

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex, 0, { width: null, locked: false });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nedostatek prostoru pro přidání grafu", "error");
    return;
  }

  state.chartRows[rowIndex] = simulatedRow;
  state.setChartRows([...state.chartRows]);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Add chart to the right
export function handleAddChartRight(rowIndex, itemIndex) {
  // Simulate: keep truly locked charts as-is; every unlocked chart —
  // including ones that were unlocked earlier and are still holding onto
  // their old width (see handleToggleChartLock) — gets freed back to auto
  // width here, at the moment of an actual structural change, so it can
  // shrink and make room for the newly inserted chart. Unlocking alone
  // never does this; only a real add/remove does.
  const simulated = JSON.parse(JSON.stringify(state.chartRows));
  const simulatedRow = simulated[rowIndex];

  simulatedRow.items = simulatedRow.items.map(item =>
    item.locked ? item : { ...item, width: null }
  );

  // Insert new chart (unlocked)
  simulatedRow.items.splice(itemIndex + 1, 0, { width: null, locked: false });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat graf — všechny grafy by byly příliš malé.", "error");
    return;
  }

  state.chartRows[rowIndex] = simulatedRow;
  state.setChartRows([...state.chartRows]);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Add new chart row below
export function handleAddChartRow(rowIndex) {
  const simulated = JSON.parse(JSON.stringify(state.chartRows));

  // Free every existing row's height lock before inserting the new one.
  // There's currently no way for the user to manually unlock a row's height
  // (unlike chart width, which has a dedicated lock/unlock control) — so
  // without this, any row that became height-locked (via the sidebar height
  // editor, or the row-height drag handle, which locks both rows it touches)
  // would permanently reserve its fixed share of the available height,
  // making it impossible to ever add another row again even when there'd
  // otherwise be plenty of total room once everything redistributed.
  simulated.forEach(row => {
    row.height = null;
    row.locked = false;
  });

  simulated.splice(rowIndex + 1, 0, { height: null, locked: false, items: [{}] });

  const vLayout = computeVerticalLayout();
  if (!canAddChart(simulated, vLayout)) {
    addWarning("Nelze přidat další graf — uprav výšky řad grafů.", "error");
    return;
  }

  state.setChartRows(simulated);
  // Clear previous warnings and update UI since layout changed
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Remove chart
export function handleRemoveChart(rowIndex, itemIndex) {
  const newRows = JSON.parse(JSON.stringify(state.chartRows));
  const rowItems = newRows[rowIndex].items;

  if (rowItems.length > 1) {
    const remainingAfterRemoval = rowItems.filter((_, i) => i !== itemIndex);
    const anyUnlockedRemaining = remainingAfterRemoval.some(item => !item.locked);

    // If every chart left in the row would be locked, there'd be nothing
    // flexible left to absorb the space the removed chart leaves behind —
    // it would just sit there as a dead gap instead of the row filling back
    // up. Block the removal and ask the user to unlock something first,
    // rather than silently leaving that gap.
    if (!anyUnlockedRemaining) {
      addWarning("Nelze odebrat graf — nejprve odemkněte alespoň jeden graf v řadě.", "error");
      return;
    }

    // remove the item
    rowItems.splice(itemIndex, 1);
    // Free only the still-unlocked charts so they redistribute into the
    // space left behind; truly locked charts keep their fixed width and
    // position untouched.
    newRows[rowIndex].items = newRows[rowIndex].items.map(item =>
      item.locked ? item : { ...item, width: null, locked: false }
    );
  } else if (newRows.length > 1) {
    // remove the whole row; other rows will recompute their widths
    newRows.splice(rowIndex, 1);

    // Free the remaining rows' height locks too. Without this, a row that
    // had become height-locked (via the sidebar height editor, or the
    // row-height drag handle, which locks both rows it touches) would keep
    // its old fixed height even though a whole row's worth of vertical
    // space just freed up above/below it — leaving that freed space as a
    // blank gap instead of the remaining row(s) expanding to fill it.
    newRows.forEach(row => {
      row.height = null;
      row.locked = false;
    });
  }

  state.setChartRows(newRows);
  // Clear warnings after removal (previous warning may no longer apply)
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Toggle width-lock for a single chart. Locking freezes the chart's current
// computed width so it's excluded from auto-redistribution when charts are
// added/removed elsewhere in the row. This is independent of the chart row's
// height lock (a separate, row-level concern handled in resizeEvents.js).
// Unlocking leaves the current width in place — it does not immediately
// resume auto-resizing. It only rejoins the flexible pool the next time an
// actual add/remove happens in its row (see handleAddChartLeft/Right/Row and
// handleRemoveChart), which is what freshly frees up unlocked charts' widths.
export function handleToggleChartLock(rowIndex, itemIndex) {
  const row = state.chartRows[rowIndex];
  const item = row?.items?.[itemIndex];
  if (!item) return;

  if (item.locked) {
    // Unlocking deliberately keeps the current width in place rather than
    // nulling it — the chart's position/size shouldn't visibly jump just
    // because it was unlocked. It stays put until something actually changes
    // the row's item count (add/remove), which is what explicitly nulls
    // every item's width in that row to force a fresh even redistribution
    // (see handleAddChartLeft/Right/Row and handleRemoveChart above).
    item.locked = false;
  } else {
    const v = computeVerticalLayout();
    const rowsLayout = computeChartsLayout(v);
    const currentWidth = rowsLayout[rowIndex]?.[itemIndex]?.width;
    item.width = currentWidth;
    item.locked = true;
  }

  state.setChartRows([...state.chartRows]);
  state.setWarnings([]);
  renderLayout();
  renderWarnings();
}

// Select chart row
export function handleSelectChart(item, rowIndex, domId, heights) {
  setSelected({
    kind: "chartRow",
    labelType: "Řada grafů",
    labelIndex: rowIndex + 1,
    x: item.x,
    y: item.y,
    width: item.width,
    height: heights[rowIndex],
    domId,
    rowIndex
  });
}

// Re-syncs the selection panel (and the "selected" highlight) to a chart's
// current geometry mid-drag. Resize handlers call this after mutating
// state and re-rendering, so if the chart being dragged is also the one
// currently selected, the panel doesn't go stale until the user re-clicks
// it. Keys off the selected domId rather than the resize in progress, so
// the same helper works for both width drags (own width changes) and
// row-height drags (own row's height changes) without needing to know
// which kind of resize triggered it.
export function refreshSelectedChartAfterResize() {
  const selected = state.selectedElement;
  if (!selected || selected.kind !== "chartRow" || !selected.domId) return;

  const match = /^chart-(\d+)-(\d+)$/.exec(selected.domId);
  if (!match) return;

  const rowIndex = Number(match[1]);
  const itemIndex = Number(match[2]);

  const v = computeVerticalLayout();
  const chartsLayout = computeChartsLayout(v);
  const heights = computeChartRowHeights(v);
  const item = chartsLayout[rowIndex]?.[itemIndex];
  if (!item) return;

  handleSelectChart(item, rowIndex, selected.domId, heights);
}