// assets/js/elements/elementPreview.js
//
// The live mock of one element type in the Customize Elements section, plus
// the guides that explain an edit while it happens.
//
// A mock is built once (per type, per mode) and from then on only restyled:
// applyStyles() writes CSS custom properties onto its frame, so dragging the
// radius slider re-rounds the corners on every frame without touching the
// DOM tree. Sizes are Power BI's own: px for boxes, pt for text (CSS pt is
// the same unit), so the mock at 100 % is the visual at 100 %.
//
// DOM, per mock:
//
//   .el-frame                    the visual's box; carries every variable
//     .el-mock                   border, background, radius, shadow, padding
//       …the type's parts        each [data-part] is highlightable
//     .el-guide--…               radius arcs, padding bands, shadow outline
//     .el-tag                    the value being set, next to what it sets
//
// The guides live outside .el-mock so the rounded, clipped box never cuts
// them off.

import { FONTS, resolveColor, rgba, shadowCss, shadowDirection } from "./elementStyleModel.js";
import { t } from "../i18n/i18n.js";

// Each mock's size in Power BI px.
const SIZES = {
  slicer: { Dropdown: [240, 92], Basic: [240, 188] },
  kpi: [240, 130],
  chart: [440, 260]
};

export function frameSize(type, values) {
  const size = SIZES[type];
  return Array.isArray(size) ? size : size[values["data.mode"]] || size.Dropdown;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const part = (tag, className, name, text) => {
  const node = el(tag, `el-part ${className}`, text);
  node.dataset.part = name;
  return node;
};

// A part that can be switched off (a title, a header, a label) sits in a
// fold, so switching it eases it shut and the rest of the mock slides up
// instead of jumping. The fold's data-fold names the switch (see CSS).
const fold = (name, node) => {
  const outer = el("div", "el-fold");
  outer.dataset.fold = name;
  const inner = el("div", "el-fold__inner");
  inner.appendChild(node);
  outer.appendChild(inner);
  return outer;
};

const svg = markup => {
  const wrap = document.createElement("span");
  wrap.innerHTML = markup;
  return wrap.firstElementChild;
};

const CHEVRON = '<svg class="el-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Power BI's visual header: the icons that appear over a visual on hover.
function chrome() {
  const node = part("div", "el-chrome", "chrome");
  node.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v7M5 7l3 3 3-3M4 13h8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.1" fill="currentColor"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/><circle cx="12" cy="8" r="1.1" fill="currentColor"/></svg>';
  return node;
}

function buildSlicer(mock) {
  mock.appendChild(fold("header", part("div", "el-slicer__header", "header", t("elements.sample.slicerHeader"))));

  const items = part("div", "el-slicer__items", "items");

  const dropdown = el("div", "el-dropdown");
  dropdown.appendChild(el("span", null, t("elements.sample.all")));
  dropdown.appendChild(svg(CHEVRON));
  items.appendChild(dropdown);

  const list = el("div", "el-list");
  ["europe", "americas", "asia", "africa"].forEach((key, i) => {
    const row = el("div", "el-list__item" + (i === 0 ? " is-checked" : ""));
    row.appendChild(el("span", "el-list__box"));
    row.appendChild(el("span", null, t(`elements.sample.${key}`)));
    list.appendChild(row);
  });
  items.appendChild(list);

  mock.appendChild(items);
}

function buildKpi(mock) {
  mock.appendChild(fold("title", part("div", "el-title", "title", t("elements.sample.kpiTitle"))));
  const body = el("div", "el-kpi__body");
  body.appendChild(part("div", "el-kpi__value", "value", "1.24M"));
  body.appendChild(fold("category", part("div", "el-kpi__category", "category", t("elements.sample.kpiCategory"))));
  mock.appendChild(body);
}

// A small line chart in the first theme data color, with the tooltip Power BI
// shows over a point.
function buildChart(mock) {
  mock.appendChild(fold("title", part("div", "el-title", "title", t("elements.sample.chartTitle"))));
  const plot = part("div", "el-chart__plot", "plot");
  const points = [[0, 62], [1, 48], [2, 55], [3, 36], [4, 42], [5, 24], [6, 30], [7, 14]];
  const x = i => 30 + i * 52;
  const y = v => v * 1.6 + 8;
  const line = points.map(([i, v], n) => `${n ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const grid = [0, 1, 2, 3].map(n => `<line x1="30" x2="394" y1="${8 + n * 40}" y2="${8 + n * 40}" />`).join("");
  const labels = ["J", "F", "M", "A", "M", "J", "J", "A"]
    .map((m, i) => `<text x="${x(i)}" y="178" text-anchor="middle">${m}</text>`).join("");
  plot.innerHTML =
    `<svg viewBox="0 0 400 184" preserveAspectRatio="none" aria-hidden="true">
      <g class="el-chart__grid">${grid}</g>
      <path class="el-chart__area" d="${line} L${x(7)},128 L${x(0)},128 Z" />
      <path class="el-chart__line" d="${line}" />
      <circle class="el-chart__dot" cx="${x(5)}" cy="${y(24)}" r="4" />
      <g class="el-chart__axis">${labels}</g>
    </svg>`;
  mock.appendChild(plot);

  const tip = part("div", "el-tooltip", "tooltip");
  tip.appendChild(el("span", "el-tooltip__label", t("elements.sample.tooltipLabel")));
  tip.appendChild(el("strong", null, "84.2K"));
  mock.appendChild(tip);
}

const BUILDERS = { slicer: buildSlicer, kpi: buildKpi, chart: buildChart };

/** A fresh mock frame for `type`. Style it with applyStyles(). */
export function buildFrame(type) {
  const frame = el("div", `el-frame el-frame--${type}`);
  frame.dataset.type = type;

  const mock = el("div", "el-mock");
  mock.dataset.part = "container";
  BUILDERS[type](mock);
  mock.appendChild(chrome());
  frame.appendChild(mock);

  // Guides, drawn over the mock when a value they explain is being set.
  const radius = el("div", "el-guide el-guide--radius");
  ["tl", "tr", "bl", "br"].forEach(c => radius.appendChild(el("span", `el-guide__corner el-guide__corner--${c}`)));
  frame.appendChild(radius);

  const padding = el("div", "el-guide el-guide--padding");
  ["top", "right", "bottom", "left"].forEach(side => padding.appendChild(el("span", `el-guide__band el-guide__band--${side}`)));
  frame.appendChild(padding);

  frame.appendChild(el("div", "el-guide el-guide--shadow"));
  frame.appendChild(el("div", "el-guide el-guide--border"));

  const ruler = el("div", "el-guide el-guide--ruler");
  ruler.appendChild(el("span", "el-guide__rule el-guide__rule--top"));
  ruler.appendChild(el("span", "el-guide__rule el-guide__rule--bottom"));
  frame.appendChild(ruler);

  frame.appendChild(el("div", "el-tag"));
  return frame;
}

const colorOf = value => resolveColor(value);

function fill(show, color, transparency = 0) {
  return show ? rgba(colorOf(color), 1 - transparency / 100) : "transparent";
}

function textVars(style, prefix, values, key, { sizeKey = "fontSize", colorKey = "color" } = {}) {
  style.setProperty(`--${prefix}-font`, FONTS[values[`${key}.fontFamily`]] || "inherit");
  style.setProperty(`--${prefix}-size`, `${values[`${key}.${sizeKey}`]}pt`);
  style.setProperty(`--${prefix}-color`, colorOf(values[`${key}.${colorKey}`]));
  const bold = values[`${key}.bold`];
  if (bold !== undefined) style.setProperty(`--${prefix}-weight`, bold ? "700" : "400");
}

/**
 * Writes one type's values onto a mock frame. Cheap: custom properties and a
 * few data attributes, no DOM rebuild — safe on every slider frame.
 */
export function applyStyles(frame, type, values) {
  const s = frame.style;
  const [w, h] = frameSize(type, values);
  s.setProperty("--w", `${w}px`);
  s.setProperty("--h", `${h}px`);

  s.setProperty("--bg", fill(values["background.show"], values["background.color"], values["background.transparency"]));
  const bw = values["border.show"] ? values["border.width"] : 0;
  s.setProperty("--bw", `${bw}px`);
  s.setProperty("--bc", colorOf(values["border.color"]));
  s.setProperty("--r", `${values["border.radius"]}px`);
  s.setProperty("--shadow", shadowCss(values));
  const [dx, dy] = shadowDirection(values["dropShadow.preset"]);
  s.setProperty("--sdx", `${dx * 5}px`);
  s.setProperty("--sdy", `${dy * 5}px`);
  ["top", "right", "bottom", "left"].forEach(side => {
    s.setProperty(`--p${side[0]}`, `${values[`padding.${side}`]}px`);
  });

  frame.dataset.shadow = values["dropShadow.show"] ? (values["dropShadow.position"] === "Inner" ? "inner" : "outer") : "off";
  frame.dataset.chrome = values["visualHeader.show"] ? "on" : "off";
  frame.dataset.tooltip = values["visualTooltip.show"] === false ? "off" : "on";

  if ("title.show" in values) {
    frame.dataset.title = values["title.show"] ? "on" : "off";
    textVars(s, "title", values, "title", { colorKey: "fontColor" });
    s.setProperty("--title-style", values["title.italic"] ? "italic" : "normal");
    s.setProperty("--title-align", values["title.alignment"]);
  }

  if (type === "slicer") {
    frame.dataset.mode = values["data.mode"] === "Basic" ? "basic" : "dropdown";
    frame.dataset.header = values["header.show"] ? "on" : "off";
    textVars(s, "header", values, "header", { sizeKey: "textSize", colorKey: "fontColor" });
    s.setProperty("--header-bg", colorOf(values["header.background"]));
    textVars(s, "items", values, "items", { sizeKey: "textSize", colorKey: "fontColor" });
    s.setProperty("--items-bg", colorOf(values["items.background"]));
  }

  if (type === "kpi") {
    textVars(s, "value", values, "labels");
    frame.dataset.category = values["categoryLabels.show"] ? "on" : "off";
    frame.dataset.wrap = values["wordWrap.show"] ? "on" : "off";
    textVars(s, "category", values, "categoryLabels");
  }
}

// --- Guides -----------------------------------------------------------------
//
// Which guide explains which field, and where its tag goes. Anything not
// listed here gets a pulse on the part it changes instead.

function guideFor(key) {
  if (key === "border.radius") return "radius";
  if (key.startsWith("padding.")) return "padding";
  if (key.startsWith("dropShadow.")) return "shadow";
  if (key.startsWith("border.")) return "border";
  if (/\.(fontSize|textSize)$/.test(key)) return "ruler";
  return null;
}

const GUIDE_CLASSES = ["show-radius", "show-padding", "show-shadow", "show-border", "show-ruler"];
const GUIDE_LINGER_MS = 900;
const timers = new WeakMap();

function placeTag(frame, text, x, y) {
  const tag = frame.querySelector(".el-tag");
  tag.textContent = text;
  tag.style.left = `${x}px`;
  tag.style.top = `${y}px`;
}

// A part's box in the frame's own (unzoomed) px.
function boxIn(frame, node) {
  const f = frame.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  const zoom = f.width / frame.offsetWidth || 1;
  return {
    left: (r.left - f.left) / zoom,
    top: (r.top - f.top) / zoom,
    width: r.width / zoom,
    height: r.height / zoom
  };
}

/**
 * Explains the change just made to `key`: draws its guide with the value on
 * a tag, or pulses the part it changed. Lingers a moment after the last call.
 */
export function showGuide(frame, field, values, part) {
  const guide = guideFor(field.key);
  const [w, h] = frameSize(frame.dataset.type, values);
  const value = values[field.key];

  frame.classList.remove(...GUIDE_CLASSES.filter(c => c !== `show-${guide}`));

  if (guide) {
    frame.classList.add(`show-${guide}`, "show-tag");
    if (guide === "radius") {
      placeTag(frame, t("elements.tag.radius", { value }), w - 4, h + 10);
    } else if (guide === "padding") {
      placeTag(frame, t("elements.tag.padding", { value }), w / 2, -26);
    } else if (guide === "shadow") {
      placeTag(frame, field.kind === "number" ? `${value} %` : t("elements.tag.shadow"), w / 2, h + 12);
    } else if (guide === "border") {
      placeTag(frame, field.key === "border.width" ? t("elements.tag.width", { value }) : t("elements.tag.border"), w / 2, -26);
    } else if (guide === "ruler") {
      const target = frame.querySelector(`[data-part="${part}"]`);
      if (target && target.offsetParent !== null) {
        const box = boxIn(frame, target);
        const ruler = frame.querySelector(".el-guide--ruler");
        ruler.style.top = `${box.top}px`;
        ruler.style.height = `${box.height}px`;
        placeTag(frame, t("elements.tag.size", { value }), w + 8, box.top + box.height / 2 - 10);
        frame.classList.add("tag-side");
      }
    }
    if (guide !== "ruler") frame.classList.remove("tag-side");
  } else {
    frame.classList.remove("show-tag");
    pulse(frame, part);
  }

  clearTimeout(timers.get(frame));
  timers.set(frame, setTimeout(() => hideGuides(frame), GUIDE_LINGER_MS));
}

export function hideGuides(frame) {
  frame.classList.remove(...GUIDE_CLASSES, "show-tag");
}

/** A soft ring on the part that just changed (motion.js R7). */
export function pulse(frame, part) {
  const target = part === "container" || part === "border" || part === "shadow" || part === "padding"
    ? frame.querySelector(".el-mock")
    : frame.querySelector(`[data-part="${part}"]`);
  if (!target) return;
  target.classList.remove("el-pulse");
  void target.offsetWidth;          // restart the animation
  target.classList.add("el-pulse");
}
