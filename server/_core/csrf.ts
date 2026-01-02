import type { Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "crypto";

const CSRF_TOKEN_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";

/**
 * Generate a secure random CSRF token
 */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token for comparison (prevents timing attacks)
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * CSRF Protection Middleware
 * 
 * Implements Double Submit Cookie pattern:
 * 1. Generates a CSRF token and stores it in a cookie
 * 2. Requires the same token in the request header for state-changing operations
 * 3. Validates token on POST, PUT, PATCH, DELETE requests
 * 
 * Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF protection.
 * 
 * Note: This works in conjunction with sameSite cookies for defense in depth.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for OAuth callbacks (they use state parameter for CSRF protection)
  if (req.path.startsWith("/api/oauth/")) {
    return next();
  }
  
  // Get or create CSRF token (always set cookie so client can read it)
  let csrfToken = req.cookies[CSRF_TOKEN_COOKIE];
  
  if (!csrfToken) {
    // Generate new token
    csrfToken = generateToken();
  }
  
  // Always set/refresh the cookie (so client can read it)
  const cookieOptions = {
    httpOnly: false, // Must be accessible to JavaScript for header submission
    secure: req.protocol === "https" || req.get("x-forwarded-proto") === "https",
    sameSite: req.protocol === "https" ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (matches session duration)
  };
  res.cookie(CSRF_TOKEN_COOKIE, csrfToken, cookieOptions);
  
  // Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  
  // For state-changing operations, validate the token
  const submittedToken = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];
  
  if (!submittedToken || typeof submittedToken !== "string") {
    return res.status(403).json({
      error: "CSRF token missing",
      message: "CSRF token is required for this request",
    });
  }
  
  // Use constant-time comparison to prevent timing attacks
  const submittedHash = hashToken(submittedToken);
  const cookieHash = hashToken(csrfToken);
  
  if (submittedHash.length !== cookieHash.length) {
    return res.status(403).json({
      error: "CSRF token invalid",
      message: "CSRF token validation failed",
    });
  }
  
  // Constant-time comparison
  let isValid = true;
  for (let i = 0; i < submittedHash.length; i++) {
    if (submittedHash[i] !== cookieHash[i]) {
      isValid = false;
    }
  }
  
  if (!isValid) {
    return res.status(403).json({
      error: "CSRF token invalid",
      message: "CSRF token validation failed",
    });
  }
  
  next();
}

/**
 * Get CSRF token for client-side use
 * This should be called after csrfProtection middleware to ensure token exists
 */
export function getCsrfToken(req: Request): string | undefined {
  return req.cookies[CSRF_TOKEN_COOKIE];
}

