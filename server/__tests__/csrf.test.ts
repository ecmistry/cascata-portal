import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { csrfProtection } from "../_core/csrf";

function createMockReqRes(options: {
  method?: string;
  path?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const setCookies: Array<{ name: string; value: string; options: object }> = [];
  const req = {
    method: options.method ?? "GET",
    path: options.path ?? "/api/trpc/test",
    cookies: options.cookies ?? {},
    headers: options.headers ?? {},
    protocol: "https",
    get: vi.fn((header: string) => {
      if (header === "x-forwarded-proto") return "https";
      return undefined;
    }),
  } as unknown as Request;

  const res = {
    cookie: vi.fn((name: string, value: string, opts: object) => {
      setCookies.push({ name, value, options: opts });
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next, setCookies };
}

describe("CSRF Protection", () => {
  describe("Safe methods (GET, HEAD, OPTIONS)", () => {
    it("allows GET requests without CSRF token", () => {
      const { req, res, next } = createMockReqRes({ method: "GET" });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("allows HEAD requests without CSRF token", () => {
      const { req, res, next } = createMockReqRes({ method: "HEAD" });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("allows OPTIONS requests without CSRF token", () => {
      const { req, res, next } = createMockReqRes({ method: "OPTIONS" });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("State-changing methods (POST, PUT, PATCH, DELETE)", () => {
    it("rejects POST without CSRF token with 403", () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "CSRF token missing" })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects PUT without CSRF token with 403", () => {
      const { req, res, next } = createMockReqRes({ method: "PUT" });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects DELETE without CSRF token with 403", () => {
      const { req, res, next } = createMockReqRes({ method: "DELETE" });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects PATCH without CSRF token with 403", () => {
      const { req, res, next } = createMockReqRes({ method: "PATCH" });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows POST with valid matching CSRF token", () => {
      const token = "a".repeat(64);
      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { "csrf-token": token },
        headers: { "x-csrf-token": token },
      });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects POST with mismatched CSRF token", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { "csrf-token": "valid-token-abc123" },
        headers: { "x-csrf-token": "wrong-token-xyz789" },
      });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "CSRF token invalid" })
      );
    });

    it("rejects POST with empty CSRF header", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { "csrf-token": "valid-token" },
        headers: { "x-csrf-token": "" },
      });
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("OAuth callback exemption", () => {
    it("skips CSRF for OAuth callback paths", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        path: "/api/oauth/callback",
      });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Token generation", () => {
    it("generates a CSRF token cookie on first GET request", () => {
      const { req, res, next, setCookies } = createMockReqRes({ method: "GET" });
      csrfProtection(req, res, next);
      expect(setCookies.length).toBe(1);
      expect(setCookies[0].name).toBe("csrf-token");
      expect(setCookies[0].value).toBeTruthy();
      expect(setCookies[0].value.length).toBe(64); // 32 bytes hex = 64 chars
    });

    it("CSRF cookie is not httpOnly (client must read it)", () => {
      const { req, res, next, setCookies } = createMockReqRes({ method: "GET" });
      csrfProtection(req, res, next);
      expect((setCookies[0].options as any).httpOnly).toBe(false);
    });
  });
});
