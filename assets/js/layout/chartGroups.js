// assets/js/layout/chartGroups.js
//
// Splits the theme's ordered `charts` sections across the chart rows that
// actually exist. A section with a fixed `rows` count claims that many rows
// (in author order, clamped by whatever's left); the one section with
// `rows: null` — normalizeTheme() in themeModel.js guarantees there's always
// exactly one — absorbs everything nobody else claimed, including zero.
//
// Pure and side-effect free: computeVerticalLayout() calls it during its
// measure pass to know how many active chart groups it's placing, and again
// (implicitly, via the returned groups) once rows are solved to lay them out.

export function computeChartGroups(sections, totalRows) {
  const chartsSections = sections.filter(s => s.type === "charts");
  const groups = chartsSections.map(s => ({ sectionId: s.id, startRow: 0, count: 0 }));

  let consumed = 0;
  let nullIndex = -1;

  chartsSections.forEach((s, i) => {
    if (s.rows === null) {
      // Filled in below, once every fixed-count section has claimed its
      // share — the open-ended group only knows what's left afterward.
      nullIndex = i;
      return;
    }
    const remaining = Math.max(0, totalRows - consumed);
    const count = Math.min(s.rows, remaining);
    groups[i].startRow = consumed;
    groups[i].count = count;
    consumed += count;
  });

  if (nullIndex >= 0) {
    groups[nullIndex].startRow = consumed;
    groups[nullIndex].count = Math.max(0, totalRows - consumed);
  }

  return groups;
}
