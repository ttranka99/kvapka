// assets/js/ui/motion.js
//
// The motion system. Tokens and primitives (m-in/m-out, .m-enter/.m-leave,
// .m-reveal, .icon-swap) live in assets/style.css (:root, MOTION). This is
// the JS half: it reads the tokens, plays the exit on nodes about to be
// destroyed, and replays a canvas rebuild as movement.
//
// The rules, in order of precedence:
//
//   R1 Move    — a thing that survives a change glides to its new place.
//   R1a Lineage — a thing born from another (a split chart's halves) glides
//                out of it; a thing absorbed into another glides into it.
//   R2 Enter / leave — a new thing fades in (m-in / .m-reveal); a removed
//                thing fades out first (leave()); a thing revealed from
//                display:none fades in (.m-reveal). Exits are quicker.
//   R3 Swap    — replacing all content (another page or theme) doesn't
//                morph: the new content fades in.
//   R4 Patch, don't rebuild — when only state changed, toggle classes on the
//                existing nodes so their own transitions fire.
//   R5 Never   — drags, hover chrome and the most frequent clicks stay
//                instant. The canvas never eases on a window resize; the
//                chrome does, and the sheet re-fits every frame.
//   R6 One vocabulary — every duration comes from the tokens, JS included.
//   R7 Flash   — a state that was set on a thing that stays put (a lock, a
//                rename, an applied value) gets a soft halo. Releasing a
//                state (unlocking) is quiet. An action refused because of
//                locks flashes the locked things that blocked it.
//
// Nothing here is per element: a new surface picks a rule, not an animation.

const root = document.documentElement;

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* A token as ms, for the timeouts that back up animationend / transitionend
   (they don't fire if the node leaves the DOM first, or under some display
   changes). The extra slack keeps the fallback from beating a real end event. */
export function durationMs(token = "--base") {
  const raw = getComputedStyle(root).getPropertyValue(token).trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  return (Number.isFinite(ms) ? ms : 180) + 30;
}

/* Plays the exit on `el`, then calls `done` exactly once (the caller removes
   the node or re-renders there). Under reduced motion the tokens are zeroed
   in CSS, so the exit still runs and the timing is the same. */
export function leave(el, done) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  el.classList.add("m-leave");
  el.addEventListener("animationend", e => { if (e.target === el) finish(); });
  setTimeout(finish, durationMs("--fast"));
}

/* R7. The class goes on the node that exists after a render, so flash by id
   once renderLayout() has returned. */
export function flash(id) {
  flashEl(document.getElementById(id));
}

/* R7 on a node the caller already holds (a control row, a field). */
export function flashEl(el) {
  if (!el) return;
  el.classList.remove("m-flash");
  void el.offsetWidth;   // restart if it was already flashing
  el.classList.add("m-flash");
  const done = () => el.classList.remove("m-flash");
  el.addEventListener("animationend", e => { if (e.target === el) done(); });
  setTimeout(done, durationMs("--slower") * 4);   // the halo runs 4× --slower (style.css)
}

/* R7, for a refusal: point at every locked card that blocked it. */
export function flashAll(ids) {
  ids.forEach(id => id && flash(id));
}

/* ----------------------------------------------------
   Canvas — R1/R2/R3 over a from-scratch rebuild.

   renderLayout() clears #canvas and recreates every card, so nothing can
   transition on its own. The caller snapshots the cards by id before the
   rebuild and plays the difference after: survivors glide from the old box
   to the new one (inline geometry is eased, not a transform, see
   .canvas-element.is-moving), newcomers fade in, and a card whose id is gone
   stays as a ghost that fades out. Ids are index-based, so on a removal the
   last card is the ghost while the others slide into place.
-----------------------------------------------------*/
const CARD = ".canvas-element[id]";

export function snapshotCanvas(canvas) {
  return snapshotBoxes(canvas, CARD);
}

/* The same snapshot for absolutely placed boxes inside `container`, keyed by
   `keyOf`: the canvas uses card ids, the Custom Layout preview data-key. */
export function snapshotBoxes(container, selector, keyOf = el => el.id) {
  const rect = container.getBoundingClientRect();
  const items = new Map();
  container.querySelectorAll(selector).forEach(el => {
    const r = el.getBoundingClientRect();
    items.set(keyOf(el), {
      left: r.left - rect.left,
      top: r.top - rect.top,
      width: r.width,
      height: r.height,
      el
    });
  });
  return { rect, items };
}

export function playCanvas(canvas, snap, opts) {
  const motion = opts && opts.motion;
  if (motion === false || !snap || reducedMotion()) return;
  // R5: a drag rebuilds every tick, so nothing may ease behind the pointer.
  if (document.body.classList.contains("is-resizing-chart")) return;
  const rect = canvas.getBoundingClientRect();
  // The sheet was hidden (rail section) or resized (window, another theme's
  // canvas): everything moved, so don't animate card by card.
  if (snap.rect.width === 0 || rect.width === 0) return;
  if (Math.abs(rect.width - snap.rect.width) > 0.5 || Math.abs(rect.height - snap.rect.height) > 0.5) return;

  const cards = Array.from(canvas.querySelectorAll(CARD));

  if (motion === "swap") {
    cards.forEach(el => fadeIn(el));
    return;
  }

  const seen = new Set();
  cards.forEach(el => {
    seen.add(el.id);
    // R1a: a card born from another (a split, or a stack collapsing into one
    // chart) glides out of its origin's box.
    const was = snap.items.get(el.id) || originOf(el.id, snap.items);
    if (!was) { fadeIn(el); return; }
    const r = el.getBoundingClientRect();
    const now = { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height };
    if (same(was, now)) return;
    glide(el, was);
  });

  snap.items.forEach((was, id) => {
    if (seen.has(id)) return;
    // Split: its halves glide out of it, so no ghost.
    if ([...seen].some(s => s.startsWith(id + "-"))) return;
    // Collapsed into its parent: the parent grows out of the first half, so
    // only the other halves fade as ghosts.
    if (seen.has(parentId(id)) && /-0$/.test(id)) return;
    ghost(canvas, was, cleanCard);
  });
}

/* R1/R2/R3 for a container of plain boxes with no lineage (the Custom Layout
   preview's regions). `motion` "move" glides survivors, fades newcomers in
   and ghosts removed boxes; "swap" fades everything in. A container that
   changed size (another canvas size or scale) swaps too, since every box
   moved. `clean` strips the caller's chrome from a ghost. Drags pass no
   motion (R5). */
export function playBoxes(container, snap, { selector, keyOf = el => el.id, motion, clean } = {}) {
  if (!motion || !snap || reducedMotion()) return;
  const rect = container.getBoundingClientRect();
  if (snap.rect.width === 0 || rect.width === 0) return;

  const boxes = Array.from(container.querySelectorAll(selector));
  const resized = Math.abs(rect.width - snap.rect.width) > 0.5 || Math.abs(rect.height - snap.rect.height) > 0.5;
  if (motion === "swap" || resized) {
    boxes.forEach(el => fadeIn(el));
    return;
  }

  const seen = new Set();
  boxes.forEach(el => {
    const key = keyOf(el);
    seen.add(key);
    const was = snap.items.get(key);
    if (!was) { fadeIn(el); return; }
    const r = el.getBoundingClientRect();
    const now = { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height };
    if (!same(was, now)) glide(el, was);
  });

  snap.items.forEach((was, key) => {
    if (!seen.has(key)) ghost(container, was, clean);
  });
}

/* Ids carry lineage: chart-0-0-1 is the second sub-chart of chart-0-0. */
function parentId(id) {
  return id.replace(/-\d+$/, "");
}

// Where a new card came from: its parent's box (a split) or its first
// child's box (a stack collapsing into one chart). Only real cards count:
// slicer-1's "parent" would be "slicer", which is no card.
function originOf(id, items) {
  return (parentId(id) !== id && items.get(parentId(id))) || items.get(id + "-0") || null;
}

/* Strips every in-flight card animation so a measurement taken right after
   (a drag's snap targets, for one) sees settled geometry. */
export function settleCanvas(canvas) {
  settleBoxes(canvas, ".canvas-element");
}

export function settleBoxes(container, selector) {
  container.querySelectorAll(`${selector}.is-ghost`).forEach(el => el.remove());
  container.querySelectorAll(`${selector}.is-moving, ${selector}.m-enter--fade`).forEach(el => {
    el.classList.remove("is-moving", "m-enter--fade");
    if (el._motionFinal) {
      setBox(el, el._motionFinal);
      el._motionFinal = null;
    }
  });
}

function same(a, b) {
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function setBox(el, box) {
  el.style.left = box.left + "px";
  el.style.top = box.top + "px";
  el.style.width = box.width + "px";
  el.style.height = box.height + "px";
}

// Invert: put the card back at its old box, let the browser see it there,
// then ease it to the geometry renderLayout() gave it. The start box is set
// with transitions off, or a box that always eases some geometry (the
// preview's regions ease top/height for the reorder drag) would slide toward
// the start box and never leave from it.
function glide(el, was) {
  const final = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
  el._motionFinal = final;
  el.style.transition = "none";
  setBox(el, was);
  void el.offsetWidth;
  el.style.transition = "";
  el.classList.add("is-moving");
  Object.assign(el.style, final);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.remove("is-moving");
    el._motionFinal = null;
  };
  // Only the card's own geometry counts; box-shadow (hover ring) and bubbled
  // opacity (controls) transitions also end mid-glide.
  el.addEventListener("transitionend", e => {
    if (e.target === el && /^(left|top|width|height)$/.test(e.propertyName)) finish();
  });
  setTimeout(finish, durationMs("--base"));
}

function fadeIn(el) {
  el.classList.add("m-enter--fade");
  void el.offsetWidth;
  el.classList.remove("m-enter--fade");
}

// The rebuild detached the old node, so it is reused as its own ghost (glyph,
// label and size intact). `clean` strips what a removed thing shouldn't have:
// states, controls, and anything the next snapshot would find it by.
function ghost(container, was, clean) {
  const el = was.el;
  el.classList.remove("is-moving");
  if (clean) clean(el);
  el.classList.add("is-ghost");
  el.removeAttribute("id");   // nothing must find it, including the next snapshot
  setBox(el, was);
  container.appendChild(el);
  leave(el, () => el.remove());
}

function cleanCard(el) {
  el.classList.remove("selected", "split-target-highlight", "width-locked", "height-locked");
  el.querySelectorAll(".element-controls").forEach(c => c.remove());
}
