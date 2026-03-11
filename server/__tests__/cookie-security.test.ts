import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "../_core/cookies";

function createMockReq(options: {
  protocol?: string;
  forwardedProto?: string;
} = {}): Request {
  const headers: Record<string, string> = {};
  if (options.forwardedProto) {
    headers["x-forwarded-proto"] = options.forwardedProto;
  }

  return {
    protocol: options.protocol ?? "http",
    hostname: "cascata.online",
    headers,
  } as unknown as Request;
}

describe("Cookie Security", () => {
  describe("HTTPS requests", () => {
    it("sets secure flag for HTTPS requests", () => {
      const req = createMockReq({ protocol: "https" });
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(true);
    });

    it("sets sameSite=none for HTTPS (cross-site support)", () => {
      const req = createMockReq({ protocol: "https" });
      const opts = getSessionCookieOptions(req);
      expect(opts.sameSite).toBe("none");
    });

    it("sets secure flag when x-forwarded-proto is https", () => {
      const req = createMockReq({ protocol: "http", forwardedProto: "https" });
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(true);
    });
  });

  describe("HTTP requests (development)", () => {
    it("does not set secure flag for plain HTTP", () => {
      const req = createMockReq({ protocol: "http" });
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(false);
    });

    it("sets sameSite=lax for HTTP", () => {
      const req = createMockReq({ protocol: "http" });
      const opts = getSessionCookieOptions(req);
      expect(opts.sameSite).toBe("lax");
    });
  });

  describe("Universal cookie properties", () => {
    it("always sets httpOnly to prevent XSS access", () => {
      const httpReq = createMockReq({ protocol: "http" });
      const httpsReq = createMockReq({ protocol: "https" });
      expect(getSessionCookieOptions(httpReq).httpOnly).toBe(true);
      expect(getSessionCookieOptions(httpsReq).httpOnly).toBe(true);
    });

    it("always sets path to /", () => {
      const req = createMockReq({ protocol: "https" });
      expect(getSessionCookieOptions(req).path).toBe("/");
    });
  });

  describe("X-Forwarded-Proto handling", () => {
    it("handles comma-separated forwarded proto list", () => {
      const req = createMockReq({ protocol: "http", forwardedProto: "https, http" });
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(true);
    });

    it("does not mark as secure when forwarded proto is http", () => {
      const req = createMockReq({ protocol: "http", forwardedProto: "http" });
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(false);
    });
  });
});
