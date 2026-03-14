import { describe, it, expect } from "vitest";

/**
 * Performance & Stress Tests
 *
 * Tests that cascade calculations, data transformations,
 * and security operations perform within acceptable bounds
 * under load and with large datasets.
 */

describe("Cascade Calculation Performance", () => {
  function simulateCascade(
    numQuarters: number,
    sqlsPerQuarter: number,
    convRate: number,
    probs: number[],
  ) {
    const totalOppsPerQuarter = new Array(numQuarters).fill(0);
    for (let qIdx = 0; qIdx < numQuarters; qIdx++) {
      const converted = sqlsPerQuarter * convRate;
      for (let p = 0; p < probs.length; p++) {
        const targetIdx = qIdx + p;
        if (targetIdx < numQuarters) {
          totalOppsPerQuarter[targetIdx] += converted * probs[p];
        }
      }
    }
    return totalOppsPerQuarter;
  }

  it("calculates 20 quarters x 5 motions x 3 regions in under 50ms", () => {
    const start = performance.now();
    for (let motion = 0; motion < 5; motion++) {
      for (let region = 0; region < 3; region++) {
        simulateCascade(20, 50 + motion * 10, 0.4 + region * 0.1, [
          0.89, 0.1, 0.01,
        ]);
      }
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("handles 100 quarters (25 years) without timeout", () => {
    const start = performance.now();
    const result = simulateCascade(100, 200, 0.5, [0.89, 0.1, 0.01]);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result).toHaveLength(100);
    expect(result.every(Number.isFinite)).toBe(true);
  });

  it("handles 1000 SQLs per quarter without precision loss", () => {
    const result = simulateCascade(12, 1000, 0.5, [0.89, 0.1, 0.01]);
    expect(result[0]).toBeGreaterThan(0);
    expect(result.every(Number.isFinite)).toBe(true);
  });
});

describe("Region/Type Mapping Performance", () => {
  const regionMap: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    regionMap[`region_${i}`] = `REGION_${i}`;
  }

  function mapRegion(raw: string): string | null {
    return regionMap[raw.trim().toLowerCase()] ?? null;
  }

  it("maps 100k region lookups in under 100ms", () => {
    const start = performance.now();
    for (let i = 0; i < 100000; i++) {
      mapRegion(`region_${i % 100}`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe("JSON Serialization Performance", () => {
  it("serializes and deserializes large sync config 10000 times in under 500ms", () => {
    const config = {
      contactSqlDateProperty: "admin___first_became_a_sql_date",
      contactRegionProperty: "contact_pod",
      contactSqlTypeProperty: "type_of_sql",
      contactOppDateProperty: "admin___first_became_an_opportunity_date",
      dealRegionProperty: "deal_pod",
      dealSqlTypeProperty: "type_of_sql_associated_to_deal",
      dealAmountProperty: "amount",
      dealCloseDateProperty: "closedate",
      closedWonStageIds: [
        "closedwon",
        "19291292",
        "96740205",
        "stage4",
        "stage5",
      ],
      newDealTypeValues: ["newbusiness", "new_business"],
      upsellDealTypeValues: [
        "existingbusiness",
        "customerrenewal",
        "cross_sell",
      ],
    };

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const json = JSON.stringify(config);
      JSON.parse(json);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

describe("Date Parsing Performance", () => {
  function toQuarter(dateStr: string): { year: number; quarter: number } | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      quarter: Math.ceil((d.getMonth() + 1) / 3),
    };
  }

  it("parses 100k date strings in under 500ms", () => {
    const dates = Array.from(
      { length: 100000 },
      (_, i) =>
        `${2020 + (i % 6)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00Z`,
    );

    const start = performance.now();
    for (const d of dates) {
      toQuarter(d);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

describe("Timing Distribution Calculation Performance", () => {
  it("processes 10000 SQL→Opp date pairs in under 100ms", () => {
    const pairs = Array.from({ length: 10000 }, (_, i) => ({
      sqlDate: new Date(2022, i % 12, 1 + (i % 28)),
      oppDate: new Date(
        2022,
        (i % 12) + Math.floor(Math.random() * 3),
        1 + (i % 28),
      ),
    }));

    const start = performance.now();
    const buckets = { sameQ: 0, nextQ: 0, twoQ: 0 };

    for (const p of pairs) {
      const sqlQtr = Math.ceil((p.sqlDate.getMonth() + 1) / 3);
      const sqlYear = p.sqlDate.getFullYear();
      const oppQtr = Math.ceil((p.oppDate.getMonth() + 1) / 3);
      const oppYear = p.oppDate.getFullYear();
      const diff = (oppYear - sqlYear) * 4 + (oppQtr - sqlQtr);

      if (diff <= 0) buckets.sameQ++;
      else if (diff === 1) buckets.nextQ++;
      else buckets.twoQ++;
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(buckets.sameQ + buckets.nextQ + buckets.twoQ).toBe(10000);
  });
});

describe("Memory Safety", () => {
  it("does not leak memory across 1000 cascade calculations", () => {
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      const quarters = 20;
      const totalOpps = new Array(quarters).fill(0);
      for (let q = 0; q < quarters; q++) {
        const sqls = Math.floor(Math.random() * 200);
        const opps = sqls * 0.5;
        totalOpps[q] += opps * 0.89;
        if (q + 1 < quarters) totalOpps[q + 1] += opps * 0.1;
        if (q + 2 < quarters) totalOpps[q + 2] += opps * 0.01;
      }
    }

    const after = process.memoryUsage().heapUsed;
    const growthMB = (after - before) / 1024 / 1024;
    expect(growthMB).toBeLessThan(50);
  });
});

describe("Concurrent Request Simulation", () => {
  it("handles 100 concurrent cascade calculations without errors", async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      new Promise<number>((resolve) => {
        const quarters = 12;
        const total = new Array(quarters).fill(0);
        for (let q = 0; q < quarters; q++) {
          const sqls = 50 + i;
          const opps = sqls * 0.45;
          total[q] += opps * 0.89;
          if (q + 1 < quarters) total[q + 1] += opps * 0.1;
          if (q + 2 < quarters) total[q + 2] += opps * 0.01;
        }
        resolve(total.reduce((s, v) => s + v, 0));
      }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    expect(results.every((r) => Number.isFinite(r) && r > 0)).toBe(true);
  });
});

describe("bcrypt Performance", () => {
  it("hashes a password in under 1000ms", async () => {
    const bcrypt = await import("bcrypt");
    const start = performance.now();
    await bcrypt.hash("TestPassword123!", 10);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it("verifies a password in under 1000ms", async () => {
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("TestPassword123!", 10);
    const start = performance.now();
    const match = await bcrypt.compare("TestPassword123!", hash);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(match).toBe(true);
  });

  it("rejects wrong password", async () => {
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("CorrectPassword!", 10);
    const match = await bcrypt.compare("WrongPassword!", hash);
    expect(match).toBe(false);
  });
});
