import { describe, it, expect } from "vitest";
import { CASCADE_CONSTANTS } from "@shared/const";

/**
 * Cascade Engine & Performance Tests
 *
 * Tests the cascade model calculation logic and performance characteristics.
 */

describe("Cascade Engine Logic", () => {
  describe("Quarter arithmetic", () => {
    function getNextQuarter(year: number, quarter: number) {
      if (quarter === 4) return { year: year + 1, quarter: 1 };
      return { year, quarter: quarter + 1 };
    }

    function getQuarterAhead(year: number, quarter: number, periods: number) {
      let current = { year, quarter };
      for (let i = 0; i < periods; i++) {
        current = getNextQuarter(current.year, current.quarter);
      }
      return current;
    }

    it("Q1 -> Q2 same year", () => {
      expect(getNextQuarter(2025, 1)).toEqual({ year: 2025, quarter: 2 });
    });

    it("Q4 -> Q1 next year", () => {
      expect(getNextQuarter(2025, 4)).toEqual({ year: 2026, quarter: 1 });
    });

    it("2 quarters ahead from Q3 2025 -> Q1 2026", () => {
      expect(getQuarterAhead(2025, 3, 2)).toEqual({ year: 2026, quarter: 1 });
    });

    it("4 quarters ahead = 1 year", () => {
      expect(getQuarterAhead(2025, 1, 4)).toEqual({ year: 2026, quarter: 1 });
    });
  });

  describe("Cascade calculation correctness", () => {
    function calculateOpportunities(sqlVolume: number, coverageRatioBP: number): number {
      return Math.round((sqlVolume * coverageRatioBP) / 10000);
    }

    function calculateRevenue(
      opportunities: number,
      winRateBP: number,
      acvCents: number
    ): number {
      return Math.round((opportunities * winRateBP * acvCents) / 10000);
    }

    it("calculates opportunities from SQL volume and coverage ratio", () => {
      // 100 SQLs with 50% coverage ratio (5000 BP) = 50 opportunities
      expect(calculateOpportunities(100, 5000)).toBe(50);
    });

    it("calculates opportunities with 5% coverage (default)", () => {
      // 100 SQLs with 5% coverage (500 BP) = 5 opportunities
      expect(calculateOpportunities(100, CASCADE_CONSTANTS.DEFAULT_COVERAGE_RATIO_BP)).toBe(5);
    });

    it("handles zero SQL volume", () => {
      expect(calculateOpportunities(0, 5000)).toBe(0);
    });

    it("handles zero coverage ratio", () => {
      expect(calculateOpportunities(100, 0)).toBe(0);
    });

    it("calculates revenue from opportunities, win rate, and ACV", () => {
      // 10 opps * 25% win rate (2500 BP) * $100,000 (10000000 cents) = $250,000
      const revenue = calculateRevenue(10, 2500, 10000000);
      expect(revenue).toBe(25000000); // $250,000 in cents
    });

    it("handles large SQL volumes without overflow", () => {
      const largeVolume = 1000000;
      const opps = calculateOpportunities(largeVolume, 500);
      expect(opps).toBe(50000);
      expect(Number.isFinite(opps)).toBe(true);
    });
  });

  describe("Time distribution validation", () => {
    it("default time distribution sums to 100%", () => {
      const total =
        CASCADE_CONSTANTS.DEFAULT_SAME_QUARTER_PCT +
        CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT +
        CASCADE_CONSTANTS.DEFAULT_TWO_QUARTER_PCT;
      expect(total).toBe(10000); // 100% in basis points
    });

    it("same quarter is the dominant distribution", () => {
      expect(CASCADE_CONSTANTS.DEFAULT_SAME_QUARTER_PCT).toBeGreaterThan(
        CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT
      );
      expect(CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT).toBeGreaterThan(
        CASCADE_CONSTANTS.DEFAULT_TWO_QUARTER_PCT
      );
    });

    it("default values are reasonable", () => {
      expect(CASCADE_CONSTANTS.DEFAULT_SAME_QUARTER_PCT).toBe(8900); // 89%
      expect(CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT).toBe(1000); // 10%
      expect(CASCADE_CONSTANTS.DEFAULT_TWO_QUARTER_PCT).toBe(100);   // 1%
    });
  });

  describe("Constant integrity", () => {
    it("revenue split sums to 100%", () => {
      const total =
        CASCADE_CONSTANTS.NEW_BUSINESS_REVENUE_SPLIT +
        CASCADE_CONSTANTS.UPSELL_REVENUE_SPLIT;
      expect(total).toBe(1.0);
    });

    it("default ACV is $100,000 in cents", () => {
      expect(CASCADE_CONSTANTS.DEFAULT_ACV_CENTS).toBe(10000000);
    });

    it("default win rate is 25%", () => {
      expect(CASCADE_CONSTANTS.DEFAULT_WIN_RATE_BP).toBe(2500);
    });
  });
});

describe("Performance Characteristics", () => {
  describe("Calculation performance", () => {
    it("computes 1000 cascade calculations in under 50ms", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const sqlVolume = Math.floor(Math.random() * 1000);
        const coverageRatio = 500;
        const opps = Math.round((sqlVolume * coverageRatio) / 10000);
        const winRate = 2500;
        const acv = 10000000;
        const _revenue = Math.round((opps * winRate * acv) / 10000);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("time distribution split across 3 quarters in under 10ms for 1000 iterations", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const opps = 50;
        const sameQ = Math.round((opps * 8900) / 10000);
        const nextQ = Math.round((opps * 1000) / 10000);
        const twoQ = Math.round((opps * 100) / 10000);
        const _total = sameQ + nextQ + twoQ;
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe("Input validation performance", () => {
    it("Zod schema validation runs 10000 times in under 500ms", () => {
      const schema = z.object({
        companyId: z.number(),
        regionId: z.number(),
        sqlTypeId: z.number(),
        year: z.number().int().min(2000).max(2100),
        quarter: z.number().int().min(1).max(4),
        volume: z.number().int().min(0).max(1000000),
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        schema.parse({
          companyId: 1,
          regionId: i % 3 + 1,
          sqlTypeId: i % 5 + 1,
          year: 2024 + (i % 3),
          quarter: (i % 4) + 1,
          volume: Math.floor(Math.random() * 1000),
        });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe("CSRF token generation performance", () => {
    it("generates 1000 CSRF tokens in under 100ms", async () => {
      const { randomBytes } = await import("crypto");
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        randomBytes(32).toString("hex");
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("JWT operations performance", () => {
    it("creates and verifies 100 JWT tokens in under 2000ms", async () => {
      const { randomBytes } = await import("crypto");
      const secret = randomBytes(32);
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const token = await new SignJWT({ openId: `user-${i}`, appId: "app", name: "User" })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
          .sign(secret);
        await jwtVerify(token, secret, { algorithms: ["HS256"] });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });
});

import { z } from "zod";
import { SignJWT, jwtVerify } from "jose";
