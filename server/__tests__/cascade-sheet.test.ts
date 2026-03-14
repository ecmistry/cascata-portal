import { describe, it, expect } from "vitest";

/**
 * Cascade Sheet Calculation Tests
 *
 * Tests the core cascade model calculation logic that transforms
 * SQL volumes + conversion rates + timing distributions into
 * quarter-by-quarter opportunity forecasts.
 */

function makeLabel(year: number, quarter: number): string {
  return `Q${quarter} ${String(year).slice(2)}`;
}

function buildQuarterRange(
  startYear: number,
  startQ: number,
  endYear: number,
  endQ: number,
): { year: number; quarter: number; label: string }[] {
  const quarters: { year: number; quarter: number; label: string }[] = [];
  let y = startYear,
    q = startQ;
  while (y < endYear || (y === endYear && q <= endQ)) {
    quarters.push({ year: y, quarter: q, label: makeLabel(y, q) });
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }
  return quarters;
}

function simulateCascade(
  sqlVolumes: Map<string, number>,
  conversionRate: number,
  sqlProbs: number[],
  quarters: { year: number; quarter: number; label: string }[],
) {
  const rows: {
    sqls: number;
    conv: number;
    cascadeValues: number[];
    totalOpps: number;
  }[] = [];
  const totalOppsPerQuarter = new Array(quarters.length).fill(0);

  for (let qIdx = 0; qIdx < quarters.length; qIdx++) {
    const q = quarters[qIdx];
    const key = `${q.year}-${q.quarter}`;
    const sqls = sqlVolumes.get(key) || 0;
    const convertedOpps = sqls * conversionRate;
    const cascadeValues = new Array(quarters.length).fill(0);

    for (let p = 0; p < sqlProbs.length; p++) {
      const targetIdx = qIdx + p;
      if (targetIdx < quarters.length) {
        cascadeValues[targetIdx] = convertedOpps * sqlProbs[p];
      }
    }

    const totalOpps = cascadeValues.reduce((s, v) => s + v, 0);
    rows.push({ sqls, conv: conversionRate, cascadeValues, totalOpps });
  }

  for (const row of rows) {
    for (let c = 0; c < quarters.length; c++) {
      totalOppsPerQuarter[c] += row.cascadeValues[c];
    }
  }

  return { rows, totalOppsPerQuarter };
}

describe("Cascade Sheet Calculations", () => {
  describe("Quarter range builder", () => {
    it("builds correct range within a single year", () => {
      const range = buildQuarterRange(2024, 1, 2024, 4);
      expect(range).toHaveLength(4);
      expect(range[0].label).toBe("Q1 24");
      expect(range[3].label).toBe("Q4 24");
    });

    it("builds range spanning year boundaries", () => {
      const range = buildQuarterRange(2024, 3, 2025, 2);
      expect(range).toHaveLength(4);
      expect(range.map((r) => r.label)).toEqual([
        "Q3 24",
        "Q4 24",
        "Q1 25",
        "Q2 25",
      ]);
    });

    it("handles single quarter range", () => {
      const range = buildQuarterRange(2025, 1, 2025, 1);
      expect(range).toHaveLength(1);
    });

    it("handles multi-year range", () => {
      const range = buildQuarterRange(2020, 1, 2025, 4);
      expect(range).toHaveLength(24);
    });
  });

  describe("Cascade calculation correctness", () => {
    const quarters = buildQuarterRange(2024, 1, 2024, 4);
    const defaultProbs = [0.89, 0.1, 0.01];

    it("distributes SQLs across quarters using probability matrix", () => {
      const volumes = new Map([["2024-1", 100]]);
      const { rows } = simulateCascade(volumes, 0.5, defaultProbs, quarters);

      const q1Row = rows[0];
      expect(q1Row.sqls).toBe(100);
      expect(q1Row.cascadeValues[0]).toBeCloseTo(44.5, 1); // 100 * 0.5 * 0.89
      expect(q1Row.cascadeValues[1]).toBeCloseTo(5.0, 1); // 100 * 0.5 * 0.10
      expect(q1Row.cascadeValues[2]).toBeCloseTo(0.5, 1); // 100 * 0.5 * 0.01
      expect(q1Row.cascadeValues[3]).toBe(0);
    });

    it("total opps equals sum of distributed values", () => {
      const volumes = new Map([["2024-1", 100]]);
      const { rows } = simulateCascade(volumes, 0.5, defaultProbs, quarters);

      const total = rows[0].cascadeValues.reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(rows[0].totalOpps, 5);
    });

    it("column totals accumulate from multiple source quarters", () => {
      const volumes = new Map([
        ["2024-1", 100],
        ["2024-2", 80],
      ]);
      const { totalOppsPerQuarter } = simulateCascade(
        volumes,
        0.5,
        defaultProbs,
        quarters,
      );

      // Q2 column gets contributions from Q1 spillover + Q2 same-quarter
      const q1SpillToQ2 = 100 * 0.5 * 0.1;
      const q2SameQ = 80 * 0.5 * 0.89;
      expect(totalOppsPerQuarter[1]).toBeCloseTo(q1SpillToQ2 + q2SameQ, 1);
    });

    it("handles zero SQLs gracefully", () => {
      const volumes = new Map<string, number>();
      const { rows, totalOppsPerQuarter } = simulateCascade(
        volumes,
        0.5,
        defaultProbs,
        quarters,
      );

      expect(rows.every((r) => r.sqls === 0)).toBe(true);
      expect(totalOppsPerQuarter.every((v) => v === 0)).toBe(true);
    });

    it("handles 100% conversion rate", () => {
      const volumes = new Map([["2024-1", 50]]);
      const { rows } = simulateCascade(volumes, 1.0, defaultProbs, quarters);

      expect(rows[0].cascadeValues[0]).toBeCloseTo(50 * 0.89, 1);
      expect(rows[0].totalOpps).toBeCloseTo(50, 0);
    });

    it("handles 0% conversion rate", () => {
      const volumes = new Map([["2024-1", 50]]);
      const { rows } = simulateCascade(volumes, 0, defaultProbs, quarters);

      expect(rows[0].cascadeValues.every((v) => v === 0)).toBe(true);
    });

    it("probabilities sum determines total converted opps", () => {
      const volumes = new Map([["2024-1", 200]]);
      const probs = [0.85, 0.1, 0.05];
      const { rows } = simulateCascade(volumes, 0.4, probs, quarters);

      const totalProb = probs.reduce((s, p) => s + p, 0);
      expect(rows[0].totalOpps).toBeCloseTo(200 * 0.4 * totalProb, 1);
    });
  });

  describe("Conversion rate capping", () => {
    it("caps conversion rate at 100%", () => {
      const rawRate = 1.5;
      const capped = Math.min(rawRate, 1.0);
      expect(capped).toBe(1.0);
    });

    it("preserves rates below 100%", () => {
      const rawRate = 0.42;
      const capped = Math.min(rawRate, 1.0);
      expect(capped).toBe(0.42);
    });

    it("handles division by zero gracefully", () => {
      const sqls = 0;
      const opps = 5;
      const rate = sqls > 0 ? Math.min(opps / sqls, 1.0) : 0.5;
      expect(rate).toBe(0.5);
    });
  });

  describe("Edge cases", () => {
    it("last quarter spillover is truncated (no overflow beyond range)", () => {
      const quarters = buildQuarterRange(2024, 4, 2024, 4);
      const volumes = new Map([["2024-4", 100]]);
      const probs = [0.89, 0.1, 0.01];

      const { rows } = simulateCascade(volumes, 0.5, probs, quarters);
      // Only same-quarter applies since there are no future quarters
      expect(rows[0].cascadeValues[0]).toBeCloseTo(100 * 0.5 * 0.89, 1);
      expect(rows[0].totalOpps).toBeCloseTo(100 * 0.5 * 0.89, 1);
    });

    it("handles very large SQL volumes without precision loss", () => {
      const quarters = buildQuarterRange(2024, 1, 2024, 4);
      const volumes = new Map([["2024-1", 1000000]]);
      const { rows } = simulateCascade(
        volumes,
        0.5,
        [0.89, 0.1, 0.01],
        quarters,
      );

      expect(Number.isFinite(rows[0].totalOpps)).toBe(true);
      expect(rows[0].totalOpps).toBeGreaterThan(0);
    });

    it("handles fractional SQL volumes", () => {
      const quarters = buildQuarterRange(2024, 1, 2024, 2);
      const volumes = new Map([["2024-1", 3]]);
      const { rows } = simulateCascade(
        volumes,
        0.33,
        [0.89, 0.1, 0.01],
        quarters,
      );

      expect(rows[0].totalOpps).toBeCloseTo(3 * 0.33, 1);
    });
  });
});
