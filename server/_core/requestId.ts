import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

/**
 * Request ID Header Name
 */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Request ID Middleware
 * 
 * Generates a unique request ID for each request and adds it to:
 * - Response headers (for client tracking)
 * - Request object (for server-side logging)
 * 
 * This enables:
 * - Request tracing across services
 * - Security auditing and incident investigation
 * - Debugging distributed systems
 * - Correlating logs with specific requests
 * 
 * The request ID is a 16-byte random hex string (32 characters).
 * Clients can include this in their requests via the X-Request-ID header,
 * which will be used if present, otherwise a new one is generated.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  // Check if client provided a request ID
  const clientRequestId = req.headers[REQUEST_ID_HEADER.toLowerCase()] || req.headers[REQUEST_ID_HEADER];
  
  // Use client-provided ID if valid, otherwise generate new one
  let requestId: string;
  
  if (clientRequestId && typeof clientRequestId === "string" && /^[a-f0-9]{32}$/i.test(clientRequestId)) {
    // Client provided valid request ID (32 hex characters)
    requestId = clientRequestId;
  } else {
    // Generate new request ID (16 bytes = 32 hex characters)
    requestId = randomBytes(16).toString("hex");
  }
  
  // Add to request object for server-side use
  (req as Request & { requestId: string }).requestId = requestId;
  
  // Add to response headers for client tracking
  res.setHeader(REQUEST_ID_HEADER, requestId);
  
  // Log request with ID in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[${requestId}] ${req.method} ${req.path}`);
  }
  
  next();
}

/**
 * Get request ID from request object
 */
export function getRequestId(req: Request): string | undefined {
  return (req as Request & { requestId?: string }).requestId;
}

