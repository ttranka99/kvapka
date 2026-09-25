// assets/js/export/styleToPbir.js
//
// Turns a type's element styles (elements/elementStyleModel.js) into the
// `visual` block of a PBIR visual.json. The base is the fixed template from
// visualTemplates.js, which also carries what the editor doesn't expose
// (pendingChangesIcon, stylePreset, drillFilterOtherVisuals…).
//
// Only the objects the user actually changed are written over it. An object
// with any field off its default gets every one of its editable fields
// written, so what Power BI draws is what the preview showed, not a mix of
// the edit and Power BI's own defaults. An untouched object is left exactly
// as the template has it, which is what keeps an uncustomized project's
// export byte-for-byte what it always was.

import { SLICER_TEMPLATE, KPI_TEMPLATE, CHART_TEMPLATE } from "./visualTemplates.js";
import { fieldsFor, CONTAINER_OBJECTS, sameValue } from "../elements/elementStyleModel.js";

const TEMPLATES = { slicer: SLICER_TEMPLATE, kpi: KPI_TEMPLATE, chart: CHART_TEMPLATE };

const literal = value => ({ expr: { Literal: { Value: value } } });

function encodeColor(color) {
  const expr = color.mode === "hex"
    ? { Literal: { Value: `'${color.hex}'` } }
    : { ThemeDataColor: { ColorId: color.id, Percent: color.percent } };
  return { solid: { color: { expr } } };
}

function encode(field, value) {
  switch (field.kind) {
    case "number": return literal(`${value}D`);
    case "bool": return literal(value ? "true" : "false");
    case "color": return encodeColor(value);
    default: return literal(`'${value}'`);        // enum, font
  }
}

/**
 * The `visual` block for one element type.
 * @param {"slicer"|"kpi"|"chart"} type
 * @param {object} styles  the whole style set (every type)
 */
export function buildVisual(type, styles) {
  const visual = structuredClone(TEMPLATES[type]);
  const values = styles[type];

  // The fields, grouped by the PBIR object they belong to.
  const byObject = new Map();
  fieldsFor(type).forEach(field => {
    const object = field.key.split(".")[0];
    if (!byObject.has(object)) byObject.set(object, []);
    byObject.get(object).push(field);
  });

  byObject.forEach((fields, object) => {
    if (fields.every(f => sameValue(values[f.key], f.default))) return;

    const home = CONTAINER_OBJECTS.includes(object) ? "visualContainerObjects" : "objects";
    visual[home] ??= {};
    visual[home][object] ??= [{ properties: {} }];
    const properties = visual[home][object][0].properties ??= {};
    fields.forEach(field => {
      properties[field.key.split(".")[1]] = encode(field, values[field.key]);
    });
  });

  return visual;
}
