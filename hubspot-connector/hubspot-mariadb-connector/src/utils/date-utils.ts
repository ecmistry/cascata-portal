/**
 * Convert milliseconds timestamp to Date object
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp);
}

/**
 * Convert Date object to milliseconds timestamp
 */
export function dateToTimestamp(date: Date): number {
  return date.getTime();
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Subtract minutes from a timestamp
 */
export function subtractMinutes(timestamp: number, minutes: number): number {
  return timestamp - (minutes * 60 * 1000);
}

/**
 * Format date to ISO string for HubSpot API
 */
export function formatForHubSpot(date: Date): string {
  return date.toISOString();
}

/**
 * Parse HubSpot date string to Date object
 */
export function parseHubSpotDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}
