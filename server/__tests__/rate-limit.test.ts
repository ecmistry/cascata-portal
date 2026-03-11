import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Must re-import fresh for each test to reset the in-memory store
let loginRateLimiter: typeof import("../_core/rateLimit").loginRateLimiter;
let apiRateLimiter: typeof import("../_core/rateLimit").apiRateLimiter;

function createMockReqRes(ip: string = "192.168.1.1") {
  const req = {
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe("Rate Limiting", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../_core/rateLimit");
    loginRateLimiter = mod.loginRateLimiter;
    apiRateLimiter = mod.apiRateLimiter;
  });

  describe("Login Rate Limiter", () => {
    it("allows first login attempt", () => {
      const { req, res, next } = createMockReqRes("10.0.0.1");
      loginRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("allows up to 5 login attempts", () => {
      for (let i = 0; i < 5; i++) {
        const { req, res, next } = createMockReqRes("10.0.0.2");
        loginRateLimiter(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it("blocks 6th login attempt with 429", () => {
      for (let i = 0; i < 5; i++) {
        const { req, res, next } = createMockReqRes("10.0.0.3");
        loginRateLimiter(req, res, next);
      }
      const { req, res, next } = createMockReqRes("10.0.0.3");
      loginRateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Too many login attempts") })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("rate limits per-IP, not globally", () => {
      for (let i = 0; i < 5; i++) {
        const { req, res, next } = createMockReqRes("10.0.0.4");
        loginRateLimiter(req, res, next);
      }
      // Different IP should still be allowed
      const { req, res, next } = createMockReqRes("10.0.0.5");
      loginRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("continues to block after the limit is reached", () => {
      for (let i = 0; i < 6; i++) {
        const { req, res, next } = createMockReqRes("10.0.0.6");
        loginRateLimiter(req, res, next);
      }
      // 7th attempt
      const { req, res, next } = createMockReqRes("10.0.0.6");
      loginRateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("API Rate Limiter", () => {
    it("allows up to 100 API requests", () => {
      for (let i = 0; i < 100; i++) {
        const { req, res, next } = createMockReqRes("10.0.1.1");
        apiRateLimiter(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it("blocks 101st API request with 429", () => {
      for (let i = 0; i < 100; i++) {
        const { req, res, next } = createMockReqRes("10.0.1.2");
        apiRateLimiter(req, res, next);
      }
      const { req, res, next } = createMockReqRes("10.0.1.2");
      apiRateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Too many requests") })
      );
    });

    it("handles missing IP gracefully", () => {
      const req = { ip: undefined, socket: { remoteAddress: undefined } } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
      const next = vi.fn() as NextFunction;
      apiRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
