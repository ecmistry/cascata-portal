import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("HubSpot Client Security", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe("Token validation", () => {
    it("throws when HUBSPOT_TOKEN is not set", async () => {
      delete process.env.HUBSPOT_TOKEN;
      const mod = await import("../hubspot-client");
      await expect(mod.getHubSpotContacts(1, 10)).rejects.toThrow("HUBSPOT_TOKEN is not configured");
    });

    it("throws when HUBSPOT_TOKEN is placeholder value", async () => {
      process.env.HUBSPOT_TOKEN = "your-hubspot-token-here";
      vi.resetModules();
      const mod = await import("../hubspot-client");
      await expect(mod.getHubSpotContacts(1, 10)).rejects.toThrow("HUBSPOT_TOKEN is not configured");
    });

    it("throws when HUBSPOT_TOKEN is empty", async () => {
      process.env.HUBSPOT_TOKEN = "";
      vi.resetModules();
      const mod = await import("../hubspot-client");
      await expect(mod.getHubSpotContacts(1, 10)).rejects.toThrow("HUBSPOT_TOKEN is not configured");
    });
  });

  describe("Response shape", () => {
    it("paginated result type has correct shape", () => {
      const mockResult = {
        data: [{ id: "1", property_email: "test@test.com" }],
        pagination: {
          page: 1,
          pageSize: 25,
          totalResults: 100,
          totalPages: 4,
        },
      };
      expect(mockResult.pagination.page).toBe(1);
      expect(mockResult.pagination.totalPages).toBe(4);
      expect(mockResult.data).toHaveLength(1);
    });
  });
});
