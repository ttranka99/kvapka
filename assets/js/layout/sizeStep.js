// The layout grid step: every computed width/height should land on a multiple
// of this so the numbers stay readable and export cleanly to Power BI. 5 is
// the default; a theme may choose its own (see theme/themeModel.js), which is
// why this is a mutable binding set through setStep() rather than a const.
export let STEP = 5;

export function setStep(v) {
  const n = Math.round(Number(v));
  STEP = Number.isFinite(n) && n >= 1 ? n : 5;
}

export function snapToStep(v) {
  return Math.round(v / STEP) * STEP;
}

// Picks `k` of `n` slots to receive one extra STEP each, spaced as evenly as
// possible across the row and mirrored around its centre — so for 7 elements
// with 3 extras the wider ones land at 0, 3, 6 (260, 255, 255, 260, 255, 255,
// 260) instead of bunching at the edges.
//
// Indices are chosen in mirrored pairs working inward from both ends, which
// keeps the result a palindrome. A perfect mirror is impossible when `n` is
// even and `k` is odd (the odd one out has no partner); it then sits as close
// to the centre as it can.
function evenlySpacedIndices(n, k) {
  if (k <= 0) return [];
  if (k >= n) return Array.from({ length: n }, (_, i) => i);

  const picked = new Set();
  const pairs = Math.floor(k / 2);

  for (let j = 0; j < pairs; j++) {
    const i = Math.round((j * (n - 1)) / (k - 1));
    picked.add(i);
    picked.add(n - 1 - i);
  }

  if (k % 2 === 1) {
    picked.add(Math.round((n - 1) / 2));
  }

  // Rounding can make two pairs collide (or the centre land on one of them);
  // top up from the middle outwards so the count — and therefore the total —
  // still comes out exact.
  for (let i = 0; picked.size < k && i < n; i++) {
    const from = Math.floor((n - 1) / 2);
    picked.add(from + (i % 2 === 0 ? i / 2 : -(i + 1) / 2));
  }

  return [...picked].filter(i => i >= 0 && i < n).slice(0, k);
}

// Splits `total` into `count` sizes that are multiples of STEP and sum to
// exactly `total`. With `symmetric` the extra STEP-sized chunks are spread
// evenly and mirrored across the row; otherwise they go left to right (used
// when part of the row is locked, so there's no symmetry to preserve anyway).
// The last element absorbs the 1-4px that don't divide by STEP, so the row
// always fills the canvas exactly.
export function distributeInSteps(total, count, symmetric = true) {
  if (count <= 0) return [];

  const units = Math.floor(Math.max(0, total) / STEP);
  const base = Math.floor(units / count);
  const extra = units % count;

  const sizes = Array(count).fill(base * STEP);
  const indices = symmetric
    ? evenlySpacedIndices(count, extra)
    : Array.from({ length: extra }, (_, i) => i);
  indices.forEach(i => { sizes[i] += STEP; });

  sizes[count - 1] += Math.max(0, total) - units * STEP;
  return sizes;
}
