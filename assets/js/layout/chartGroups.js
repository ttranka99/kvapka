// assets/js/layout/chartGroups.js
//
// Splits the theme's `charts` sections across the chart rows that exist.
// A section with a fixed `rows` count claims that many rows, in order and
// capped by what's left. The one section with `rows: null` (guaranteed by
// normalizeTheme() in themeModel.js) takes the rest, possibly zero.
//
// Pure. computeVerticalLayout() uses it to count active chart groups.

export function computeChartGroups(sections, totalRows) {
  const chartsSections = sections.filter(s => s.type === "charts");
  const groups = chartsSections.map(s => ({ sectionId: s.id, startRow: 0, count: 0 }));

  let consumed = 0;
  let nullIndex = -1;

  chartsSections.forEach((s, i) => {
    if (s.rows === null) {
      // Filled in below, after the fixed-count sections have claimed rows.
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
