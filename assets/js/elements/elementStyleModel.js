// assets/js/elements/elementStyleModel.js
//
// What Customize Elements can change on each exported visual, and the
// defaults. Like FIELDS in theme/themeModel.js, this table is the single
// source of truth: it drives the controls, the preview, the export
// (export/styleToPbir.js) and the clamping in normalizeElementStyles().
//
// One style set per element type (slicer / KPI card / chart), shared by every
// page. A field's key is its PBIR address, "<object>.<property>", e.g.
// "border.radius" is visual.visualContainerObjects.border[0].properties.radius.
// So the export needs no second mapping. Names were checked against
// Microsoft's report theme schema (reportThemeSchema-2.157.json: commonCards,
// visual-slicer, visual-card).
//
// Defaults match what export/visualTemplates.js always exported, plus Power
// BI's own defaults for anything the templates leave out. An uncustomized
// project therefore exports the same files as before.
//
// A color is a fixed hex or a theme slot with a shade: { mode: "hex", hex } or
// { mode: "theme", id, percent } (the ThemeDataColor the templates use).

import { t } from "../i18n/i18n.js";

export const ELEMENT_TYPES = ["slicer", "kpi", "chart"];

// The PBIR objects that live on the visual container rather than the visual.
export const CONTAINER_OBJECTS = ["background", "border", "dropShadow", "padding", "title", "visualHeader", "visualTooltip"];

// Power BI's built-in fonts, with the CSS stack the preview uses for each.
export const FONTS = {
  "Segoe UI": "'Segoe UI', system-ui, sans-serif",
  "Segoe UI Semibold": "'Segoe UI Semibold', 'Segoe UI', system-ui, sans-serif",
  "Segoe UI Light": "'Segoe UI Light', 'Segoe UI', system-ui, sans-serif",
  "Arial": "Arial, Helvetica, sans-serif",
  "Arial Black": "'Arial Black', Arial, sans-serif",
  "Calibri": "Calibri, Carlito, sans-serif",
  "Candara": "Candara, Calibri, sans-serif",
  "Consolas": "Consolas, 'Courier New', monospace",
  "Corbel": "Corbel, Calibri, sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
  "DIN": "DIN, 'D-DIN', Bahnschrift, sans-serif",
  "Georgia": "Georgia, serif",
  "Tahoma": "Tahoma, Verdana, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  "Trebuchet MS": "'Trebuchet MS', sans-serif",
  "Verdana": "Verdana, sans-serif"
};

// The theme color slots as the preview draws them (Power BI's default theme).
// ColorId 0 is the background, 1 the foreground, 2+ the data colors. In
// Power BI they follow the report's own theme.
export const THEME_COLORS = [
  "#FFFFFF", "#252423", "#118DFF", "#12239E", "#E66C37",
  "#6B007B", "#E044A7", "#744EC2", "#D9B300", "#D64550"
];

export const SHADOW_PRESETS = ["TopLeft", "Top", "TopRight", "Left", "Center", "Right", "BottomLeft", "Bottom", "BottomRight"];

const theme = (id, percent = 0) => ({ mode: "theme", id, percent });
const hex = value => ({ mode: "hex", hex: value });

// --- Field builders --------------------------------------------------------
//
// part  — the preview region the field changes; hovering either side
//         highlights the other.
// group — the collapsible group in the controls pane.

const num = (key, group, part, min, max, step, unit, def) => ({ key, group, part, kind: "number", min, max, step, unit, default: def });
const bool = (key, group, part, def) => ({ key, group, part, kind: "bool", default: def });
const color = (key, group, part, def) => ({ key, group, part, kind: "color", default: def });
const font = (key, group, part, def) => ({ key, group, part, kind: "font", default: def });
const choice = (key, group, part, options, def) => ({ key, group, part, kind: "enum", options, default: def });

function background(d) {
  return [
    bool("background.show", "background", "container", true),
    color("background.color", "background", "container", d.color ?? theme(0)),
    num("background.transparency", "background", "container", 0, 100, 1, "%", 0)
  ];
}

function border(d) {
  return [
    bool("border.show", "border", "border", true),
    color("border.color", "border", "border", d.color),
    num("border.width", "border", "border", 1, 10, 1, "px", 1),
    num("border.radius", "border", "border", 0, 40, 1, "px", d.radius)
  ];
}

function shadow(d) {
  return [
    bool("dropShadow.show", "shadow", "shadow", d.show),
    color("dropShadow.color", "shadow", "shadow", d.color ?? hex("#000000")),
    num("dropShadow.transparency", "shadow", "shadow", 0, 100, 1, "%", d.transparency ?? 70),
    choice("dropShadow.preset", "shadow", "shadow", SHADOW_PRESETS, d.preset ?? "BottomRight"),
    choice("dropShadow.position", "shadow", "shadow", ["Outer", "Inner"], "Outer")
  ];
}

function padding(value) {
  return ["top", "right", "bottom", "left"].map(side =>
    num(`padding.${side}`, "padding", "padding", 0, 40, 1, "px", value));
}

function title(d) {
  return [
    bool("title.show", "title", "title", d.show),
    font("title.fontFamily", "title", "title", d.fontFamily ?? "Segoe UI"),
    num("title.fontSize", "title", "title", 8, 60, 1, "pt", d.fontSize),
    bool("title.bold", "title", "title", false),
    bool("title.italic", "title", "title", false),
    color("title.fontColor", "title", "title", theme(1)),
    choice("title.alignment", "title", "title", ["left", "center", "right"], "left")
  ];
}

const visualHeader = () => [bool("visualHeader.show", "behaviour", "chrome", true)];

export const FIELDS = {
  slicer: [
    choice("data.mode", "style", "items", ["Dropdown", "Basic"], "Dropdown"),
    bool("header.show", "header", "header", true),
    font("header.fontFamily", "header", "header", "Arial"),
    num("header.textSize", "header", "header", 8, 60, 1, "pt", 10),
    bool("header.bold", "header", "header", false),
    color("header.fontColor", "header", "header", theme(1)),
    color("header.background", "header", "header", theme(0)),
    font("items.fontFamily", "items", "items", "Arial"),
    num("items.textSize", "items", "items", 8, 60, 1, "pt", 12),
    color("items.fontColor", "items", "items", theme(1)),
    color("items.background", "items", "items", theme(0)),
    ...background({}),
    ...border({ color: theme(0), radius: 8 }),
    ...shadow({ show: false }),
    ...padding(5),
    ...visualHeader()
  ],
  kpi: [
    font("labels.fontFamily", "value", "value", "Arial"),
    num("labels.fontSize", "value", "value", 8, 60, 1, "pt", 14),
    bool("labels.bold", "value", "value", true),
    color("labels.color", "value", "value", theme(1)),
    bool("categoryLabels.show", "category", "category", true),
    font("categoryLabels.fontFamily", "category", "category", "Arial"),
    num("categoryLabels.fontSize", "category", "category", 8, 60, 1, "pt", 11),
    color("categoryLabels.color", "category", "category", theme(1)),
    bool("wordWrap.show", "category", "category", true),
    ...title({ show: false, fontSize: 11 }),
    ...background({}),
    ...border({ color: hex("#FFFFFF"), radius: 10 }),
    ...shadow({ show: false }),
    ...padding(5),
    ...visualHeader(),
    bool("visualTooltip.show", "behaviour", "tooltip", true)
  ],
  chart: [
    ...title({ show: true, fontFamily: "Arial", fontSize: 13 }),
    ...background({}),
    ...border({ color: theme(0), radius: 10 }),
    ...shadow({ show: true, color: theme(0, -0.3), preset: "Center" }),
    ...padding(15),
    ...visualHeader(),
    bool("visualTooltip.show", "behaviour", "tooltip", true)
  ]
};

// The controls pane's groups, in order. `showKey` is the group's on/off
// switch, drawn in its head, not as a row.
export const GROUPS = [
  { id: "style", showKey: null },
  { id: "header", showKey: "header.show" },
  { id: "items", showKey: null },
  { id: "value", showKey: null },
  { id: "category", showKey: "categoryLabels.show" },
  { id: "title", showKey: "title.show" },
  { id: "background", showKey: "background.show" },
  { id: "border", showKey: "border.show" },
  { id: "shadow", showKey: "dropShadow.show" },
  { id: "padding", showKey: null },
  { id: "behaviour", showKey: null }
];

export const groupLabel = id => t(`elements.group.${id}`);
export const fieldLabel = key => t(`elements.field.${key}`);
export const typeLabel = type => t(`elements.type.${type}`);

export function fieldsFor(type) {
  return FIELDS[type] || [];
}

export function fieldFor(type, key) {
  return fieldsFor(type).find(f => f.key === key) || null;
}

/** The groups this type has fields in, in display order. */
export function groupsFor(type) {
  const used = new Set(fieldsFor(type).map(f => f.group));
  return GROUPS.filter(g => used.has(g.id));
}

// --- Values ----------------------------------------------------------------

const clone = v => JSON.parse(JSON.stringify(v));

export function defaultElementStyles() {
  const out = {};
  ELEMENT_TYPES.forEach(type => {
    out[type] = {};
    fieldsFor(type).forEach(f => { out[type][f.key] = clone(f.default); });
  });
  return out;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function normalizeColor(raw, fallback) {
  if (!isObject(raw)) return clone(fallback);
  if (raw.mode === "hex" && typeof raw.hex === "string" && HEX_PATTERN.test(raw.hex)) {
    return { mode: "hex", hex: raw.hex.toUpperCase() };
  }
  if (raw.mode === "theme" && Number.isInteger(raw.id) && raw.id >= 0 && raw.id < THEME_COLORS.length) {
    const p = Number(raw.percent);
    const percent = Number.isFinite(p) ? Math.round(Math.min(0.6, Math.max(-0.6, p)) * 100) / 100 : 0;
    return { mode: "theme", id: raw.id, percent };
  }
  return clone(fallback);
}

/** One field's value, repaired to something the field can hold. */
export function normalizeValue(field, raw) {
  switch (field.kind) {
    case "number": {
      const n = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
      if (!Number.isFinite(n)) return field.default;
      const stepped = Math.round(n / field.step) * field.step;
      return Math.min(field.max, Math.max(field.min, stepped));
    }
    case "bool":
      return typeof raw === "boolean" ? raw : field.default;
    case "enum":
      return field.options.includes(raw) ? raw : field.default;
    case "font":
      return Object.prototype.hasOwnProperty.call(FONTS, raw) ? raw : field.default;
    case "color":
      return normalizeColor(raw, field.default);
    default:
      return field.default;
  }
}

/**
 * Rebuilds a stored style set field by field from the table, allow-list style
 * like sanitizeSnapshot() in state/tabs.js. Unknown types and keys are
 * dropped, bad values fall back to the default, and a missing set (older
 * project file) gives the defaults.
 */
export function normalizeElementStyles(raw) {
  const src = isObject(raw) ? raw : {};
  const out = {};
  ELEMENT_TYPES.forEach(type => {
    const values = isObject(src[type]) ? src[type] : {};
    out[type] = {};
    fieldsFor(type).forEach(f => {
      out[type][f.key] = Object.prototype.hasOwnProperty.call(values, f.key)
        ? normalizeValue(f, values[f.key])
        : clone(f.default);
    });
  });
  return out;
}

export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The keys of `type` whose value differs from the default. */
export function changedKeys(styles, type) {
  return fieldsFor(type).filter(f => !sameValue(styles[type][f.key], f.default)).map(f => f.key);
}

// --- Colors, for the preview and the canvas ---------------------------------

function mix(hexValue, target, amount) {
  const n = parseInt(hexValue.slice(1), 16);
  const channel = shift => {
    const c = (n >> shift) & 255;
    return Math.round(c + (target - c) * amount);
  };
  return "#" + [16, 8, 0].map(s => channel(s).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** A color value as the hex the preview draws (the default Power BI theme). */
export function resolveColor(value) {
  if (!value) return "#000000";
  if (value.mode === "hex") return value.hex;
  const base = THEME_COLORS[value.id] ?? "#000000";
  const p = value.percent || 0;
  return p > 0 ? mix(base, 255, p) : p < 0 ? mix(base, 0, -p) : base;
}

export function rgba(hexValue, alpha) {
  const n = parseInt(hexValue.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 1000) / 1000})`;
}

// Where each preset throws the shadow: [x, y] unit directions.
const SHADOW_DIRECTIONS = {
  TopLeft: [-1, -1], Top: [0, -1], TopRight: [1, -1],
  Left: [-1, 0], Center: [0, 0], Right: [1, 0],
  BottomLeft: [-1, 1], Bottom: [0, 1], BottomRight: [1, 1]
};

/** The CSS box-shadow Power BI's preset roughly draws, at `scale`. */
export function shadowCss(values, scale = 1) {
  if (!values["dropShadow.show"]) return "none";
  const [dx, dy] = SHADOW_DIRECTIONS[values["dropShadow.preset"]] || [0, 0];
  const center = dx === 0 && dy === 0;
  const distance = 5 * scale;
  const blur = 10 * scale;
  const spread = (center ? 3 : 0) * scale;
  const alpha = 1 - values["dropShadow.transparency"] / 100;
  const inset = values["dropShadow.position"] === "Inner" ? "inset " : "";
  const c = rgba(resolveColor(values["dropShadow.color"]), alpha);
  return `${inset}${dx * distance}px ${dy * distance}px ${blur}px ${spread}px ${c}`;
}

export const shadowDirection = preset => SHADOW_DIRECTIONS[preset] || [0, 0];
