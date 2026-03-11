import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { securityHeaders } from "../_core/securityHeaders";

function createMockReqRes(env: string = "production") {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;

  const headers: Record<string, string> = {};
  const req = {} as Request;
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;

  return { req, res, next, headers, cleanup: () => { process.env.NODE_ENV = originalEnv; } };
}

describe("Security Headers Middleware", () => {
  describe("Production mode", () => {
    it("sets X-Frame-Options to DENY to prevent clickjacking", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
      cleanup();
    });

    it("sets X-Content-Type-Options to nosniff", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      cleanup();
    });

    it("sets X-XSS-Protection for legacy browser support", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
      cleanup();
    });

    it("sets strict Referrer-Policy", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
      cleanup();
    });

    it("restricts all browser features via Permissions-Policy", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      const permCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Permissions-Policy"
      );
      expect(permCall).toBeDefined();
      const policy = permCall![1] as string;
      expect(policy).toContain("geolocation=()");
      expect(policy).toContain("microphone=()");
      expect(policy).toContain("camera=()");
      expect(policy).toContain("payment=()");
      cleanup();
    });

    it("sets Content-Security-Policy with strict directives in production", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Content-Security-Policy"
      );
      expect(cspCall).toBeDefined();
      const csp = cspCall![1] as string;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("'unsafe-eval'");
      cleanup();
    });

    it("allows Google Fonts in CSP style-src and font-src", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Content-Security-Policy"
      );
      const csp = cspCall![1] as string;
      expect(csp).toContain("https://fonts.googleapis.com");
      expect(csp).toContain("https://fonts.gstatic.com");
      cleanup();
    });

    it("does not allow unsafe-eval in production CSP", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Content-Security-Policy"
      );
      const csp = cspCall![1] as string;
      expect(csp).not.toContain("unsafe-eval");
      cleanup();
    });

    it("calls next() to continue the middleware chain", () => {
      const { req, res, next, cleanup } = createMockReqRes("production");
      securityHeaders(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      cleanup();
    });
  });

  describe("Development mode", () => {
    it("allows unsafe-eval in development for Vite HMR", () => {
      const { req, res, next, cleanup } = createMockReqRes("development");
      securityHeaders(req, res, next);
      const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Content-Security-Policy"
      );
      const csp = cspCall![1] as string;
      expect(csp).toContain("'unsafe-eval'");
      cleanup();
    });

    it("allows WebSocket connections in development", () => {
      const { req, res, next, cleanup } = createMockReqRes("development");
      securityHeaders(req, res, next);
      const cspCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: string[]) => c[0] === "Content-Security-Policy"
      );
      const csp = cspCall![1] as string;
      expect(csp).toContain("ws:");
      expect(csp).toContain("wss:");
      cleanup();
    });
  });
});
