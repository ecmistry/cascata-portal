/**
 * CSRF Token Utility
 * 
 * Helper functions to get and manage CSRF tokens from cookies.
 * The CSRF token is stored in a cookie by the server and must be
 * included in the X-CSRF-Token header for state-changing requests.
 */

/**
 * Get CSRF token from cookies
 * @returns CSRF token or undefined if not found
 */
export function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  
  // Parse cookies manually (simple implementation)
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf-token") {
      return decodeURIComponent(value);
    }
  }
  
  return undefined;
}

/**
 * Check if CSRF token exists in cookies
 * @returns true if CSRF token is present
 */
export function hasCsrfToken(): boolean {
  return getCsrfToken() !== undefined;
}

