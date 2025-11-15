import type { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Simple in-memory rate limiter
 * Cleans up expired entries periodically
 */
function cleanupExpired() {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

/**
 * Rate limiter middleware for login endpoint
 * Limits: 5 requests per 15 minutes per IP
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `login:${ip}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const max = 5; // 5 attempts per window
  
  const now = Date.now();
  const entry = store[key];
  
  if (!entry || entry.resetTime < now) {
    // New or expired entry
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return next();
  }
  
  if (entry.count >= max) {
    return res.status(429).json({
      error: "Too many login attempts, please try again later.",
    });
  }
  
  entry.count++;
  next();
}

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `api:${ip}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const max = 100; // 100 requests per window
  
  const now = Date.now();
  const entry = store[key];
  
  if (!entry || entry.resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return next();
  }
  
  if (entry.count >= max) {
    return res.status(429).json({
      error: "Too many requests, please try again later.",
    });
  }
  
  entry.count++;
  next();
}
