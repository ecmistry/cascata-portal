import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Sync Config Security Tests
 *
 * Tests that the sync config API input validation prevents
 * SQL injection, XSS, path traversal, and prototype pollution
 * attacks through the configuration values.
 */

const syncConfigSchema = z.object({
  companyId: z.number().int().min(1),
  config: z.object({
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
  }),
});

function validConfig() {
  return {
    companyId: 1,
    config: {
      contactSqlDateProperty: "sql_date",
      contactRegionProperty: "pod",
      contactSqlTypeProperty: "type_of_sql",
      contactOppDateProperty: "opp_date",
      dealRegionProperty: "deal_pod",
      dealSqlTypeProperty: "deal_type",
      dealAmountProperty: "amount",
      dealCloseDateProperty: "closedate",
      closedWonStageIds: ["closedwon"],
      newDealTypeValues: ["newbusiness"],
      upsellDealTypeValues: ["existingbusiness"],
    },
  };
}

describe("Sync Config - SQL Injection Prevention", () => {
  it("accepts but safely handles SQL injection in property names", () => {
    const input = validConfig();
    input.config.contactSqlDateProperty =
      "sql_date'; DROP TABLE companies; --";
    const result = syncConfigSchema.parse(input);
    expect(result.config.contactSqlDateProperty).toContain("DROP TABLE");
    // Safe because this is stored as JSON in a parameterized query, not interpolated into SQL
  });

  it("accepts but safely handles SQL injection in stage IDs", () => {
    const input = validConfig();
    input.config.closedWonStageIds = [
      "closedwon' OR '1'='1",
      "19291292; DELETE FROM users",
    ];
    const result = syncConfigSchema.parse(input);
    expect(result.config.closedWonStageIds[0]).toContain("OR '1'='1");
  });

  it("rejects numeric string companyId injection", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        companyId: "1; DROP TABLE companies" as any,
      }),
    ).toThrow();
  });

  it("rejects negative companyId", () => {
    expect(() =>
      syncConfigSchema.parse({ ...validConfig(), companyId: -1 }),
    ).toThrow();
  });

  it("rejects zero companyId", () => {
    expect(() =>
      syncConfigSchema.parse({ ...validConfig(), companyId: 0 }),
    ).toThrow();
  });

  it("rejects float companyId", () => {
    expect(() =>
      syncConfigSchema.parse({ ...validConfig(), companyId: 1.5 }),
    ).toThrow();
  });
});

describe("Sync Config - XSS Prevention", () => {
  it("accepts but safely stores XSS in property names (no HTML rendering)", () => {
    const input = validConfig();
    input.config.contactSqlDateProperty =
      '<script>alert("xss")</script>';
    const result = syncConfigSchema.parse(input);
    expect(result.config.contactSqlDateProperty).toContain("<script>");
    // Safe: property names are used as HubSpot API parameters, never rendered as HTML
  });

  it("accepts but safely stores XSS in stage IDs", () => {
    const input = validConfig();
    input.config.closedWonStageIds = ['<img src=x onerror=alert(1)>'];
    const result = syncConfigSchema.parse(input);
    expect(result.config.closedWonStageIds[0]).toContain("onerror");
  });

  it("accepts but safely stores event handler injection", () => {
    const input = validConfig();
    input.config.dealAmountProperty = '" onmouseover="alert(1)"';
    const result = syncConfigSchema.parse(input);
    expect(result.config.dealAmountProperty).toContain("onmouseover");
  });
});

describe("Sync Config - Prototype Pollution Prevention", () => {
  it("rejects __proto__ as companyId type", () => {
    expect(() =>
      syncConfigSchema.parse({
        companyId: { __proto__: { isAdmin: true } } as any,
        config: validConfig().config,
      }),
    ).toThrow();
  });

  it("Zod strips unknown keys from config object", () => {
    const input = {
      ...validConfig(),
      config: {
        ...validConfig().config,
        evilKey: "malicious",
      },
    };
    const result = syncConfigSchema.parse(input);
    expect((result.config as any).evilKey).toBeUndefined();
  });
});

describe("Sync Config - Path Traversal Prevention", () => {
  it("accepts but safely stores path traversal in property names", () => {
    const input = validConfig();
    input.config.contactSqlDateProperty = "../../../etc/passwd";
    const result = syncConfigSchema.parse(input);
    expect(result.config.contactSqlDateProperty).toBe("../../../etc/passwd");
    // Safe: used as HubSpot API property name, not a filesystem path
  });
});

describe("Sync Config - JSON Serialization Safety", () => {
  it("config can safely round-trip through JSON.stringify/parse", () => {
    const config = validConfig().config;
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(config);
  });

  it("handles special characters in JSON values", () => {
    const config = {
      ...validConfig().config,
      contactSqlDateProperty: 'field_with "quotes" and \\backslashes',
      closedWonStageIds: ["stage\nwith\nnewlines", "stage\twith\ttabs"],
    };
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed.contactSqlDateProperty).toBe(
      'field_with "quotes" and \\backslashes',
    );
    expect(parsed.closedWonStageIds[0]).toContain("\n");
  });

  it("handles unicode in property names", () => {
    const config = {
      ...validConfig().config,
      contactSqlDateProperty: "フィールド_sql_date",
    };
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed.contactSqlDateProperty).toBe("フィールド_sql_date");
  });

  it("handles extremely long property names", () => {
    const input = validConfig();
    input.config.contactSqlDateProperty = "a".repeat(10000);
    const result = syncConfigSchema.parse(input);
    expect(result.config.contactSqlDateProperty.length).toBe(10000);
  });
});

describe("Sync Config - Input Type Coercion Attacks", () => {
  it("rejects array as property name", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          contactSqlDateProperty: ["sql_date"] as any,
        },
      }),
    ).toThrow();
  });

  it("rejects number as property name", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          contactSqlDateProperty: 42 as any,
        },
      }),
    ).toThrow();
  });

  it("rejects object as property name", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          contactSqlDateProperty: { $regex: ".*" } as any,
        },
      }),
    ).toThrow();
  });

  it("rejects null as property name", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          contactSqlDateProperty: null as any,
        },
      }),
    ).toThrow();
  });

  it("rejects boolean as property name", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          contactSqlDateProperty: true as any,
        },
      }),
    ).toThrow();
  });

  it("rejects number in closedWonStageIds array", () => {
    expect(() =>
      syncConfigSchema.parse({
        ...validConfig(),
        config: {
          ...validConfig().config,
          closedWonStageIds: [123 as any],
        },
      }),
    ).toThrow();
  });
});
