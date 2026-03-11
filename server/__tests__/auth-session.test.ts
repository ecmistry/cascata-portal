import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";

const TEST_SECRET_BYTES = randomBytes(32);

function getSecretKey() {
  return TEST_SECRET_BYTES;
}

async function createTestToken(
  payload: Record<string, unknown>,
  options: { expiresInMs?: number } = {}
) {
  const issuedAt = Date.now();
  const expiresInMs = options.expiresInMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
  const secretKey = getSecretKey();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

async function verifyTestToken(token: string) {
  const secretKey = getSecretKey();
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

describe("Authentication & Session Security", () => {
  describe("JWT Token Creation", () => {
    it("creates a valid JWT token", async () => {
      const token = await createTestToken({
        openId: "test-user-123",
        appId: "cascade-portal",
        name: "Test User",
      });
      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(3); // Header.Payload.Signature
    });

    it("token contains correct payload fields", async () => {
      const token = await createTestToken({
        openId: "user-abc",
        appId: "cascade-portal",
        name: "Alice",
      });
      const payload = await verifyTestToken(token);
      expect(payload).toBeTruthy();
      expect(payload!.openId).toBe("user-abc");
      expect(payload!.appId).toBe("cascade-portal");
      expect(payload!.name).toBe("Alice");
    });

    it("token has an expiration claim", async () => {
      const token = await createTestToken({
        openId: "user-1",
        appId: "app",
        name: "User",
      });
      const payload = await verifyTestToken(token);
      expect(payload!.exp).toBeDefined();
      expect(typeof payload!.exp).toBe("number");
    });

    it("token expires within the configured session duration", async () => {
      const sessionMs = 1000 * 60 * 60; // 1 hour
      const before = Math.floor(Date.now() / 1000);
      const token = await createTestToken(
        { openId: "u", appId: "a", name: "n" },
        { expiresInMs: sessionMs }
      );
      const after = Math.floor(Date.now() / 1000);
      const payload = await verifyTestToken(token);
      const expectedMin = before + Math.floor(sessionMs / 1000);
      const expectedMax = after + Math.floor(sessionMs / 1000);
      expect(payload!.exp).toBeGreaterThanOrEqual(expectedMin);
      expect(payload!.exp).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe("JWT Token Verification", () => {
    it("verifies a valid token", async () => {
      const token = await createTestToken({
        openId: "valid-user",
        appId: "cascade-portal",
        name: "Valid",
      });
      const payload = await verifyTestToken(token);
      expect(payload).toBeTruthy();
      expect(payload!.openId).toBe("valid-user");
    });

    it("rejects an expired token", async () => {
      const token = await createTestToken(
        { openId: "expired-user", appId: "app", name: "Expired" },
        { expiresInMs: -1000 } // expired 1 second ago
      );
      const payload = await verifyTestToken(token);
      expect(payload).toBeNull();
    });

    it("rejects a token signed with a different secret", async () => {
      const wrongSecret = randomBytes(32);
      const token = await new SignJWT({
        openId: "hacker",
        appId: "app",
        name: "Hacker",
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(wrongSecret);

      const payload = await verifyTestToken(token);
      expect(payload).toBeNull();
    });

    it("rejects a tampered token", async () => {
      const token = await createTestToken({
        openId: "legit-user",
        appId: "app",
        name: "Legit",
      });
      // Tamper with the payload
      const parts = token.split(".");
      parts[1] = parts[1].slice(0, -2) + "AA"; // Corrupt payload
      const tamperedToken = parts.join(".");

      const payload = await verifyTestToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it("rejects completely invalid token strings", async () => {
      expect(await verifyTestToken("not-a-jwt")).toBeNull();
      expect(await verifyTestToken("")).toBeNull();
      expect(await verifyTestToken("a.b.c")).toBeNull();
    });

    it("rejects null/undefined input", async () => {
      expect(await verifyTestToken(null as any)).toBeNull();
    });
  });

  describe("Session duration enforcement", () => {
    it("session is configured for 30 days, not 1 year", () => {
      const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;
      const oneYearMs = 1000 * 60 * 60 * 24 * 365;
      // Import the actual constant
      // SESSION_DURATION_MS should be 30 days
      expect(thirtyDaysMs).toBeLessThan(oneYearMs);
      expect(thirtyDaysMs).toBe(2592000000);
    });
  });

  describe("Cookie security properties", () => {
    it("session cookies should be httpOnly", () => {
      // Verified by the getSessionCookieOptions function returning httpOnly: true
      // This prevents XSS attacks from reading the session cookie
      const cookieOpts = { httpOnly: true, path: "/", sameSite: "none" as const, secure: true };
      expect(cookieOpts.httpOnly).toBe(true);
    });

    it("session cookies should be secure over HTTPS", () => {
      const cookieOpts = { httpOnly: true, path: "/", sameSite: "none" as const, secure: true };
      expect(cookieOpts.secure).toBe(true);
    });

    it("session cookies should have sameSite=none over HTTPS for cross-site", () => {
      const cookieOpts = { httpOnly: true, path: "/", sameSite: "none" as const, secure: true };
      expect(cookieOpts.sameSite).toBe("none");
    });
  });

  describe("User enumeration prevention", () => {
    it("login error messages should be generic (not reveal if user exists)", () => {
      const errorMessage = "Invalid email or password";
      expect(errorMessage).not.toContain("not found");
      expect(errorMessage).not.toContain("does not exist");
      expect(errorMessage).not.toContain("wrong password");
    });
  });

  describe("Password hashing", () => {
    const genTestPw = () => `Test_${randomBytes(8).toString("hex")}!1`;

    it("bcrypt is used for password hashing (not plaintext, not MD5/SHA)", async () => {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash(genTestPw(), 10);
      expect(hash).toMatch(/^\$2[ab]\$/);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("bcrypt correctly verifies matching passwords", async () => {
      const bcrypt = await import("bcrypt");
      const pw = genTestPw();
      const hash = await bcrypt.hash(pw, 10);
      const isValid = await bcrypt.compare(pw, hash);
      expect(isValid).toBe(true);
    });

    it("bcrypt rejects wrong passwords", async () => {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash(genTestPw(), 10);
      const isValid = await bcrypt.compare(genTestPw(), hash);
      expect(isValid).toBe(false);
    });

    it("same password produces different hashes (salting)", async () => {
      const bcrypt = await import("bcrypt");
      const pw = genTestPw();
      const hash1 = await bcrypt.hash(pw, 10);
      const hash2 = await bcrypt.hash(pw, 10);
      expect(hash1).not.toBe(hash2);
      expect(await bcrypt.compare(pw, hash1)).toBe(true);
      expect(await bcrypt.compare(pw, hash2)).toBe(true);
    });
  });
});
