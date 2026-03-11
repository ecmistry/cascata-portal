import { describe, it, expect } from "vitest";
import { passwordSchema, emailOrUsernameSchema, companyNameSchema, descriptionSchema } from "../_core/validation";

describe("Input Validation Schemas", () => {
  describe("Password validation", () => {
    it("rejects passwords shorter than 8 characters", () => {
      expect(() => passwordSchema.parse("Ab1!")).toThrow();
    });

    it("rejects passwords without uppercase letters", () => {
      expect(() => passwordSchema.parse("abcdefg1!")).toThrow();
    });

    it("rejects passwords without lowercase letters", () => {
      expect(() => passwordSchema.parse("ABCDEFG1!")).toThrow();
    });

    it("rejects passwords without numbers", () => {
      expect(() => passwordSchema.parse("Abcdefgh!")).toThrow();
    });

    it("rejects passwords without special characters", () => {
      expect(() => passwordSchema.parse("Abcdefg1")).toThrow();
    });

    it("accepts strong passwords", () => {
      const pw = "Aa1!xxxx";
      expect(passwordSchema.parse(pw)).toBe(pw);
    });

    it("accepts complex passwords with special chars", () => {
      const pw = "Zz9@testvalue!!";
      expect(passwordSchema.parse(pw)).toBe(pw);
    });

    it("rejects empty passwords", () => {
      expect(() => passwordSchema.parse("")).toThrow();
    });
  });

  describe("Email/Username validation", () => {
    it("rejects empty strings", () => {
      expect(() => emailOrUsernameSchema.parse("")).toThrow();
    });

    it("accepts valid email addresses", () => {
      expect(emailOrUsernameSchema.parse("user@example.com")).toBe("user@example.com");
    });

    it("accepts simple usernames", () => {
      expect(emailOrUsernameSchema.parse("admin")).toBe("admin");
    });

    it("rejects strings longer than 320 characters", () => {
      expect(() => emailOrUsernameSchema.parse("a".repeat(321))).toThrow();
    });

    it("accepts maximum length string (320 chars)", () => {
      expect(emailOrUsernameSchema.parse("a".repeat(320))).toBe("a".repeat(320));
    });
  });

  describe("Company name validation", () => {
    it("rejects empty company names", () => {
      expect(() => companyNameSchema.parse("")).toThrow();
    });

    it("rejects company names longer than 255 characters", () => {
      expect(() => companyNameSchema.parse("x".repeat(256))).toThrow();
    });

    it("trims whitespace from company names", () => {
      expect(companyNameSchema.parse("  Acme Corp  ")).toBe("Acme Corp");
    });

    it("accepts valid company names", () => {
      expect(companyNameSchema.parse("Gravitee")).toBe("Gravitee");
    });
  });

  describe("Description validation", () => {
    it("accepts undefined (optional field)", () => {
      expect(descriptionSchema.parse(undefined)).toBeUndefined();
    });

    it("accepts empty strings", () => {
      expect(descriptionSchema.parse("")).toBe("");
    });

    it("rejects descriptions longer than 5000 characters", () => {
      expect(() => descriptionSchema.parse("x".repeat(5001))).toThrow();
    });

    it("accepts descriptions up to 5000 characters", () => {
      expect(descriptionSchema.parse("x".repeat(5000))).toBe("x".repeat(5000));
    });
  });

  describe("SQL injection attempts in input fields", () => {
    it("treats SQL injection strings as plain text in email field", () => {
      const sqlInjection = "admin'; DROP TABLE users; --";
      const result = emailOrUsernameSchema.parse(sqlInjection);
      expect(result).toBe(sqlInjection);
    });

    it("treats SQL injection strings as plain text in company name", () => {
      const sqlInjection = "Company'; DELETE FROM companies; --";
      const result = companyNameSchema.parse(sqlInjection);
      expect(result).toBe(sqlInjection.trim());
    });

    it("handles UNION SELECT injection in username", () => {
      const injection = "admin' UNION SELECT * FROM users --";
      const result = emailOrUsernameSchema.parse(injection);
      expect(result).toBe(injection);
    });

    it("handles OR 1=1 injection in username", () => {
      const injection = "' OR '1'='1";
      const result = emailOrUsernameSchema.parse(injection);
      expect(result).toBe(injection);
    });
  });
});
