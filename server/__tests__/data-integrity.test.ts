import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Data Integrity Tests
 *
 * Tests that data transformations, schema constraints,
 * and business logic validations maintain data integrity
 * throughout the pipeline.
 */

describe("Database Schema Constraints", () => {
  describe("SQL History table constraints", () => {
    const sqlHistorySchema = z.object({
      companyId: z.number().int().min(1),
      regionId: z.number().int().min(1),
      sqlTypeId: z.number().int().min(1),
      year: z.number().int().min(2000).max(2100),
      quarter: z.number().int().min(1).max(4),
      volume: z.number().int().min(0).max(1000000),
    });

    it("accepts valid SQL history record", () => {
      const record = sqlHistorySchema.parse({
        companyId: 1,
        regionId: 1,
        sqlTypeId: 1,
        year: 2024,
        quarter: 3,
        volume: 150,
      });
      expect(record.year).toBe(2024);
    });

    it("rejects year before 2000", () => {
      expect(() =>
        sqlHistorySchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 1999,
          quarter: 1,
          volume: 50,
        }),
      ).toThrow();
    });

    it("rejects year after 2100", () => {
      expect(() =>
        sqlHistorySchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 2101,
          quarter: 1,
          volume: 50,
        }),
      ).toThrow();
    });

    it("rejects quarter 0", () => {
      expect(() =>
        sqlHistorySchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 2024,
          quarter: 0,
          volume: 50,
        }),
      ).toThrow();
    });

    it("rejects quarter 5", () => {
      expect(() =>
        sqlHistorySchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 2024,
          quarter: 5,
          volume: 50,
        }),
      ).toThrow();
    });

    it("rejects negative volume", () => {
      expect(() =>
        sqlHistorySchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 2024,
          quarter: 1,
          volume: -10,
        }),
      ).toThrow();
    });
  });

  describe("Actuals table constraints", () => {
    const actualsSchema = z.object({
      companyId: z.number().int().min(1),
      regionId: z.number().int().min(1),
      sqlTypeId: z.number().int().min(1),
      year: z.number().int().min(2000).max(2100),
      quarter: z.number().int().min(1).max(4),
      actualSqls: z.number().int().min(0),
      actualOpps: z.number().int().min(0),
      actualRevenue: z.number().min(0),
    });

    it("accepts valid actuals record", () => {
      const record = actualsSchema.parse({
        companyId: 1,
        regionId: 1,
        sqlTypeId: 1,
        year: 2024,
        quarter: 1,
        actualSqls: 100,
        actualOpps: 42,
        actualRevenue: 500000,
      });
      expect(record.actualOpps).toBe(42);
    });

    it("allows opps greater than SQLs (data integrity, not business rule)", () => {
      const record = actualsSchema.parse({
        companyId: 1,
        regionId: 1,
        sqlTypeId: 1,
        year: 2024,
        quarter: 1,
        actualSqls: 10,
        actualOpps: 15,
        actualRevenue: 0,
      });
      expect(record.actualOpps).toBe(15);
    });

    it("rejects negative SQLs", () => {
      expect(() =>
        actualsSchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          year: 2024,
          quarter: 1,
          actualSqls: -5,
          actualOpps: 0,
          actualRevenue: 0,
        }),
      ).toThrow();
    });
  });

  describe("Conversion Rates table constraints", () => {
    const convRateSchema = z.object({
      companyId: z.number().int().min(1),
      regionId: z.number().int().min(1),
      sqlTypeId: z.number().int().min(1),
      oppCoverageRatio: z.number().min(0).max(10000),
      winRateNew: z.number().min(0).max(10000),
      winRateUpsell: z.number().min(0).max(10000),
    });

    it("accepts valid conversion rates in basis points", () => {
      const record = convRateSchema.parse({
        companyId: 1,
        regionId: 1,
        sqlTypeId: 1,
        oppCoverageRatio: 500,
        winRateNew: 2500,
        winRateUpsell: 3000,
      });
      expect(record.winRateNew).toBe(2500);
    });

    it("rejects rates above 100% (10000 BP)", () => {
      expect(() =>
        convRateSchema.parse({
          companyId: 1,
          regionId: 1,
          sqlTypeId: 1,
          oppCoverageRatio: 500,
          winRateNew: 10001,
          winRateUpsell: 5000,
        }),
      ).toThrow();
    });

    it("allows zero rates", () => {
      const record = convRateSchema.parse({
        companyId: 1,
        regionId: 1,
        sqlTypeId: 1,
        oppCoverageRatio: 0,
        winRateNew: 0,
        winRateUpsell: 0,
      });
      expect(record.winRateNew).toBe(0);
    });
  });

  describe("Time Distribution constraints", () => {
    const timeDistSchema = z
      .object({
        sameQuarterPct: z.number().int().min(0).max(10000),
        nextQuarterPct: z.number().int().min(0).max(10000),
        twoQuarterPct: z.number().int().min(0).max(10000),
      })
      .refine(
        (d) => d.sameQuarterPct + d.nextQuarterPct + d.twoQuarterPct === 10000,
        { message: "Time distribution must sum to 100% (10000 BP)" },
      );

    it("accepts distribution that sums to 100%", () => {
      const dist = timeDistSchema.parse({
        sameQuarterPct: 8900,
        nextQuarterPct: 1000,
        twoQuarterPct: 100,
      });
      expect(dist.sameQuarterPct + dist.nextQuarterPct + dist.twoQuarterPct).toBe(10000);
    });

    it("rejects distribution that does not sum to 100%", () => {
      expect(() =>
        timeDistSchema.parse({
          sameQuarterPct: 5000,
          nextQuarterPct: 3000,
          twoQuarterPct: 1000,
        }),
      ).toThrow();
    });

    it("rejects negative percentages", () => {
      expect(() =>
        timeDistSchema.parse({
          sameQuarterPct: -100,
          nextQuarterPct: 5100,
          twoQuarterPct: 5000,
        }),
      ).toThrow();
    });
  });
});

describe("Data Transformation Correctness", () => {
  describe("Revenue calculations", () => {
    function calculateRevenue(
      opps: number,
      winRateBP: number,
      acvCents: number,
    ): number {
      return Math.round((opps * winRateBP * acvCents) / 10000);
    }

    it("calculates new business revenue correctly", () => {
      const revenue = calculateRevenue(10, 2500, 10000000);
      expect(revenue).toBe(25000000); // $250,000 in cents
    });

    it("calculates upsell revenue correctly", () => {
      const revenue = calculateRevenue(5, 3500, 8000000);
      expect(revenue).toBe(14000000); // $140,000 in cents
    });

    it("handles zero opportunities", () => {
      expect(calculateRevenue(0, 2500, 10000000)).toBe(0);
    });

    it("handles zero win rate", () => {
      expect(calculateRevenue(10, 0, 10000000)).toBe(0);
    });

    it("handles zero ACV", () => {
      expect(calculateRevenue(10, 2500, 0)).toBe(0);
    });

    it("revenue is always non-negative", () => {
      for (let i = 0; i < 100; i++) {
        const opps = Math.floor(Math.random() * 100);
        const wr = Math.floor(Math.random() * 10000);
        const acv = Math.floor(Math.random() * 50000000);
        expect(calculateRevenue(opps, wr, acv)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Basis point conversions", () => {
    it("25% = 2500 basis points", () => {
      expect(0.25 * 10000).toBe(2500);
    });

    it("89% = 8900 basis points", () => {
      expect(0.89 * 10000).toBe(8900);
    });

    it("100% = 10000 basis points", () => {
      expect(1.0 * 10000).toBe(10000);
    });

    it("converts basis points back to percentage", () => {
      expect(2500 / 10000).toBe(0.25);
    });
  });

  describe("Quarter label formatting", () => {
    function makeLabel(year: number, quarter: number): string {
      return `Q${quarter} ${String(year).slice(2)}`;
    }

    it("formats 2024 Q1 correctly", () => {
      expect(makeLabel(2024, 1)).toBe("Q1 24");
    });

    it("formats 2025 Q4 correctly", () => {
      expect(makeLabel(2025, 4)).toBe("Q4 25");
    });

    it("formats year 2000 correctly", () => {
      expect(makeLabel(2000, 1)).toBe("Q1 00");
    });
  });
});

describe("HubSpot API Response Validation", () => {
  const hubspotContactSchema = z.object({
    id: z.string(),
    properties: z.record(z.string(), z.string().nullable()),
  });

  it("accepts valid HubSpot contact response", () => {
    const contact = hubspotContactSchema.parse({
      id: "12345",
      properties: {
        firstname: "John",
        lastname: "Doe",
        contact_pod: "NORAM",
        type_of_sql: "BDR Generated SQL",
        admin___first_became_a_sql_date: "2024-01-15T00:00:00.000Z",
      },
    });
    expect(contact.id).toBe("12345");
  });

  it("accepts null property values", () => {
    const contact = hubspotContactSchema.parse({
      id: "12345",
      properties: {
        contact_pod: null,
        type_of_sql: null,
      },
    });
    expect(contact.properties.contact_pod).toBeNull();
  });

  it("rejects missing id", () => {
    expect(() =>
      hubspotContactSchema.parse({
        properties: { name: "Test" },
      }),
    ).toThrow();
  });
});
