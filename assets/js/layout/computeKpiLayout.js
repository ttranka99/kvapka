import * as state from "../state/state.js";
import { addWarning } from "../ui/warnings.js";

export function computeKpiLayout(v) {
  if (state.kpis.length === state.MAX_KPIS) {
    addWarning("Dosažen maximální počet KPI. Další KPI budou umístěny na další řádek.");
  }

  if (state.kpis.length > state.MAX_KPIS * 2) {
    addWarning("Dosaženo maximálního počtu KPI. Odeberte KPI.");
    state.setKpis(state.kpis.slice(0, state.MAX_KPIS * 2));
  }

  const n = state.kpis.length;
  if (n === 0) return [];

  const row1 = state.kpis.slice(0, state.MAX_KPIS);
  const row2 = state.kpis.slice(state.MAX_KPIS, state.MAX_KPIS * 2);

  const totalGaps1 = (row1.length - 1) * state.GAP_SMALL;
  const totalGaps2 = (row2.length - 1) * state.GAP_SMALL;

  let widths1;
  const anyLocked1 = row1.some(k => k.locked);

  if (!anyLocked1) {
    if (row1.length <= 3) {
      widths1 = Array(row1.length).fill(250);
    } else {
      const w = Math.floor((state.USABLE_WIDTH - totalGaps1) / row1.length);
      widths1 = Array(row1.length).fill(w);
    }
  } else {
    const lockedSum = row1
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);

    let remaining = state.USABLE_WIDTH - totalGaps1 - lockedSum;

    if (remaining < 0) {
      addWarning("Součet ručně nastavených šířek KPI přesahuje dostupnou šířku.");
      return [];
    }

    const unlocked = row1.filter(k => !k.locked);
    const u = unlocked.length;

    if (u === 0) {
      widths1 = row1.map(k => k.width);
    } else {
      const base = Math.floor(remaining / u);
      let remainder = remaining % u;

      widths1 = row1.map(k => {
        if (k.locked) return k.width;
        let w = base;
        if (remainder > 0) { w += 1; remainder--; }
        return w;
      });
    }
  }

  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  if (totalWidthRow1 > state.USABLE_WIDTH) {
    addWarning("KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.");
    return [];
  }

  let widths2 = [];

  if (row2.length > 0) {
    const available = state.USABLE_WIDTH - totalGaps2;
    const anyLocked2 = row2.some(k => k.locked);

    if (!anyLocked2) {
      if (row2.length < state.MAX_KPIS) {
        const baseWidth = widths1[0];
        const totalNeeded = row2.length * baseWidth + totalGaps2;

        if (totalNeeded <= state.USABLE_WIDTH) {
          widths2 = Array(row2.length).fill(baseWidth);
        } else {
          const scaleFactor = available / (row2.length * baseWidth);
          const adjustedWidth = Math.floor(baseWidth * scaleFactor);
          widths2 = Array(row2.length).fill(adjustedWidth);
        }
      } else {
        const w = Math.floor((state.USABLE_WIDTH - totalGaps2) / row2.length);
        widths2 = Array(row2.length).fill(w);
      }
    } else {
      const lockedSum2 = row2
        .filter(k => k.locked)
        .reduce((sum, k) => sum + (k.width ?? 0), 0);

      let remaining2 = state.USABLE_WIDTH - totalGaps2 - lockedSum2;
      if (remaining2 < 0) {
        addWarning("Součet ručně nastavených šířek KPI na druhém řádku přesahuje dostupnou šířku.");
        remaining2 = 0;
      }

      const unlocked2 = row2.filter(k => !k.locked);
      const u2 = unlocked2.length;

      if (u2 === 0) {
        widths2 = row2.map(k => k.width);
      } else {
        const base = Math.floor(remaining2 / u2);
        let remainder = remaining2 % u2;

        widths2 = row2.map(k => {
          if (k.locked) return k.width;
          let w = base;
          if (remainder > 0) { w += 1; remainder--; }
          return w;
        });
      }
    }

    const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
    if (totalWidthRow2 > state.USABLE_WIDTH) {
      addWarning("KPI na druhém řádku se nevejdou – uprav šířky nebo odeber KPI.");
      return [];
    }
  }

  const rows = [];

  if (row1.length > 0) {
    let x = state.MARGIN;
    const y = v.kpiTop;

    const items = row1.map((k, i) => {
      const w = widths1[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: i,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  if (row2.length > 0) {
    let x = state.MARGIN;

    const row1Height = row1.length
      ? Math.max(...row1.map(k => k.height ?? state.KPI_MIN_HEIGHT))
      : state.KPI_MIN_HEIGHT;

    const y = v.kpiTop + row1Height + state.GAP_SMALL;

    const items = row2.map((k, i) => {
      const w = widths2[i];
      const h = k.height ?? state.KPI_MIN_HEIGHT;

      const item = {
        x,
        y,
        width: w,
        height: h,
        index: state.MAX_KPIS + i,
        stateRef: k
      };

      x += w + state.GAP_SMALL;
      return item;
    });

    rows.push(items);
  }

  return rows;
}
