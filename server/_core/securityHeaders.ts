import type { Request, Response, NextFunction } from "express";

/**
 * Security Headers Middleware
 * 
 * Adds security headers to all responses to protect against common attacks:
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-XSS-Protection: Legacy XSS protection (for older browsers)
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 * - Content-Security-Policy: Controls resource loading (basic policy)
 * 
 * Note: CSP can be customized per route if needed for more complex requirements
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking - don't allow embedding in frames
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing - browser must respect Content-Type
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Legacy XSS protection (for older browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy - restrict browser features
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  
  // Content Security Policy
  // Basic policy that allows same-origin resources and inline styles/scripts for Vite
  // Can be customized per route if needed
  const isDevelopment = process.env.NODE_ENV === "development";
  
  if (isDevelopment) {
    // More permissive CSP for development (Vite HMR needs eval)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws: wss:; " +
      "frame-ancestors 'none';"
    );
  } else {
    // Stricter CSP for production
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none';"
    );
  }
  
  next();
}

