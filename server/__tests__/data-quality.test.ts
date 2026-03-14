import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Data Quality Feature Tests
 *
 * Tests the data quality tracking, alias mapping, fallback logic,
 * coverage calculation, and report integrity for the sync engine's
 * data quality subsystem.
 */

// ── Replicate mapping logic with alias/fallback support ─────────────

interface MappingConfig {
  contactRegionMap: Record<string, string>;
  dealRegionMap: Record<string, string>;
  sqlTypeMap: Record<string, string>;
  regionAliases?: Record<string, string>;
  sqlTypeAliases?: Record<string, string>;
  fallbackRegion?: string;
  fallbackSqlType?: string;
}

function mapContactRegion(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (cfg.regionAliases?.[key]) return cfg.regionAliases[key];
  return cfg.contactRegionMap[key] ?? cfg.fallbackRegion ?? null;
}

function mapDealRegion(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (cfg.regionAliases?.[key]) return cfg.regionAliases[key];
  return cfg.dealRegionMap[key] ?? cfg.fallbackRegion ?? null;
}

function mapSqlType(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (cfg.sqlTypeAliases?.[key]) return cfg.sqlTypeAliases[key];
  return cfg.sqlTypeMap[key] ?? cfg.fallbackSqlType ?? null;
}

const BASE_CFG: MappingConfig = {
  contactRegionMap: {
    "noram": "NORAM",
    "emesa north": "EMESA_NORTH",
    "emesa south": "EMESA_SOUTH",
  },
  dealRegionMap: {
    "noram": "NORAM",
    "emesa north": "EMESA_NORTH",
    "emesa south": "EMESA_SOUTH",
  },
  sqlTypeMap: {
    "direct sql": "INBOUND",
    "bdr generated sql": "ILO",
    "sales generated sql": "OUTBOUND",
    "event generated sql": "EVENT",
  },
};

// ── Alias Mapping Tests ─────────────────────────────────────────────

describe("Data Quality - Region Alias Mapping", () => {
  it("aliases take priority over the default mapping", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "noram": "CUSTOM_REGION" },
    };
    expect(mapContactRegion("NORAM", cfg)).toBe("CUSTOM_REGION");
    expect(mapDealRegion("noram", cfg)).toBe("CUSTOM_REGION");
  });

  it("maps unknown values through aliases", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "NORAM", "latam": "EMESA_SOUTH" },
    };
    expect(mapContactRegion("APAC", cfg)).toBe("NORAM");
    expect(mapContactRegion("LATAM", cfg)).toBe("EMESA_SOUTH");
  });

  it("alias keys are case-insensitive", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "NORAM" },
    };
    expect(mapContactRegion("APAC", cfg)).toBe("NORAM");
    expect(mapContactRegion("apac", cfg)).toBe("NORAM");
    expect(mapContactRegion("Apac", cfg)).toBe("NORAM");
  });

  it("alias keys handle leading/trailing whitespace", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "NORAM" },
    };
    expect(mapContactRegion("  APAC  ", cfg)).toBe("NORAM");
  });

  it("returns null for unmapped values when no aliases or fallback", () => {
    expect(mapContactRegion("Unknown Pod", BASE_CFG)).toBeNull();
  });

  it("empty alias map behaves like no aliases", () => {
    const cfg: MappingConfig = { ...BASE_CFG, regionAliases: {} };
    expect(mapContactRegion("Unknown Pod", cfg)).toBeNull();
    expect(mapContactRegion("NORAM", cfg)).toBe("NORAM");
  });
});

describe("Data Quality - SQL Type Alias Mapping", () => {
  it("aliases take priority over the default mapping", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      sqlTypeAliases: { "direct sql": "OUTBOUND" },
    };
    expect(mapSqlType("Direct SQL", cfg)).toBe("OUTBOUND");
  });

  it("maps unknown SQL type values through aliases", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      sqlTypeAliases: { "marketing generated sql": "INBOUND", "referral sql": "PARTNER" },
    };
    expect(mapSqlType("Marketing Generated SQL", cfg)).toBe("INBOUND");
    expect(mapSqlType("Referral SQL", cfg)).toBe("PARTNER");
  });

  it("unknown values still return null when alias does not match", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      sqlTypeAliases: { "marketing sql": "INBOUND" },
    };
    expect(mapSqlType("Totally Unknown Type", cfg)).toBeNull();
  });
});

// ── Fallback Tests ──────────────────────────────────────────────────

describe("Data Quality - Fallback Region", () => {
  it("uses fallback when no mapping or alias matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: "NORAM",
    };
    expect(mapContactRegion("Unknown Pod", cfg)).toBe("NORAM");
    expect(mapContactRegion("Random Region XYZ", cfg)).toBe("NORAM");
  });

  it("does not use fallback when mapping matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: "FALLBACK",
    };
    expect(mapContactRegion("NORAM", cfg)).toBe("NORAM");
  });

  it("does not use fallback when alias matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "EMESA_SOUTH" },
      fallbackRegion: "FALLBACK",
    };
    expect(mapContactRegion("APAC", cfg)).toBe("EMESA_SOUTH");
  });

  it("returns empty string for unmapped values when fallback is empty string", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: "",
    };
    // Empty string is falsy but not nullish, so ?? returns it
    expect(mapContactRegion("Unknown", cfg)).toBe("");
  });

  it("returns null for unmapped values when fallback is undefined", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: undefined,
    };
    expect(mapContactRegion("Unknown", cfg)).toBeNull();
  });

  it("still returns null for null/empty input even with fallback set", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: "NORAM",
    };
    expect(mapContactRegion(null, cfg)).toBeNull();
    expect(mapContactRegion("", cfg)).toBeNull();
    expect(mapContactRegion(undefined, cfg)).toBeNull();
  });

  it("fallback applies to deal region mapping too", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackRegion: "NORAM",
    };
    expect(mapDealRegion("Unknown Deal Pod", cfg)).toBe("NORAM");
  });
});

describe("Data Quality - Fallback SQL Type", () => {
  it("uses fallback when no mapping or alias matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackSqlType: "INBOUND",
    };
    expect(mapSqlType("Unknown SQL Type", cfg)).toBe("INBOUND");
  });

  it("does not use fallback when mapping matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackSqlType: "FALLBACK",
    };
    expect(mapSqlType("Direct SQL", cfg)).toBe("INBOUND");
  });

  it("still returns null for null/empty input even with fallback", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      fallbackSqlType: "INBOUND",
    };
    expect(mapSqlType(null, cfg)).toBeNull();
    expect(mapSqlType("", cfg)).toBeNull();
  });
});

// ── Priority Order Tests ────────────────────────────────────────────

describe("Data Quality - Mapping Priority Order", () => {
  it("priority: alias > default map > fallback", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "noram": "ALIAS_REGION" },
      fallbackRegion: "FALLBACK_REGION",
    };
    // Alias takes priority over default map
    expect(mapContactRegion("NORAM", cfg)).toBe("ALIAS_REGION");
  });

  it("default map is used when no alias exists", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "ALIAS_REGION" },
      fallbackRegion: "FALLBACK_REGION",
    };
    expect(mapContactRegion("NORAM", cfg)).toBe("NORAM");
  });

  it("fallback is used when neither alias nor default map matches", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "apac": "ALIAS_REGION" },
      fallbackRegion: "FALLBACK_REGION",
    };
    expect(mapContactRegion("Unknown", cfg)).toBe("FALLBACK_REGION");
  });
});

// ── Coverage Calculation Tests ──────────────────────────────────────

describe("Data Quality - Coverage Percentage", () => {
  function calculateCoverage(fetched: number, used: number): number {
    return fetched > 0 ? Math.round((used / fetched) * 10000) / 100 : 0;
  }

  it("100% coverage when all contacts used", () => {
    expect(calculateCoverage(100, 100)).toBe(100);
  });

  it("0% coverage when no contacts used", () => {
    expect(calculateCoverage(100, 0)).toBe(0);
  });

  it("0% coverage when no contacts fetched", () => {
    expect(calculateCoverage(0, 0)).toBe(0);
  });

  it("calculates correct intermediate percentages", () => {
    expect(calculateCoverage(200, 170)).toBe(85);
    expect(calculateCoverage(1000, 923)).toBe(92.3);
  });

  it("handles very small coverage", () => {
    expect(calculateCoverage(10000, 1)).toBe(0.01);
  });

  it("rounds to 2 decimal places", () => {
    const pct = calculateCoverage(3, 1);
    expect(pct).toBe(33.33);
  });
});

// ── Data Quality Report Structure Tests ─────────────────────────────

describe("Data Quality - Report Structure", () => {
  const dataQualityReportSchema = z.object({
    contactsFetched: z.number().int().min(0),
    contactsUsed: z.number().int().min(0),
    contactsSkipped: z.number().int().min(0),
    skippedNoRegion: z.number().int().min(0),
    skippedNoSqlType: z.number().int().min(0),
    skippedNoSqlDate: z.number().int().min(0),
    skippedUnmappedRegion: z.number().int().min(0),
    skippedUnmappedSqlType: z.number().int().min(0),
    unmappedRegionValues: z.record(z.string(), z.number().int().min(1)),
    unmappedSqlTypeValues: z.record(z.string(), z.number().int().min(1)),
    dealsFetched: z.number().int().min(0),
    dealsUsed: z.number().int().min(0),
    dealsSkipped: z.number().int().min(0),
    dealsSkippedNoRegion: z.number().int().min(0),
    dealsSkippedNoSqlType: z.number().int().min(0),
    dealsUnmappedRegionValues: z.record(z.string(), z.number().int().min(1)),
    coveragePct: z.number().min(0).max(100),
  });

  it("accepts a valid full report", () => {
    const report = dataQualityReportSchema.parse({
      contactsFetched: 500,
      contactsUsed: 420,
      contactsSkipped: 80,
      skippedNoRegion: 30,
      skippedNoSqlType: 20,
      skippedNoSqlDate: 5,
      skippedUnmappedRegion: 15,
      skippedUnmappedSqlType: 10,
      unmappedRegionValues: { "APAC": 10, "Unknown": 5 },
      unmappedSqlTypeValues: { "Channel SQL": 10 },
      dealsFetched: 200,
      dealsUsed: 180,
      dealsSkipped: 20,
      dealsSkippedNoRegion: 10,
      dealsSkippedNoSqlType: 5,
      dealsUnmappedRegionValues: { "APAC": 5 },
      coveragePct: 84.0,
    });
    expect(report.contactsFetched).toBe(500);
  });

  it("accepts an empty/clean report", () => {
    const report = dataQualityReportSchema.parse({
      contactsFetched: 100,
      contactsUsed: 100,
      contactsSkipped: 0,
      skippedNoRegion: 0,
      skippedNoSqlType: 0,
      skippedNoSqlDate: 0,
      skippedUnmappedRegion: 0,
      skippedUnmappedSqlType: 0,
      unmappedRegionValues: {},
      unmappedSqlTypeValues: {},
      dealsFetched: 50,
      dealsUsed: 50,
      dealsSkipped: 0,
      dealsSkippedNoRegion: 0,
      dealsSkippedNoSqlType: 0,
      dealsUnmappedRegionValues: {},
      coveragePct: 100,
    });
    expect(report.coveragePct).toBe(100);
  });

  it("skip reasons must sum to total skipped", () => {
    const fetched = 500;
    const noRegion = 30;
    const noSqlType = 20;
    const noSqlDate = 5;
    const unmappedRegion = 15;
    const unmappedSqlType = 10;
    const totalSkipped = noRegion + noSqlType + noSqlDate + unmappedRegion + unmappedSqlType;
    const used = fetched - totalSkipped;

    expect(used + totalSkipped).toBe(fetched);
    expect(totalSkipped).toBe(80);
    expect(used).toBe(420);
  });

  it("rejects negative counts", () => {
    expect(() => dataQualityReportSchema.parse({
      contactsFetched: -1,
      contactsUsed: 0,
      contactsSkipped: 0,
      skippedNoRegion: 0,
      skippedNoSqlType: 0,
      skippedNoSqlDate: 0,
      skippedUnmappedRegion: 0,
      skippedUnmappedSqlType: 0,
      unmappedRegionValues: {},
      unmappedSqlTypeValues: {},
      dealsFetched: 0,
      dealsUsed: 0,
      dealsSkipped: 0,
      dealsSkippedNoRegion: 0,
      dealsSkippedNoSqlType: 0,
      dealsUnmappedRegionValues: {},
      coveragePct: 0,
    })).toThrow();
  });

  it("rejects coverage over 100%", () => {
    expect(() => dataQualityReportSchema.parse({
      contactsFetched: 100,
      contactsUsed: 100,
      contactsSkipped: 0,
      skippedNoRegion: 0,
      skippedNoSqlType: 0,
      skippedNoSqlDate: 0,
      skippedUnmappedRegion: 0,
      skippedUnmappedSqlType: 0,
      unmappedRegionValues: {},
      unmappedSqlTypeValues: {},
      dealsFetched: 0,
      dealsUsed: 0,
      dealsSkipped: 0,
      dealsSkippedNoRegion: 0,
      dealsSkippedNoSqlType: 0,
      dealsUnmappedRegionValues: {},
      coveragePct: 101,
    })).toThrow();
  });
});

// ── Report JSON Round-Trip Tests ────────────────────────────────────

describe("Data Quality - Report JSON Serialization", () => {
  it("report survives JSON round-trip", () => {
    const report = {
      contactsFetched: 500,
      contactsUsed: 420,
      contactsSkipped: 80,
      skippedNoRegion: 30,
      skippedNoSqlType: 20,
      skippedNoSqlDate: 5,
      skippedUnmappedRegion: 15,
      skippedUnmappedSqlType: 10,
      unmappedRegionValues: { "APAC": 10, "Others": 5 },
      unmappedSqlTypeValues: { "Channel SQL": 8, "Partner Generated SQL": 2 },
      dealsFetched: 200,
      dealsUsed: 180,
      dealsSkipped: 20,
      dealsSkippedNoRegion: 10,
      dealsSkippedNoSqlType: 5,
      dealsUnmappedRegionValues: {},
      coveragePct: 84.0,
    };
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(report);
  });

  it("handles special characters in unmapped values", () => {
    const report = {
      unmappedRegionValues: {
        "APAC / Pacific": 5,
        "Region (New)": 3,
        'Region "Quoted"': 2,
      },
      unmappedSqlTypeValues: {
        "SQL\nwith\nnewlines": 1,
        "SQL\twith\ttabs": 1,
      },
    };
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.unmappedRegionValues["APAC / Pacific"]).toBe(5);
    expect(parsed.unmappedRegionValues['Region "Quoted"']).toBe(2);
    expect(parsed.unmappedSqlTypeValues["SQL\nwith\nnewlines"]).toBe(1);
  });

  it("handles unicode in unmapped values", () => {
    const report = {
      unmappedRegionValues: { "日本": 3, "Ñoram": 2 },
    };
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.unmappedRegionValues["日本"]).toBe(3);
  });

  it("handles very large unmapped value counts", () => {
    const report = {
      unmappedRegionValues: { "Big Pod": 999999 },
    };
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.unmappedRegionValues["Big Pod"]).toBe(999999);
  });
});

// ── Unmapped Value Aggregation Tests ────────────────────────────────

describe("Data Quality - Unmapped Value Tracking", () => {
  function trackUnmapped(
    contacts: Array<{ region: string | null; sqlType: string | null }>,
    cfg: MappingConfig,
  ) {
    const unmappedRegions: Record<string, number> = {};
    const unmappedSqlTypes: Record<string, number> = {};
    let skippedNoRegion = 0;
    let skippedUnmappedRegion = 0;
    let skippedNoSqlType = 0;
    let skippedUnmappedSqlType = 0;
    let used = 0;

    for (const c of contacts) {
      if (!c.region) { skippedNoRegion++; continue; }
      const region = mapContactRegion(c.region, cfg);
      if (!region) {
        skippedUnmappedRegion++;
        unmappedRegions[c.region] = (unmappedRegions[c.region] || 0) + 1;
        continue;
      }
      if (!c.sqlType) { skippedNoSqlType++; continue; }
      const sqlType = mapSqlType(c.sqlType, cfg);
      if (!sqlType) {
        skippedUnmappedSqlType++;
        unmappedSqlTypes[c.sqlType] = (unmappedSqlTypes[c.sqlType] || 0) + 1;
        continue;
      }
      used++;
    }

    return {
      used,
      skippedNoRegion,
      skippedUnmappedRegion,
      skippedNoSqlType,
      skippedUnmappedSqlType,
      unmappedRegions,
      unmappedSqlTypes,
    };
  }

  it("counts unmapped region values correctly", () => {
    const contacts = [
      { region: "NORAM", sqlType: "Direct SQL" },
      { region: "APAC", sqlType: "Direct SQL" },
      { region: "APAC", sqlType: "Direct SQL" },
      { region: "LATAM", sqlType: "Direct SQL" },
    ];
    const result = trackUnmapped(contacts, BASE_CFG);
    expect(result.used).toBe(1);
    expect(result.skippedUnmappedRegion).toBe(3);
    expect(result.unmappedRegions).toEqual({ "APAC": 2, "LATAM": 1 });
  });

  it("counts unmapped SQL type values correctly", () => {
    const contacts = [
      { region: "NORAM", sqlType: "Direct SQL" },
      { region: "NORAM", sqlType: "Channel SQL" },
      { region: "NORAM", sqlType: "Channel SQL" },
      { region: "NORAM", sqlType: "Referral SQL" },
    ];
    const result = trackUnmapped(contacts, BASE_CFG);
    expect(result.used).toBe(1);
    expect(result.skippedUnmappedSqlType).toBe(3);
    expect(result.unmappedSqlTypes).toEqual({ "Channel SQL": 2, "Referral SQL": 1 });
  });

  it("counts missing fields correctly", () => {
    const contacts = [
      { region: null, sqlType: "Direct SQL" },
      { region: null, sqlType: null },
      { region: "NORAM", sqlType: null },
      { region: "NORAM", sqlType: "Direct SQL" },
    ];
    const result = trackUnmapped(contacts, BASE_CFG);
    expect(result.skippedNoRegion).toBe(2);
    expect(result.skippedNoSqlType).toBe(1);
    expect(result.used).toBe(1);
  });

  it("aliases eliminate unmapped values", () => {
    const contacts = [
      { region: "APAC", sqlType: "Direct SQL" },
      { region: "APAC", sqlType: "Direct SQL" },
    ];
    const cfgWithoutAlias = { ...BASE_CFG };
    const result1 = trackUnmapped(contacts, cfgWithoutAlias);
    expect(result1.skippedUnmappedRegion).toBe(2);

    const cfgWithAlias = { ...BASE_CFG, regionAliases: { "apac": "NORAM" } };
    const result2 = trackUnmapped(contacts, cfgWithAlias);
    expect(result2.skippedUnmappedRegion).toBe(0);
    expect(result2.used).toBe(2);
  });

  it("fallback eliminates unmapped values", () => {
    const contacts = [
      { region: "Random Pod 1", sqlType: "Direct SQL" },
      { region: "Random Pod 2", sqlType: "Direct SQL" },
    ];
    const cfgWithFallback = { ...BASE_CFG, fallbackRegion: "NORAM" };
    const result = trackUnmapped(contacts, cfgWithFallback);
    expect(result.skippedUnmappedRegion).toBe(0);
    expect(result.used).toBe(2);
  });

  it("handles completely clean data", () => {
    const contacts = [
      { region: "NORAM", sqlType: "Direct SQL" },
      { region: "EMESA North", sqlType: "BDR Generated SQL" },
    ];
    const result = trackUnmapped(contacts, BASE_CFG);
    expect(result.used).toBe(2);
    expect(result.skippedNoRegion).toBe(0);
    expect(result.skippedUnmappedRegion).toBe(0);
    expect(result.skippedNoSqlType).toBe(0);
    expect(result.skippedUnmappedSqlType).toBe(0);
    expect(Object.keys(result.unmappedRegions).length).toBe(0);
    expect(Object.keys(result.unmappedSqlTypes).length).toBe(0);
  });

  it("handles completely dirty data", () => {
    const contacts = [
      { region: null, sqlType: null },
      { region: "X", sqlType: "Y" },
      { region: null, sqlType: "Z" },
    ];
    const result = trackUnmapped(contacts, BASE_CFG);
    expect(result.used).toBe(0);
    expect(result.skippedNoRegion).toBe(2);
    expect(result.skippedUnmappedRegion).toBe(1);
  });
});

// ── Sync Config Schema with Aliases/Fallback ────────────────────────

describe("Data Quality - Extended Sync Config Validation", () => {
  const extendedConfigSchema = z.object({
    contactSqlDateProperty: z.string().min(1),
    contactRegionProperty: z.string().min(1),
    contactSqlTypeProperty: z.string().min(1),
    contactOppDateProperty: z.string().min(1),
    dealRegionProperty: z.string().min(1),
    dealSqlTypeProperty: z.string().min(1),
    dealAmountProperty: z.string().min(1),
    dealCloseDateProperty: z.string().min(1),
    dealCreatedDateProperty: z.string().min(1),
    closedWonStageIds: z.array(z.string()).min(1),
    newDealTypeValues: z.array(z.string()),
    upsellDealTypeValues: z.array(z.string()),
    regionAliases: z.record(z.string(), z.string()).optional(),
    sqlTypeAliases: z.record(z.string(), z.string()).optional(),
    fallbackRegion: z.string().optional(),
    fallbackSqlType: z.string().optional(),
  });

  function validExtendedConfig() {
    return {
      contactSqlDateProperty: "admin___first_became_a_sql_date",
      contactRegionProperty: "contact_pod",
      contactSqlTypeProperty: "type_of_sql",
      contactOppDateProperty: "admin___first_became_an_opportunity_date",
      dealRegionProperty: "deal_pod",
      dealSqlTypeProperty: "type_of_sql_associated_to_deal",
      dealAmountProperty: "amount",
      dealCloseDateProperty: "closedate",
      dealCreatedDateProperty: "createdate",
      closedWonStageIds: ["closedwon"],
      newDealTypeValues: ["newbusiness"],
      upsellDealTypeValues: ["existingbusiness"],
    };
  }

  it("accepts config without aliases/fallback (backward compatible)", () => {
    const config = extendedConfigSchema.parse(validExtendedConfig());
    expect(config.regionAliases).toBeUndefined();
    expect(config.fallbackRegion).toBeUndefined();
  });

  it("accepts config with region aliases", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      regionAliases: { "apac": "NORAM", "latam": "EMESA_SOUTH" },
    });
    expect(config.regionAliases).toEqual({ "apac": "NORAM", "latam": "EMESA_SOUTH" });
  });

  it("accepts config with SQL type aliases", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      sqlTypeAliases: { "channel sql": "PARTNER" },
    });
    expect(config.sqlTypeAliases).toEqual({ "channel sql": "PARTNER" });
  });

  it("accepts config with fallback region and SQL type", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      fallbackRegion: "NORAM",
      fallbackSqlType: "INBOUND",
    });
    expect(config.fallbackRegion).toBe("NORAM");
    expect(config.fallbackSqlType).toBe("INBOUND");
  });

  it("accepts empty string fallback (treated as disabled)", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      fallbackRegion: "",
      fallbackSqlType: "",
    });
    expect(config.fallbackRegion).toBe("");
  });

  it("accepts config with all alias/fallback fields set", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      regionAliases: { "apac": "NORAM" },
      sqlTypeAliases: { "channel sql": "PARTNER" },
      fallbackRegion: "NORAM",
      fallbackSqlType: "INBOUND",
    });
    expect(config.regionAliases).toEqual({ "apac": "NORAM" });
    expect(config.sqlTypeAliases).toEqual({ "channel sql": "PARTNER" });
    expect(config.fallbackRegion).toBe("NORAM");
    expect(config.fallbackSqlType).toBe("INBOUND");
  });

  it("rejects non-string alias values", () => {
    expect(() => extendedConfigSchema.parse({
      ...validExtendedConfig(),
      regionAliases: { "apac": 123 as any },
    })).toThrow();
  });

  it("coerces numeric alias keys to strings (JS object key behavior)", () => {
    // JavaScript coerces object keys to strings, so { 123: "NORAM" } becomes { "123": "NORAM" }
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      regionAliases: { 123: "NORAM" } as any,
    });
    expect(config.regionAliases!["123"]).toBe("NORAM");
  });

  it("accepts empty alias maps", () => {
    const config = extendedConfigSchema.parse({
      ...validExtendedConfig(),
      regionAliases: {},
      sqlTypeAliases: {},
    });
    expect(config.regionAliases).toEqual({});
  });

  it("aliases survive JSON round-trip", () => {
    const original = {
      ...validExtendedConfig(),
      regionAliases: { "apac": "NORAM", "latam": "EMESA_SOUTH" },
      sqlTypeAliases: { "channel sql": "PARTNER" },
      fallbackRegion: "NORAM",
    };
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    const validated = extendedConfigSchema.parse(parsed);
    expect(validated.regionAliases).toEqual(original.regionAliases);
    expect(validated.fallbackRegion).toBe(original.fallbackRegion);
  });
});

// ── Security: Alias Injection Prevention ────────────────────────────

describe("Data Quality - Alias Security", () => {
  it("accepts but safely handles SQL injection in alias keys", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "'; drop table companies; --": "NORAM" },
    };
    expect(mapContactRegion("'; DROP TABLE companies; --", cfg)).toBe("NORAM");
  });

  it("accepts but safely handles XSS in alias values", () => {
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { "test": '<script>alert("xss")</script>' },
    };
    const result = mapContactRegion("test", cfg);
    expect(result).toContain("<script>");
  });

  it("handles extremely long alias keys", () => {
    const longKey = "a".repeat(5000);
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: { [longKey]: "NORAM" },
    };
    expect(mapContactRegion(longKey, cfg)).toBe("NORAM");
  });

  it("handles prototype pollution attempt in alias keys", () => {
    // __proto__ as a key in object literal doesn't create a normal property,
    // so the lookup won't find it. Use Object.create(null) or a Map to avoid this.
    // This test verifies the prototype is NOT polluted.
    const aliases: Record<string, string> = Object.create(null);
    aliases["__proto__"] = "NORAM";
    aliases["constructor"] = "NORAM";
    const cfg: MappingConfig = {
      ...BASE_CFG,
      regionAliases: aliases,
    };
    expect(mapContactRegion("__proto__", cfg)).toBe("NORAM");
    expect(mapContactRegion("constructor", cfg)).toBe("NORAM");
    // Verify global prototype is not polluted
    expect(typeof ({} as any).__proto__).toBe("object");
    expect(({} as any).isAdmin).toBeUndefined();
  });
});

// ── Coverage Level Classification Tests ─────────────────────────────

describe("Data Quality - Coverage Level Classification", () => {
  function classifyCoverage(pct: number): "good" | "warning" | "bad" {
    if (pct >= 90) return "good";
    if (pct >= 70) return "warning";
    return "bad";
  }

  it("classifies 100% as good", () => {
    expect(classifyCoverage(100)).toBe("good");
  });

  it("classifies 90% as good (boundary)", () => {
    expect(classifyCoverage(90)).toBe("good");
  });

  it("classifies 89.9% as warning", () => {
    expect(classifyCoverage(89.9)).toBe("warning");
  });

  it("classifies 70% as warning (boundary)", () => {
    expect(classifyCoverage(70)).toBe("warning");
  });

  it("classifies 69.9% as bad", () => {
    expect(classifyCoverage(69.9)).toBe("bad");
  });

  it("classifies 0% as bad", () => {
    expect(classifyCoverage(0)).toBe("bad");
  });

  it("classifies 50% as bad", () => {
    expect(classifyCoverage(50)).toBe("bad");
  });

  it("classifies 95% as good", () => {
    expect(classifyCoverage(95)).toBe("good");
  });
});

// ── Timing Distribution Quality Tests ───────────────────────────────

describe("Data Quality - Timing Distribution Gaps", () => {
  function analyzeTimingGaps(
    contacts: Array<{ sqlDate: string | null; oppDate: string | null }>,
  ) {
    let contactsWithSqlDate = 0;
    let contactsWithOppDate = 0;
    let contactsMissingOppDate = 0;

    for (const c of contacts) {
      if (c.sqlDate && !isNaN(new Date(c.sqlDate).getTime())) {
        contactsWithSqlDate++;
        if (c.oppDate && !isNaN(new Date(c.oppDate).getTime())) {
          contactsWithOppDate++;
        } else {
          contactsMissingOppDate++;
        }
      }
    }
    return { contactsWithSqlDate, contactsWithOppDate, contactsMissingOppDate };
  }

  it("counts contacts with both SQL and Opp dates", () => {
    const contacts = [
      { sqlDate: "2025-01-15", oppDate: "2025-03-20" },
      { sqlDate: "2025-02-10", oppDate: "2025-04-05" },
      { sqlDate: "2025-03-01", oppDate: null },
    ];
    const result = analyzeTimingGaps(contacts);
    expect(result.contactsWithSqlDate).toBe(3);
    expect(result.contactsWithOppDate).toBe(2);
    expect(result.contactsMissingOppDate).toBe(1);
  });

  it("handles all contacts missing Opp dates", () => {
    const contacts = [
      { sqlDate: "2025-01-15", oppDate: null },
      { sqlDate: "2025-02-10", oppDate: null },
    ];
    const result = analyzeTimingGaps(contacts);
    expect(result.contactsWithSqlDate).toBe(2);
    expect(result.contactsWithOppDate).toBe(0);
    expect(result.contactsMissingOppDate).toBe(2);
  });

  it("handles contacts with no SQL date", () => {
    const contacts = [
      { sqlDate: null, oppDate: "2025-03-20" },
      { sqlDate: null, oppDate: null },
    ];
    const result = analyzeTimingGaps(contacts);
    expect(result.contactsWithSqlDate).toBe(0);
    expect(result.contactsWithOppDate).toBe(0);
    expect(result.contactsMissingOppDate).toBe(0);
  });

  it("handles invalid date strings", () => {
    const contacts = [
      { sqlDate: "not-a-date", oppDate: "2025-03-20" },
      { sqlDate: "2025-01-15", oppDate: "not-a-date" },
    ];
    const result = analyzeTimingGaps(contacts);
    expect(result.contactsWithSqlDate).toBe(1);
    expect(result.contactsMissingOppDate).toBe(1);
  });

  it("100% timing coverage when all have both dates", () => {
    const contacts = [
      { sqlDate: "2025-01-15", oppDate: "2025-03-20" },
      { sqlDate: "2025-02-10", oppDate: "2025-04-05" },
    ];
    const result = analyzeTimingGaps(contacts);
    const timingPct = result.contactsWithSqlDate > 0
      ? (result.contactsWithOppDate / result.contactsWithSqlDate) * 100 : 0;
    expect(timingPct).toBe(100);
  });

  it("handles empty contact list", () => {
    const result = analyzeTimingGaps([]);
    expect(result.contactsWithSqlDate).toBe(0);
    expect(result.contactsWithOppDate).toBe(0);
    expect(result.contactsMissingOppDate).toBe(0);
  });
});

// ── Timing Sample Size Tests ────────────────────────────────────────

describe("Data Quality - Timing Sample Size", () => {
  function classifySampleSize(count: number): "good" | "marginal" | "insufficient" {
    if (count >= 20) return "good";
    if (count >= 5) return "marginal";
    return "insufficient";
  }

  it("classifies 20+ samples as good", () => {
    expect(classifySampleSize(20)).toBe("good");
    expect(classifySampleSize(100)).toBe("good");
  });

  it("classifies 5-19 samples as marginal", () => {
    expect(classifySampleSize(5)).toBe("marginal");
    expect(classifySampleSize(19)).toBe("marginal");
  });

  it("classifies <5 samples as insufficient", () => {
    expect(classifySampleSize(4)).toBe("insufficient");
    expect(classifySampleSize(0)).toBe("insufficient");
  });

  it("accumulates samples by motion correctly", () => {
    const timingSamples: Record<string, number> = {};
    const motions = ["INBOUND", "INBOUND", "OUTBOUND", "INBOUND", "ILO"];
    for (const m of motions) {
      timingSamples[m] = (timingSamples[m] || 0) + 1;
    }
    expect(timingSamples["INBOUND"]).toBe(3);
    expect(timingSamples["OUTBOUND"]).toBe(1);
    expect(timingSamples["ILO"]).toBe(1);
  });
});

// ── Deal Economics Quality Tests ────────────────────────────────────

describe("Data Quality - Deal Amount Analysis", () => {
  function analyzeDealAmounts(amounts: (number | null)[]) {
    let dealsNoAmount = 0;
    let dealsZeroAmount = 0;
    const validAmounts: number[] = [];

    for (const amt of amounts) {
      if (amt === null) { dealsNoAmount++; continue; }
      if (amt === 0) { dealsZeroAmount++; continue; }
      validAmounts.push(amt);
    }

    validAmounts.sort((a, b) => a - b);
    const min = validAmounts[0] ?? 0;
    const max = validAmounts[validAmounts.length - 1] ?? 0;
    const mid = Math.floor(validAmounts.length / 2);
    const median = validAmounts.length === 0 ? 0
      : validAmounts.length % 2 === 0
        ? (validAmounts[mid - 1] + validAmounts[mid]) / 2
        : validAmounts[mid];

    let outliers = 0;
    if (median > 0) {
      outliers = validAmounts.filter(a => a > median * 3 || a < median * 0.1).length;
    }

    return { dealsNoAmount, dealsZeroAmount, min, max, median, outliers, validCount: validAmounts.length };
  }

  it("detects missing amounts", () => {
    const result = analyzeDealAmounts([null, 1000, null, 2000]);
    expect(result.dealsNoAmount).toBe(2);
    expect(result.validCount).toBe(2);
  });

  it("detects zero amounts", () => {
    const result = analyzeDealAmounts([0, 1000, 0, 2000]);
    expect(result.dealsZeroAmount).toBe(2);
    expect(result.validCount).toBe(2);
  });

  it("calculates correct median for odd count", () => {
    const result = analyzeDealAmounts([100, 200, 300]);
    expect(result.median).toBe(200);
  });

  it("calculates correct median for even count", () => {
    const result = analyzeDealAmounts([100, 200, 300, 400]);
    expect(result.median).toBe(250);
  });

  it("calculates min and max", () => {
    const result = analyzeDealAmounts([500, 100, 300, 800, 200]);
    expect(result.min).toBe(100);
    expect(result.max).toBe(800);
  });

  it("detects outliers above 3x median", () => {
    const result = analyzeDealAmounts([100, 200, 300, 200, 250, 10000]);
    expect(result.outliers).toBeGreaterThanOrEqual(1);
  });

  it("detects outliers below 0.1x median", () => {
    const result = analyzeDealAmounts([1000, 1200, 1100, 1050, 5]);
    expect(result.outliers).toBeGreaterThanOrEqual(1);
  });

  it("no outliers when all amounts are similar", () => {
    const result = analyzeDealAmounts([100, 110, 120, 105, 115]);
    expect(result.outliers).toBe(0);
  });

  it("handles single deal", () => {
    const result = analyzeDealAmounts([5000]);
    expect(result.median).toBe(5000);
    expect(result.min).toBe(5000);
    expect(result.max).toBe(5000);
    expect(result.outliers).toBe(0);
  });

  it("handles all null amounts", () => {
    const result = analyzeDealAmounts([null, null, null]);
    expect(result.dealsNoAmount).toBe(3);
    expect(result.validCount).toBe(0);
    expect(result.median).toBe(0);
  });

  it("handles empty deal list", () => {
    const result = analyzeDealAmounts([]);
    expect(result.validCount).toBe(0);
    expect(result.median).toBe(0);
    expect(result.outliers).toBe(0);
  });
});

describe("Data Quality - Deal Type Classification", () => {
  it("counts deals with no deal type", () => {
    const deals = [
      { amount: "1000", dealtype: "newbusiness" },
      { amount: "2000", dealtype: "" },
      { amount: "3000", dealtype: null },
      { amount: "4000", dealtype: "existingbusiness" },
    ];
    const noDealType = deals.filter(d => !d.dealtype || d.dealtype === "").length;
    expect(noDealType).toBe(2);
  });

  it("zero unclassified when all deals have types", () => {
    const deals = [
      { dealtype: "newbusiness" },
      { dealtype: "existingbusiness" },
    ];
    const noDealType = deals.filter(d => !d.dealtype || d.dealtype === "").length;
    expect(noDealType).toBe(0);
  });
});

// ── Date Anomaly Tests ──────────────────────────────────────────────

describe("Data Quality - Date Anomalies", () => {
  function detectDateAnomalies(dates: string[]) {
    const now = new Date();
    let future = 0;
    let old = 0;

    for (const d of dates) {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) continue;
      if (parsed > now) future++;
      if (parsed.getFullYear() < 2015) old++;
    }
    return { future, old };
  }

  it("detects future dates", () => {
    const result = detectDateAnomalies([
      "2030-01-01",
      "2025-06-15",
      "2099-12-31",
    ]);
    expect(result.future).toBe(2);
  });

  it("detects very old dates", () => {
    const result = detectDateAnomalies([
      "2010-01-01",
      "2014-12-31",
      "2015-01-01",
      "2025-06-15",
    ]);
    expect(result.old).toBe(2);
  });

  it("handles both future and old dates", () => {
    const result = detectDateAnomalies([
      "2010-01-01",
      "2030-01-01",
      "2025-06-15",
    ]);
    expect(result.future).toBe(1);
    expect(result.old).toBe(1);
  });

  it("handles no anomalies", () => {
    const result = detectDateAnomalies([
      "2024-01-15",
      "2025-06-15",
      "2023-03-20",
    ]);
    expect(result.future).toBe(0);
    expect(result.old).toBe(0);
  });

  it("handles invalid date strings gracefully", () => {
    const result = detectDateAnomalies([
      "not-a-date",
      "",
      "2025-01-15",
    ]);
    expect(result.future).toBe(0);
    expect(result.old).toBe(0);
  });

  it("2015 boundary: Jan 1 2015 is NOT old", () => {
    const result = detectDateAnomalies(["2015-01-01"]);
    expect(result.old).toBe(0);
  });

  it("2014 boundary: Dec 31 2014 IS old", () => {
    const result = detectDateAnomalies(["2014-12-31"]);
    expect(result.old).toBe(1);
  });
});

// ── Sparse Combination Tests ────────────────────────────────────────

describe("Data Quality - Sparse Combinations", () => {
  function detectSparseCombinations(
    sqlVolumes: Map<string, number>,
    threshold = 5,
  ) {
    const comboCounts = new Map<string, number>();
    for (const [key, count] of sqlVolumes) {
      const parts = key.split("|");
      const region = parts[0];
      const sqlType = parts[1];
      const comboKey = `${sqlType}|${region}`;
      comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + count);
    }
    const sparse: Array<{ motion: string; region: string; sqlCount: number }> = [];
    for (const [comboKey, count] of comboCounts) {
      if (count < threshold) {
        const [motion, region] = comboKey.split("|");
        sparse.push({ motion, region, sqlCount: count });
      }
    }
    return sparse;
  }

  it("detects sparse combinations below threshold", () => {
    const vols = new Map<string, number>();
    vols.set("NORAM|INBOUND|2025|1", 50);
    vols.set("NORAM|OUTBOUND|2025|1", 3);
    vols.set("EMESA_NORTH|INBOUND|2025|1", 2);

    const sparse = detectSparseCombinations(vols);
    expect(sparse.length).toBe(2);
    expect(sparse.some(s => s.motion === "OUTBOUND" && s.region === "NORAM")).toBe(true);
    expect(sparse.some(s => s.motion === "INBOUND" && s.region === "EMESA_NORTH")).toBe(true);
  });

  it("aggregates across quarters for same motion/region", () => {
    const vols = new Map<string, number>();
    vols.set("NORAM|INBOUND|2025|1", 2);
    vols.set("NORAM|INBOUND|2025|2", 2);
    vols.set("NORAM|INBOUND|2025|3", 2);

    const sparse = detectSparseCombinations(vols);
    expect(sparse.length).toBe(0);
  });

  it("returns empty when all combinations have sufficient data", () => {
    const vols = new Map<string, number>();
    vols.set("NORAM|INBOUND|2025|1", 20);
    vols.set("NORAM|OUTBOUND|2025|1", 15);

    const sparse = detectSparseCombinations(vols);
    expect(sparse.length).toBe(0);
  });

  it("returns empty for empty input", () => {
    const sparse = detectSparseCombinations(new Map());
    expect(sparse.length).toBe(0);
  });

  it("custom threshold works", () => {
    const vols = new Map<string, number>();
    vols.set("NORAM|INBOUND|2025|1", 8);

    const sparse3 = detectSparseCombinations(vols, 10);
    expect(sparse3.length).toBe(1);

    const sparse10 = detectSparseCombinations(vols, 5);
    expect(sparse10.length).toBe(0);
  });

  it("handles single-quarter single-sql scenario", () => {
    const vols = new Map<string, number>();
    vols.set("NORAM|ILO|2025|1", 1);
    const sparse = detectSparseCombinations(vols);
    expect(sparse.length).toBe(1);
    expect(sparse[0]).toEqual({ motion: "ILO", region: "NORAM", sqlCount: 1 });
  });
});

// ── Extended Report Structure with New Fields ───────────────────────

describe("Data Quality - Extended Report Structure", () => {
  const extendedReportSchema = z.object({
    contactsFetched: z.number().int().min(0),
    contactsUsed: z.number().int().min(0),
    contactsSkipped: z.number().int().min(0),
    skippedNoRegion: z.number().int().min(0),
    skippedNoSqlType: z.number().int().min(0),
    skippedNoSqlDate: z.number().int().min(0),
    skippedUnmappedRegion: z.number().int().min(0),
    skippedUnmappedSqlType: z.number().int().min(0),
    unmappedRegionValues: z.record(z.string(), z.number()),
    unmappedSqlTypeValues: z.record(z.string(), z.number()),
    dealsFetched: z.number().int().min(0),
    dealsUsed: z.number().int().min(0),
    dealsSkipped: z.number().int().min(0),
    dealsSkippedNoRegion: z.number().int().min(0),
    dealsSkippedNoSqlType: z.number().int().min(0),
    dealsSkippedNoCloseDate: z.number().int().min(0),
    dealsSkippedUnmappedRegion: z.number().int().min(0),
    dealsSkippedUnmappedSqlType: z.number().int().min(0),
    dealsUnmappedRegionValues: z.record(z.string(), z.number()),
    dealsUnmappedSqlTypeValues: z.record(z.string(), z.number()),
    coveragePct: z.number().min(0).max(100),
    contactsWithSqlDate: z.number().int().min(0),
    contactsWithOppDate: z.number().int().min(0),
    contactsMissingOppDate: z.number().int().min(0),
    timingSamplesByMotion: z.record(z.string(), z.number().int().min(0)),
    dealsClosedWon: z.number().int().min(0),
    dealsZeroAmount: z.number().int().min(0),
    dealsNoAmount: z.number().int().min(0),
    dealsNoDealType: z.number().int().min(0),
    dealAmountOutliers: z.number().int().min(0),
    dealAmountMin: z.number().min(0),
    dealAmountMax: z.number().min(0),
    dealAmountMedian: z.number().min(0),
    contactsFutureSqlDate: z.number().int().min(0),
    contactsOldSqlDate: z.number().int().min(0),
    dealsFutureCloseDate: z.number().int().min(0),
    dealsOldCloseDate: z.number().int().min(0),
    sparseCombinations: z.array(z.object({
      motion: z.string(),
      region: z.string(),
      sqlCount: z.number().int().min(0),
    })),
  });

  it("accepts a full extended report", () => {
    const report = extendedReportSchema.parse({
      contactsFetched: 1000, contactsUsed: 850, contactsSkipped: 150,
      skippedNoRegion: 50, skippedNoSqlType: 30, skippedNoSqlDate: 20,
      skippedUnmappedRegion: 30, skippedUnmappedSqlType: 20,
      unmappedRegionValues: { "APAC": 20, "LATAM": 10 },
      unmappedSqlTypeValues: { "Channel SQL": 15, "Partner SQL": 5 },
      dealsFetched: 400, dealsUsed: 350, dealsSkipped: 50,
      dealsSkippedNoRegion: 20, dealsSkippedNoSqlType: 10, dealsSkippedNoCloseDate: 3,
      dealsSkippedUnmappedRegion: 12, dealsSkippedUnmappedSqlType: 5,
      dealsUnmappedRegionValues: { "APAC": 12 },
      dealsUnmappedSqlTypeValues: { "Channel SQL": 5 },
      coveragePct: 85.0,
      contactsWithSqlDate: 900, contactsWithOppDate: 600, contactsMissingOppDate: 300,
      timingSamplesByMotion: { "INBOUND": 250, "OUTBOUND": 150, "ILO": 80, "EVENT": 120 },
      dealsClosedWon: 380, dealsZeroAmount: 5, dealsNoAmount: 10, dealsNoDealType: 15,
      dealAmountOutliers: 8, dealAmountMin: 500, dealAmountMax: 250000, dealAmountMedian: 15000,
      contactsFutureSqlDate: 3, contactsOldSqlDate: 12,
      dealsFutureCloseDate: 1, dealsOldCloseDate: 5,
      sparseCombinations: [
        { motion: "EVENT", region: "EMESA_SOUTH", sqlCount: 2 },
        { motion: "ILO", region: "EMESA_NORTH", sqlCount: 4 },
      ],
    });
    expect(report.contactsWithSqlDate).toBe(900);
    expect(report.dealAmountMedian).toBe(15000);
    expect(report.sparseCombinations.length).toBe(2);
    expect(report.dealsSkippedNoCloseDate).toBe(3);
    expect(report.dealsSkippedUnmappedRegion).toBe(12);
    expect(report.dealsSkippedUnmappedSqlType).toBe(5);
    expect(report.dealsUnmappedSqlTypeValues).toEqual({ "Channel SQL": 5 });
  });

  it("accepts an extended report with all zeros", () => {
    const report = extendedReportSchema.parse({
      contactsFetched: 0, contactsUsed: 0, contactsSkipped: 0,
      skippedNoRegion: 0, skippedNoSqlType: 0, skippedNoSqlDate: 0,
      skippedUnmappedRegion: 0, skippedUnmappedSqlType: 0,
      unmappedRegionValues: {}, unmappedSqlTypeValues: {},
      dealsFetched: 0, dealsUsed: 0, dealsSkipped: 0,
      dealsSkippedNoRegion: 0, dealsSkippedNoSqlType: 0, dealsSkippedNoCloseDate: 0,
      dealsSkippedUnmappedRegion: 0, dealsSkippedUnmappedSqlType: 0,
      dealsUnmappedRegionValues: {}, dealsUnmappedSqlTypeValues: {},
      coveragePct: 0,
      contactsWithSqlDate: 0, contactsWithOppDate: 0, contactsMissingOppDate: 0,
      timingSamplesByMotion: {},
      dealsClosedWon: 0, dealsZeroAmount: 0, dealsNoAmount: 0, dealsNoDealType: 0,
      dealAmountOutliers: 0, dealAmountMin: 0, dealAmountMax: 0, dealAmountMedian: 0,
      contactsFutureSqlDate: 0, contactsOldSqlDate: 0,
      dealsFutureCloseDate: 0, dealsOldCloseDate: 0,
      sparseCombinations: [],
    });
    expect(report.contactsFetched).toBe(0);
  });

  it("survives JSON round-trip with new fields", () => {
    const original = {
      contactsFetched: 500, contactsUsed: 400, contactsSkipped: 100,
      skippedNoRegion: 50, skippedNoSqlType: 20, skippedNoSqlDate: 10,
      skippedUnmappedRegion: 15, skippedUnmappedSqlType: 5,
      unmappedRegionValues: {}, unmappedSqlTypeValues: {},
      dealsFetched: 200, dealsUsed: 180, dealsSkipped: 20,
      dealsSkippedNoRegion: 10, dealsSkippedNoSqlType: 5, dealsSkippedNoCloseDate: 2,
      dealsSkippedUnmappedRegion: 3, dealsSkippedUnmappedSqlType: 0,
      dealsUnmappedRegionValues: { "LATAM": 3 }, dealsUnmappedSqlTypeValues: {},
      coveragePct: 80.0,
      contactsWithSqlDate: 450, contactsWithOppDate: 300, contactsMissingOppDate: 150,
      timingSamplesByMotion: { "INBOUND": 200, "OUTBOUND": 100 },
      dealsClosedWon: 190, dealsZeroAmount: 3, dealsNoAmount: 7, dealsNoDealType: 10,
      dealAmountOutliers: 5, dealAmountMin: 1000, dealAmountMax: 100000, dealAmountMedian: 12000,
      contactsFutureSqlDate: 2, contactsOldSqlDate: 8,
      dealsFutureCloseDate: 0, dealsOldCloseDate: 3,
      sparseCombinations: [{ motion: "ILO", region: "EMESA_SOUTH", sqlCount: 1 }],
    };
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    const validated = extendedReportSchema.parse(parsed);
    expect(validated.timingSamplesByMotion).toEqual(original.timingSamplesByMotion);
    expect(validated.dealAmountMedian).toBe(12000);
    expect(validated.sparseCombinations).toEqual(original.sparseCombinations);
    expect(validated.dealsSkippedNoCloseDate).toBe(2);
    expect(validated.dealsSkippedUnmappedRegion).toBe(3);
    expect(validated.dealsUnmappedRegionValues).toEqual({ "LATAM": 3 });
  });
});

// ── Deal Skip Reason Tracking Tests ─────────────────────────────────

describe("Data Quality - Deal Skip Reason Tracking", () => {
  interface Deal {
    region: string | null;
    sqlType: string | null;
    closeDate: string | null;
  }

  function trackDealSkips(
    deals: Deal[],
    cfg: MappingConfig,
    knownRegions: Set<string>,
    knownSqlTypes: Set<string>,
  ) {
    let dealsSkippedNoRegion = 0;
    let dealsSkippedNoSqlType = 0;
    let dealsSkippedNoCloseDate = 0;
    let dealsSkippedUnmappedRegion = 0;
    let dealsSkippedUnmappedSqlType = 0;
    let dealsSkipped = 0;
    let dealsUsed = 0;
    const dealsUnmappedRegionValues: Record<string, number> = {};
    const dealsUnmappedSqlTypeValues: Record<string, number> = {};

    for (const d of deals) {
      const region = mapDealRegion(d.region, cfg);
      const sqlType = mapSqlType(d.sqlType, cfg);
      const hasCloseDate = d.closeDate && !isNaN(new Date(d.closeDate).getTime());

      if (!d.region) { dealsSkippedNoRegion++; }
      else if (!region) {
        dealsSkippedUnmappedRegion++;
        dealsUnmappedRegionValues[d.region] = (dealsUnmappedRegionValues[d.region] || 0) + 1;
      }
      if (!d.sqlType) { dealsSkippedNoSqlType++; }
      else if (!sqlType) {
        dealsSkippedUnmappedSqlType++;
        dealsUnmappedSqlTypeValues[d.sqlType] = (dealsUnmappedSqlTypeValues[d.sqlType] || 0) + 1;
      }
      if (!hasCloseDate) { dealsSkippedNoCloseDate++; }

      if (!region || !sqlType || !hasCloseDate) { dealsSkipped++; continue; }
      if (!knownRegions.has(region) || !knownSqlTypes.has(sqlType)) { dealsSkipped++; continue; }
      dealsUsed++;
    }

    return {
      dealsUsed, dealsSkipped,
      dealsSkippedNoRegion, dealsSkippedNoSqlType, dealsSkippedNoCloseDate,
      dealsSkippedUnmappedRegion, dealsSkippedUnmappedSqlType,
      dealsUnmappedRegionValues, dealsUnmappedSqlTypeValues,
    };
  }

  const knownRegions = new Set(["NORAM", "EMESA_NORTH", "EMESA_SOUTH"]);
  const knownSqlTypes = new Set(["INBOUND", "ILO", "OUTBOUND", "EVENT"]);

  it("tracks deals skipped due to missing region", () => {
    const deals: Deal[] = [
      { region: null, sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: null, sqlType: "Direct SQL", closeDate: "2025-07-01" },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedNoRegion).toBe(2);
    expect(result.dealsUsed).toBe(1);
    expect(result.dealsSkipped).toBe(2);
  });

  it("tracks deals skipped due to unmapped region", () => {
    const deals: Deal[] = [
      { region: "APAC", sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: "LATAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: "APAC", sqlType: "Direct SQL", closeDate: "2025-07-01" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedUnmappedRegion).toBe(3);
    expect(result.dealsUnmappedRegionValues).toEqual({ "APAC": 2, "LATAM": 1 });
    expect(result.dealsUsed).toBe(0);
  });

  it("tracks deals skipped due to missing SQL type", () => {
    const deals: Deal[] = [
      { region: "NORAM", sqlType: null, closeDate: "2025-06-15" },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedNoSqlType).toBe(1);
    expect(result.dealsUsed).toBe(1);
  });

  it("tracks deals skipped due to unmapped SQL type", () => {
    const deals: Deal[] = [
      { region: "NORAM", sqlType: "Channel SQL", closeDate: "2025-06-15" },
      { region: "NORAM", sqlType: "Referral SQL", closeDate: "2025-06-15" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedUnmappedSqlType).toBe(2);
    expect(result.dealsUnmappedSqlTypeValues).toEqual({ "Channel SQL": 1, "Referral SQL": 1 });
    expect(result.dealsUsed).toBe(0);
  });

  it("tracks deals skipped due to missing close date", () => {
    const deals: Deal[] = [
      { region: "NORAM", sqlType: "Direct SQL", closeDate: null },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "" },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "not-a-date" },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedNoCloseDate).toBe(3);
    expect(result.dealsUsed).toBe(1);
  });

  it("handles deals with multiple missing fields", () => {
    const deals: Deal[] = [
      { region: null, sqlType: null, closeDate: null },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedNoRegion).toBe(1);
    expect(result.dealsSkippedNoSqlType).toBe(1);
    expect(result.dealsSkippedNoCloseDate).toBe(1);
    expect(result.dealsSkipped).toBe(1);
  });

  it("aliases resolve deal unmapped regions", () => {
    const deals: Deal[] = [
      { region: "APAC", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const cfgWithAlias = { ...BASE_CFG, regionAliases: { "apac": "NORAM" } };
    const result = trackDealSkips(deals, cfgWithAlias, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedUnmappedRegion).toBe(0);
    expect(result.dealsUsed).toBe(1);
  });

  it("aliases resolve deal unmapped SQL types", () => {
    const deals: Deal[] = [
      { region: "NORAM", sqlType: "Channel SQL", closeDate: "2025-06-15" },
    ];
    const cfgWithAlias = { ...BASE_CFG, sqlTypeAliases: { "channel sql": "INBOUND" } };
    const result = trackDealSkips(deals, cfgWithAlias, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedUnmappedSqlType).toBe(0);
    expect(result.dealsUsed).toBe(1);
  });

  it("fallback resolves deal unmapped regions", () => {
    const deals: Deal[] = [
      { region: "Unknown Region", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const cfgWithFallback = { ...BASE_CFG, fallbackRegion: "NORAM" };
    const result = trackDealSkips(deals, cfgWithFallback, knownRegions, knownSqlTypes);
    expect(result.dealsSkippedUnmappedRegion).toBe(0);
    expect(result.dealsUsed).toBe(1);
  });

  it("all clean deals are used", () => {
    const deals: Deal[] = [
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: "EMESA North", sqlType: "BDR Generated SQL", closeDate: "2025-07-01" },
      { region: "EMESA South", sqlType: "Sales Generated SQL", closeDate: "2025-08-10" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsUsed).toBe(3);
    expect(result.dealsSkipped).toBe(0);
    expect(result.dealsSkippedNoRegion).toBe(0);
    expect(result.dealsSkippedNoSqlType).toBe(0);
    expect(result.dealsSkippedNoCloseDate).toBe(0);
    expect(result.dealsSkippedUnmappedRegion).toBe(0);
    expect(result.dealsSkippedUnmappedSqlType).toBe(0);
  });

  it("deal skip reasons sum correctly", () => {
    const deals: Deal[] = [
      { region: null, sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: "APAC", sqlType: "Direct SQL", closeDate: "2025-06-15" },
      { region: "NORAM", sqlType: null, closeDate: "2025-06-15" },
      { region: "NORAM", sqlType: "Channel SQL", closeDate: "2025-06-15" },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: null },
      { region: "NORAM", sqlType: "Direct SQL", closeDate: "2025-06-15" },
    ];
    const result = trackDealSkips(deals, BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsUsed).toBe(1);
    expect(result.dealsSkipped).toBe(5);
    expect(result.dealsUsed + result.dealsSkipped).toBe(deals.length);
  });

  it("handles empty deal list", () => {
    const result = trackDealSkips([], BASE_CFG, knownRegions, knownSqlTypes);
    expect(result.dealsUsed).toBe(0);
    expect(result.dealsSkipped).toBe(0);
    expect(result.dealsSkippedNoRegion).toBe(0);
    expect(result.dealsSkippedNoSqlType).toBe(0);
    expect(result.dealsSkippedNoCloseDate).toBe(0);
    expect(result.dealsSkippedUnmappedRegion).toBe(0);
    expect(result.dealsSkippedUnmappedSqlType).toBe(0);
  });
});
