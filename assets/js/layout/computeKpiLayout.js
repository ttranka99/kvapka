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

  // 0) If KPI count is 3 or fewer → fixed width 250
  if (!anyLocked1 && row1.length <= 3) {
    widths1 = Array(row1.length).fill(250);
  }

  // 1) If there are locked KPI, use the original logic
  else if (anyLocked1) {
    const lockedSum = row1
      .filter(k => k.locked)
      .reduce((sum, k) => sum + (k.width ?? 0), 0);

    let remaining = state.USABLE_WIDTH - totalGaps1 - lockedSum;

    if (remaining < 0) {
      addWarning("The sum of manually set KPI widths exceeds the available width.");
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

  // 2) If no locked KPI and KPI count >= 4 → symmetric width distribution
  else {
    const n1 = row1.length;
    const usable = state.USABLE_WIDTH - totalGaps1;

    // Base evenly distributed width
    const base = Math.floor(usable / n1);
    let remainder = usable - base * n1;

    widths1 = Array(n1).fill(base);

    // Distribute leftover pixels symmetrically from edges towards center
    let left = 0;
    let right = n1 - 1;

    while (remainder > 0 && left <= right) {
      if (remainder > 0) {
        widths1[left]++;
        remainder--;
      }
      if (remainder > 0 && right !== left) {
        widths1[right]++;
        remainder--;
      }
      left++;
      right--;
    }
  }


  const totalWidthRow1 = widths1.reduce((s, w) => s + w, 0) + totalGaps1;
  if (totalWidthRow1 > state.USABLE_WIDTH) {
    addWarning("KPI se nevejdou do dostupné šířky – uprav šířky nebo odeber KPI.");
    return [];
  }

  let widths2 = [];

  if (row2.length > 0) {
    const n2 = row2.length;
    const anyLocked2 = row2.some(k => k.locked);
    const usable2 = state.USABLE_WIDTH - totalGaps2;


    // 1) If there are locked KPI → use original logic
    if (anyLocked2) {
      const lockedSum2 = row2
        .filter(k => k.locked)
        .reduce((sum, k) => sum + (k.width ?? 0), 0);

      let remaining2 = usable2 - lockedSum2;

      if (remaining2 < 0) {
        addWarning("The sum of manually set KPI widths on the second row exceeds the available width.");
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

    // 2) No locked KPI → symmetric logic for 4/6 KPI + special handling for 1–3 KPI
    else {
      const n2 = row2.length;
      const usable2 = state.USABLE_WIDTH - totalGaps2;
      const halfUsable = usable2 / 2;
      const baseWidth = widths1[0]; // width of the first KPI in the first row

      // --- A) If there are 4 or 6 KPI → use the same symmetric logic as row1 ---
      if (n2 >= 4) {
        const base = Math.floor(usable2 / n2);
        let remainder = usable2 - base * n2;

        widths2 = Array(n2).fill(base);

        let left = 0;
        let right = n2 - 1;
        while (remainder > 0 && left <= right) {
          if (remainder > 0) {
            widths2[left]++;
            remainder--;
          }
          if (remainder > 0 && right !== left) {
            widths2[right]++;
            remainder--;
          }
          left++;
          right--;
        }
      }
      // --- B) If there are 1–3 KPI → follow the width of the first KPI in row1; if custom width and sum of first KPIs exceeds half, stretch only the last one ---
      else {
        widths2 = [];

        const baseWidth = widths1[0]; // width of the first KPI in the first row
        const isCustomWidth = !!row1[0].locked || !!row1[0].width;

        // 1 KPI in second row → always same width as first KPI in row1
        if (n2 === 1) {
          widths2 = [baseWidth];
        }

        // 2–3 KPI in second row
        else {
          const gapsWidth = (n2 - 1) * state.GAP_SMALL;
          const firstPartWidth = baseWidth * (n2 - 1) + gapsWidth; // sum of KPI 7+8 (+ gap) at n2=3

          // If no custom width OR sum of first KPIs does NOT exceed half → all KPIs same width
          if (!isCustomWidth || firstPartWidth <= halfUsable) {
            widths2 = Array(n2).fill(baseWidth);
          } else {
            // Custom width AND sum of first KPIs exceeds half → stretch ONLY the last KPI
            const lastWidth = Math.max(usable2 - firstPartWidth, 0);

            // First (n2 - 1) KPIs keep baseWidth
            for (let i = 0; i < n2 - 1; i++) {
              widths2.push(baseWidth);
            }
            // Last KPI fills the remaining usable width
            widths2.push(lastWidth);
          }
        }
      }

    }
  }

  const totalWidthRow2 = widths2.reduce((s, w) => s + w, 0) + totalGaps2;
  if (totalWidthRow2 > state.USABLE_WIDTH) {
    addWarning("KPI se nevejdou do dostupné šířky – upravte šířku nebo odeberte KPI.");
    return [];
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
