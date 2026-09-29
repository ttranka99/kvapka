// The layout grid step: computed widths/heights are multiples of it, so the
// numbers stay readable and export cleanly to Power BI. Default 5. A theme
// can set its own (see theme/themeModel.js), so it is set via setStep().
export let STEP = 5;

export function setStep(v) {
  const n = Math.round(Number(v));
  STEP = Number.isFinite(n) && n >= 1 ? n : 5;
}

export function snapToStep(v) {
  return Math.round(v / STEP) * STEP;
}

// Picks `k` of `n` slots to get one extra STEP, spread evenly and mirrored
// around the centre. For 7 elements with 3 extras, the wider ones land at
// 0, 3, 6 (260, 255, 255, 260, 255, 255, 260).
//
// Indices are picked in mirrored pairs from both ends inward. If `n` is even
// and `k` is odd, one index has no partner and sits nearest the centre.
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

  // Rounding can make picks collide. Top up from the middle outwards so the
  // count, and so the total, stays exact.
  for (let i = 0; picked.size < k && i < n; i++) {
    const from = Math.floor((n - 1) / 2);
    picked.add(from + (i % 2 === 0 ? i / 2 : -(i + 1) / 2));
  }

  return [...picked].filter(i => i >= 0 && i < n).slice(0, k);
}

// Splits `total` into `count` multiples of STEP that sum to exactly `total`.
// With `symmetric`, the extra STEP chunks are mirrored across the row.
// Otherwise they go left to right (used when part of the row is locked). The
// last element takes the leftover px that don't divide by STEP.
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
