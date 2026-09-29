// assets/js/i18n/i18n.js
//
// All UI text lives in locale files (locales/<code>.js), keyed by name. Code
// asks with t("key"). Switching language swaps the dictionary, so translating
// or rewording never touches code.
//
// The language switches in place (setLocale). The static markup is refilled
// here. Modules holding text they already produced (warnings keyed by their
// wording, the selected element's type, generated page names) listen with
// onLocaleChange and use the convert() they get, which maps a finished string
// in the old language to the same string in the new one.

import cs from "./locales/cs.js";
import en from "./locales/en.js";

const LOCALES = { cs, en };
const FALLBACK = "cs";
const STORAGE_KEY = "kvapka-locale";

function storedLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// ?lang=en gives each language its own URL (for search engines and shared
// links). It wins for this visit but isn't saved, so a shared link doesn't
// overwrite the visitor's own choice.
function urlLocale() {
  try {
    const code = new URLSearchParams(location.search).get("lang");
    return LOCALES[code] ? code : null;
  } catch {
    return null;
  }
}

let locale = urlLocale() ?? (LOCALES[storedLocale()] ? storedLocale() : FALLBACK);
let dict = LOCALES[locale];
let plural = new Intl.PluralRules(locale);

const listeners = [];

export const getLocale = () => locale;
export const availableLocales = () => Object.keys(LOCALES);

/** Registers fn(convert) to run after every language switch. */
export function onLocaleChange(fn) {
  listeners.push(fn);
}

function lookup(key, from = dict) {
  return from[key] ?? LOCALES[FALLBACK][key];
}

export const has = key => lookup(key) !== undefined;

/**
 * The text for `key`, with each {name} replaced by params.name. An entry may
 * be a plural set ({ one, few, many, other }), chosen by params.count. A
 * missing key returns the key itself, so the gap is visible.
 */
export function t(key, params) {
  let entry = lookup(key);
  if (entry === undefined) {
    console.warn(`[i18n] missing key "${key}" (${locale})`);
    return key;
  }
  if (typeof entry === "object") {
    entry = entry[plural.select(Number(params?.count ?? 0))] ?? entry.other;
  }
  if (!params) return entry;
  return entry.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// --- Matching finished text back to its key ----------------------------
//
// A template read as a pattern for the text it produces. Literal parts must
// match exactly; each {placeholder} captures what stands in its place. One
// matcher per plural form, cached per dictionary (a key differs per language).

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matcherCache = new WeakMap();

function matchersFor(key, from) {
  let byKey = matcherCache.get(from);
  if (!byKey) matcherCache.set(from, (byKey = new Map()));
  if (!byKey.has(key)) {
    const entry = lookup(key, from);
    const forms = typeof entry === "object" ? Object.values(entry) : [entry];
    byKey.set(key, forms.map(form => {
      const names = [...form.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      const source = form.split(/\{\w+\}/).map(escape).join("(.*?)");
      // The literal text a match covers. The longest wins when several fit, so
      // "{value} px" never claims a whole sentence.
      const literal = form.replace(/\{\w+\}/g, "").length;
      return { re: new RegExp(`^${source}$`, "s"), names, literal };
    }));
  }
  return byKey.get(key);
}

/** The key and params that produced `text` in dictionary `from`, if any. */
function parse(text, from) {
  let best = null;
  for (const key of Object.keys(from)) {
    for (const { re, names, literal } of matchersFor(key, from)) {
      const m = re.exec(text);
      if (!m || (best && best.literal >= literal)) continue;
      const params = {};
      names.forEach((name, i) => { params[name] = m[i + 1]; });
      best = { key, params, literal };
    }
  }
  return best;
}

/**
 * Whether `text` was produced by any key under `prefix` (e.g. "warnings.kpi.").
 * Lets code clear a family of warnings without matching wording that a
 * locale rewrite could change.
 */
export function isFrom(text, prefix) {
  return Object.keys(dict).some(key =>
    key.startsWith(prefix) && matchersFor(key, dict).some(({ re }) => re.test(text)));
}

// --- Static markup -------------------------------------------------------

// Attributes a static element can take its text from: data-i18n fills the
// element's text; data-i18n-<attr> fills that attribute.
const ATTRS = ["title", "aria-label", "placeholder", "content"];

// A data-i18n element with data-i18n-stable holds its text in every language,
// one <span lang> each, stacked in one grid cell (style.css). The longest
// translation sizes the cell, so switching only changes which span shows and
// nothing shifts. Hidden spans are aria-hidden, so screen readers read only
// the active language.
function fillStable(node) {
  const key = node.dataset.i18n;
  if (node.dataset.i18nStableKey !== key) {
    node.textContent = "";
    Object.entries(LOCALES).forEach(([code, from]) => {
      const span = document.createElement("span");
      span.lang = code;
      span.textContent = lookup(key, from) ?? key;
      node.appendChild(span);
    });
    node.dataset.i18nStableKey = key;
  }
  [...node.children].forEach(span => {
    if (span.lang === locale) span.removeAttribute("aria-hidden");
    else span.setAttribute("aria-hidden", "true");
  });
}

const OG_LOCALES = { cs: "cs_CZ", en: "en_US" };

// The URL of `href` in the active language: the default language has no
// ?lang, every other one has ?lang=<code>. Other params and the hash stay.
function localeUrl(href) {
  const url = new URL(href);
  if (locale === FALLBACK) url.searchParams.delete("lang");
  else url.searchParams.set("lang", locale);
  return url.href;
}

// Keeps the address bar, canonical link and Open Graph URL/locale on the
// active language, so a copied link or a crawler lands on the same one. The
// canonical is the active language's hreflang URL (index.html), so the site
// address is written in one place.
function syncLocaleUrl() {
  try {
    const next = localeUrl(location.href);
    if (next !== location.href) history.replaceState(history.state, "", next);
  } catch {
    // A sandboxed frame may refuse replaceState. The language still switches.
  }
  const own = document.querySelector(`link[rel="alternate"][hreflang="${locale}"]`);
  if (own) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      own.before(canonical);
    }
    canonical.href = own.href;
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = own.href;
  }
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = OG_LOCALES[locale];
  const ogAlternate = document.querySelector('meta[property="og:locale:alternate"]');
  if (ogAlternate) {
    ogAlternate.content = Object.keys(LOCALES).filter(code => code !== locale)
      .map(code => OG_LOCALES[code]).join();
  }
}

/** Fills every element under `root` marked with data-i18n / data-i18n-<attr>. */
export function applyStaticText(root = document) {
  if (root === document) {
    document.documentElement.lang = locale;
    syncLocaleUrl();
  }

  root.querySelectorAll("[data-i18n]").forEach(node => {
    if (node.hasAttribute("data-i18n-stable")) fillStable(node);
    else node.textContent = t(node.dataset.i18n);
  });
  ATTRS.forEach(attr => {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(node => {
      node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
    });
  });
}

// --- Switching -------------------------------------------------------------

export function setLocale(code) {
  if (!LOCALES[code] || code === locale) return;

  const from = dict;
  // Text no key produced (a typed page name, a theme label) comes back
  // unchanged. A param may itself be finished text (a warning quoted inside
  // another), so params are converted the same way.
  const convert = text => {
    if (typeof text !== "string") return text;
    const hit = parse(text, from);
    if (!hit) return text;
    const params = Object.fromEntries(
      Object.entries(hit.params).map(([name, value]) => [name, convert(value)])
    );
    return t(hit.key, params);
  };

  locale = code;
  dict = LOCALES[code];
  plural = new Intl.PluralRules(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Not remembered for next time, but this session still switches.
  }

  applyStaticText();
  listeners.forEach(fn => fn(convert));
}
