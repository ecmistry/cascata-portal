import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * HubSpot Sync Engine Tests
 *
 * Tests the data transformation logic used in the ELT sync:
 * region mapping, SQL type mapping, timing distributions,
 * conversion rate calculation, and deal classification.
 */

// Replicate the mapping logic from hubspotSync.ts
const REGION_MAP: Record<string, string> = {
  "noram": "NORAM",
  "north america": "NORAM",
  "na": "NORAM",
  "emesa north": "EMESA North",
  "emesa south": "EMESA South",
  "apac": "APAC",
  "others": "Others",
};

const SQL_TYPE_MAP: Record<string, string> = {
  "bdr generated sql": "OUTBOUND",
  "outbound": "OUTBOUND",
  "sales generated sql": "INBOUND",
  "inbound": "INBOUND",
  "direct sql": "ILO",
  "ilo": "ILO",
  "event sql": "EVENT",
  "event": "EVENT",
  "partner sql": "PARTNER",
  "partner": "PARTNER",
};

function mapRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return REGION_MAP[raw.trim().toLowerCase()] ?? null;
}

function mapSqlType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return SQL_TYPE_MAP[raw.trim().toLowerCase()] ?? null;
}

function toQuarter(
  dateStr: string | null | undefined,
): { year: number; quarter: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), quarter: Math.ceil((d.getMonth() + 1) / 3) };
}

describe("HubSpot Sync - Region Mapping", () => {
  it("maps standard region names", () => {
    expect(mapRegion("NORAM")).toBe("NORAM");
    expect(mapRegion("North America")).toBe("NORAM");
    expect(mapRegion("EMESA North")).toBe("EMESA North");
    expect(mapRegion("EMESA South")).toBe("EMESA South");
  });

  it("handles case insensitivity", () => {
    expect(mapRegion("noram")).toBe("NORAM");
    expect(mapRegion("NORAM")).toBe("NORAM");
    expect(mapRegion("NoRaM")).toBe("NORAM");
  });

  it("trims whitespace", () => {
    expect(mapRegion("  NORAM  ")).toBe("NORAM");
    expect(mapRegion("\tEMESA North\n")).toBe("EMESA North");
  });

  it("returns null for unknown regions", () => {
    expect(mapRegion("Unknown Region")).toBeNull();
    expect(mapRegion("Mars")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(mapRegion(null)).toBeNull();
    expect(mapRegion(undefined)).toBeNull();
    expect(mapRegion("")).toBeNull();
  });
});

describe("HubSpot Sync - SQL Type Mapping", () => {
  it("maps HubSpot SQL types to canonical names", () => {
    expect(mapSqlType("BDR Generated SQL")).toBe("OUTBOUND");
    expect(mapSqlType("Sales Generated SQL")).toBe("INBOUND");
    expect(mapSqlType("Direct SQL")).toBe("ILO");
    expect(mapSqlType("Event SQL")).toBe("EVENT");
    expect(mapSqlType("Partner SQL")).toBe("PARTNER");
  });

  it("maps short names", () => {
    expect(mapSqlType("outbound")).toBe("OUTBOUND");
    expect(mapSqlType("inbound")).toBe("INBOUND");
    expect(mapSqlType("ilo")).toBe("ILO");
    expect(mapSqlType("event")).toBe("EVENT");
    expect(mapSqlType("partner")).toBe("PARTNER");
  });

  it("returns null for unrecognised types", () => {
    expect(mapSqlType("Random Type")).toBeNull();
    expect(mapSqlType("")).toBeNull();
    expect(mapSqlType(null)).toBeNull();
  });
});

describe("HubSpot Sync - Quarter Extraction", () => {
  it("extracts quarter from ISO date strings", () => {
    expect(toQuarter("2024-01-15T00:00:00Z")).toEqual({
      year: 2024,
      quarter: 1,
    });
    expect(toQuarter("2024-04-01T12:00:00Z")).toEqual({
      year: 2024,
      quarter: 2,
    });
    expect(toQuarter("2024-07-31T23:59:59Z")).toEqual({
      year: 2024,
      quarter: 3,
    });
    expect(toQuarter("2024-12-25T00:00:00Z")).toEqual({
      year: 2024,
      quarter: 4,
    });
  });

  it("handles month boundaries correctly", () => {
    expect(toQuarter("2024-03-31T23:59:59Z")?.quarter).toBe(1);
    expect(toQuarter("2024-04-01T00:00:00Z")?.quarter).toBe(2);
    expect(toQuarter("2024-06-30T23:59:59Z")?.quarter).toBe(2);
    expect(toQuarter("2024-07-01T00:00:00Z")?.quarter).toBe(3);
    expect(toQuarter("2024-09-30T23:59:59Z")?.quarter).toBe(3);
    expect(toQuarter("2024-10-01T00:00:00Z")?.quarter).toBe(4);
  });

  it("returns null for invalid dates", () => {
    expect(toQuarter("not-a-date")).toBeNull();
    expect(toQuarter("")).toBeNull();
    expect(toQuarter(null)).toBeNull();
    expect(toQuarter(undefined)).toBeNull();
  });
});

describe("HubSpot Sync - Timing Distribution Calculation", () => {
  function calculateTimingDistribution(
    pairs: { sqlDate: string; oppDate: string }[],
  ) {
    const bucket = { sameQ: 0, nextQ: 0, twoQ: 0, total: 0 };

    for (const p of pairs) {
      const sqlD = new Date(p.sqlDate);
      const oppD = new Date(p.oppDate);
      if (isNaN(sqlD.getTime()) || isNaN(oppD.getTime())) continue;

      const sqlQtr = Math.ceil((sqlD.getMonth() + 1) / 3);
      const sqlYear = sqlD.getFullYear();
      const oppQtr = Math.ceil((oppD.getMonth() + 1) / 3);
      const oppYear = oppD.getFullYear();
      const qtrDiff = (oppYear - sqlYear) * 4 + (oppQtr - sqlQtr);

      if (qtrDiff <= 0) bucket.sameQ++;
      else if (qtrDiff === 1) bucket.nextQ++;
      else bucket.twoQ++;
      bucket.total++;
    }

    if (bucket.total < 5) return null;
    return {
      sameQPct: Math.round((bucket.sameQ / bucket.total) * 10000),
      nextQPct: Math.round((bucket.nextQ / bucket.total) * 10000),
      twoQPct: Math.max(
        0,
        10000 -
          Math.round((bucket.sameQ / bucket.total) * 10000) -
          Math.round((bucket.nextQ / bucket.total) * 10000),
      ),
    };
  }

  it("calculates correct distribution from same-quarter conversions", () => {
    const pairs = Array.from({ length: 10 }, () => ({
      sqlDate: "2024-01-15",
      oppDate: "2024-02-20",
    }));

    const dist = calculateTimingDistribution(pairs)!;
    expect(dist.sameQPct).toBe(10000); // all same quarter
    expect(dist.nextQPct).toBe(0);
    expect(dist.twoQPct).toBe(0);
  });

  it("calculates mixed distribution correctly", () => {
    const pairs = [
      { sqlDate: "2024-01-15", oppDate: "2024-02-20" }, // same Q
      { sqlDate: "2024-01-15", oppDate: "2024-02-25" }, // same Q
      { sqlDate: "2024-01-15", oppDate: "2024-03-10" }, // same Q
      { sqlDate: "2024-01-15", oppDate: "2024-03-15" }, // same Q
      { sqlDate: "2024-01-15", oppDate: "2024-04-05" }, // next Q
      { sqlDate: "2024-01-15", oppDate: "2024-05-01" }, // next Q
      { sqlDate: "2024-01-15", oppDate: "2024-07-01" }, // +2 Q
    ];

    const dist = calculateTimingDistribution(pairs)!;
    expect(dist.sameQPct).toBeCloseTo(5714, -1); // 4/7
    expect(dist.nextQPct).toBeCloseTo(2857, -1); // 2/7
    expect(dist.twoQPct).toBeGreaterThan(0);
    expect(dist.sameQPct + dist.nextQPct + dist.twoQPct).toBe(10000);
  });

  it("returns null with fewer than 5 data points", () => {
    const pairs = [
      { sqlDate: "2024-01-15", oppDate: "2024-02-20" },
      { sqlDate: "2024-01-16", oppDate: "2024-02-21" },
      { sqlDate: "2024-01-17", oppDate: "2024-02-22" },
      { sqlDate: "2024-01-18", oppDate: "2024-02-23" },
    ];
    expect(calculateTimingDistribution(pairs)).toBeNull();
  });

  it("handles opp date before SQL date (same quarter)", () => {
    const pairs = Array.from({ length: 5 }, () => ({
      sqlDate: "2024-03-15",
      oppDate: "2024-01-10",
    }));

    const dist = calculateTimingDistribution(pairs)!;
    expect(dist.sameQPct).toBe(10000);
  });

  it("percentages always sum to 10000 basis points", () => {
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      sqlDate: "2024-01-15",
      oppDate: `2024-${String(1 + (i % 12)).padStart(2, "0")}-15`,
    }));

    const dist = calculateTimingDistribution(pairs)!;
    expect(dist.sameQPct + dist.nextQPct + dist.twoQPct).toBe(10000);
  });
});

describe("HubSpot Sync - Deal Classification", () => {
  const closedWonStages = ["closedwon", "19291292", "96740205"];
  const newDealTypes = ["newbusiness"];
  const upsellDealTypes = ["existingbusiness", "customerrenewal"];

  function classifyDeal(
    stage: string,
    dealType: string,
  ): {
    isWon: boolean;
    isNew: boolean;
    isUpsell: boolean;
    isOpen: boolean;
  } {
    const isWon = closedWonStages.includes(stage.toLowerCase());
    const isLost =
      stage.toLowerCase() === "closedlost" ||
      stage.toLowerCase() === "closed lost";
    const isNew = newDealTypes.includes(dealType.toLowerCase());
    const isUpsell = upsellDealTypes.includes(dealType.toLowerCase());
    return {
      isWon,
      isNew: isWon && isNew,
      isUpsell: isWon && isUpsell,
      isOpen: !isWon && !isLost,
    };
  }

  it("classifies closed-won deals correctly", () => {
    const result = classifyDeal("closedwon", "newbusiness");
    expect(result.isWon).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.isUpsell).toBe(false);
  });

  it("classifies upsell deals correctly", () => {
    const result = classifyDeal("closedwon", "existingbusiness");
    expect(result.isWon).toBe(true);
    expect(result.isNew).toBe(false);
    expect(result.isUpsell).toBe(true);
  });

  it("classifies numeric stage IDs as won", () => {
    expect(classifyDeal("19291292", "newbusiness").isWon).toBe(true);
    expect(classifyDeal("96740205", "newbusiness").isWon).toBe(true);
  });

  it("classifies open deals correctly", () => {
    const result = classifyDeal("qualifiedtobuy", "newbusiness");
    expect(result.isWon).toBe(false);
    expect(result.isOpen).toBe(true);
  });

  it("classifies closed-lost deals correctly", () => {
    const result = classifyDeal("closedlost", "newbusiness");
    expect(result.isWon).toBe(false);
    expect(result.isOpen).toBe(false);
  });
});

describe("HubSpot Sync - Conversion Rate Calculation", () => {
  it("calculates rate from actuals", () => {
    const sqls = 100;
    const opps = 42;
    const rate = Math.min(opps / sqls, 1.0);
    expect(rate).toBeCloseTo(0.42, 2);
  });

  it("caps rate at 100%", () => {
    const sqls = 10;
    const opps = 15;
    const rate = Math.min(opps / sqls, 1.0);
    expect(rate).toBe(1.0);
  });

  it("handles zero SQLs", () => {
    const sqls = 0;
    const opps = 5;
    const rate = sqls > 0 ? Math.min(opps / sqls, 1.0) : 0.5;
    expect(rate).toBe(0.5);
  });

  it("handles zero opps", () => {
    const sqls = 100;
    const opps = 0;
    const rate = Math.min(opps / sqls, 1.0);
    expect(rate).toBe(0);
  });
});

describe("HubSpot Sync - Sync Config Validation", () => {
  const syncConfigSchema = z.object({
    contactSqlDateProperty: z.string().min(1),
    contactRegionProperty: z.string().min(1),
    contactSqlTypeProperty: z.string().min(1),
    contactOppDateProperty: z.string().min(1),
    dealRegionProperty: z.string().min(1),
    dealSqlTypeProperty: z.string().min(1),
    dealAmountProperty: z.string().min(1),
    dealCloseDateProperty: z.string().min(1),
    closedWonStageIds: z.array(z.string()).min(1),
    newDealTypeValues: z.array(z.string()),
    upsellDealTypeValues: z.array(z.string()),
  });

  it("accepts valid sync config", () => {
    const config = syncConfigSchema.parse({
      contactSqlDateProperty: "admin___first_became_a_sql_date",
      contactRegionProperty: "contact_pod",
      contactSqlTypeProperty: "type_of_sql",
      contactOppDateProperty: "admin___first_became_an_opportunity_date",
      dealRegionProperty: "deal_pod",
      dealSqlTypeProperty: "type_of_sql_associated_to_deal",
      dealAmountProperty: "amount",
      dealCloseDateProperty: "closedate",
      closedWonStageIds: ["closedwon"],
      newDealTypeValues: ["newbusiness"],
      upsellDealTypeValues: ["existingbusiness"],
    });
    expect(config.contactSqlDateProperty).toBe(
      "admin___first_became_a_sql_date",
    );
  });

  it("rejects empty property names", () => {
    expect(() =>
      syncConfigSchema.parse({
        contactSqlDateProperty: "",
        contactRegionProperty: "contact_pod",
        contactSqlTypeProperty: "type_of_sql",
        contactOppDateProperty: "opp_date",
        dealRegionProperty: "deal_pod",
        dealSqlTypeProperty: "deal_type",
        dealAmountProperty: "amount",
        dealCloseDateProperty: "closedate",
        closedWonStageIds: ["closedwon"],
        newDealTypeValues: [],
        upsellDealTypeValues: [],
      }),
    ).toThrow();
  });

  it("rejects empty closedWonStageIds array", () => {
    expect(() =>
      syncConfigSchema.parse({
        contactSqlDateProperty: "sql_date",
        contactRegionProperty: "contact_pod",
        contactSqlTypeProperty: "type_of_sql",
        contactOppDateProperty: "opp_date",
        dealRegionProperty: "deal_pod",
        dealSqlTypeProperty: "deal_type",
        dealAmountProperty: "amount",
        dealCloseDateProperty: "closedate",
        closedWonStageIds: [],
        newDealTypeValues: [],
        upsellDealTypeValues: [],
      }),
    ).toThrow();
  });

  it("accepts empty new/upsell deal type arrays", () => {
    const config = syncConfigSchema.parse({
      contactSqlDateProperty: "sql_date",
      contactRegionProperty: "contact_pod",
      contactSqlTypeProperty: "type_of_sql",
      contactOppDateProperty: "opp_date",
      dealRegionProperty: "deal_pod",
      dealSqlTypeProperty: "deal_type",
      dealAmountProperty: "amount",
      dealCloseDateProperty: "closedate",
      closedWonStageIds: ["closedwon"],
      newDealTypeValues: [],
      upsellDealTypeValues: [],
    });
    expect(config.newDealTypeValues).toEqual([]);
  });
});
