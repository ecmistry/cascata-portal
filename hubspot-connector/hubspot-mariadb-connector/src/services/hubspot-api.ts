import { hubspotConfig } from '../config/hubspot.js';
import { logger } from '../utils/logger.js';

interface RateLimitTracker {
  requests: number[];
  windowMs: number;
}

const rateLimitTracker: RateLimitTracker = {
  requests: [],
  windowMs: hubspotConfig.rateLimit.windowMs,
};

/**
 * Check and enforce rate limiting
 */
function checkRateLimit(): void {
  const now = Date.now();
  const windowStart = now - rateLimitTracker.windowMs;
  
  // Remove requests outside the current window
  rateLimitTracker.requests = rateLimitTracker.requests.filter(
    (timestamp) => timestamp > windowStart
  );
  
  // Check if we're at the limit
  if (rateLimitTracker.requests.length >= hubspotConfig.rateLimit.requestsPerWindow) {
    const oldestRequest = rateLimitTracker.requests[0];
    const waitTime = oldestRequest + rateLimitTracker.windowMs - now;
    
    if (waitTime > 0) {
      logger.warn(`Rate limit approaching, waiting ${waitTime}ms`);
      // In a real implementation, you might want to use a proper delay mechanism
      // For now, we'll just log the warning
    }
  }
  
  rateLimitTracker.requests.push(now);
}

/**
 * Make a request to HubSpot API with retry logic
 */
async function makeRequest<T>(
  url: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  checkRateLimit();
  
  const headers = {
    'Authorization': `Bearer ${hubspotConfig.apiKey}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HubSpot API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      logger.warn(`Request failed (attempt ${attempt + 1}/${retries})`, { url, error });
      
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Search for objects using HubSpot Search API
 */
export async function searchObjects<T>(
  objectType: string,
  filters: any[],
  properties: string[],
  after?: number
): Promise<{ results: T[]; paging?: { next?: { after: string } } }> {
  const url = `${hubspotConfig.baseUrl}/crm/v3/objects/${objectType}/search`;
  
  // Use limit of 50 to be safe (same as getAllObjects)
  const safeLimit = 50;
  
  const body = {
    filterGroups: filters.length > 0 ? [{ filters }] : undefined,
    properties,
    sorts: [
      {
        propertyName: 'hs_lastmodifieddate',
        direction: 'ASCENDING',
      },
    ],
    limit: safeLimit,
    after: after?.toString(),
  };
  
  logger.debug(`Searching ${objectType}`, { filters, after, limit: safeLimit });
  
  return makeRequest<{ results: T[]; paging?: { next?: { after: string } } }>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get all objects with pagination
 * Note: HubSpot API returns all properties by default, but we can specify properties to ensure we get them
 */
export async function getAllObjects<T>(
  objectType: string,
  properties: string[],
  limit = 100
): Promise<T[]> {
  const allResults: T[] = [];
  let after: string | undefined;
  
  // HubSpot API limit is 100, but we'll use 50 to be safe and avoid history-related errors
  const safeLimit = Math.min(limit, 50);
  
  do {
    const url = new URL(`${hubspotConfig.baseUrl}/crm/v3/objects/${objectType}`);
    url.searchParams.set('limit', safeLimit.toString());
    // Request specific properties - HubSpot will return all properties by default
    url.searchParams.set('properties', properties.join(','));
    // Don't request properties with history to avoid limit restrictions
    
    if (after) {
      url.searchParams.set('after', after);
    }
    
    logger.debug(`Fetching ${objectType}`, { after, limit: safeLimit });
    
    const response = await makeRequest<{
      results: T[];
      paging?: { next?: { after: string } };
    }>(url.toString());
    
    allResults.push(...response.results);
    after = response.paging?.next?.after;
    
    logger.info(`Fetched ${response.results.length} ${objectType}, total: ${allResults.length}`);
  } while (after);
  
  return allResults;
}

/**
 * Get all pipelines for an object type
 */
export async function getPipelines(objectType: string): Promise<any[]> {
  const url = `${hubspotConfig.baseUrl}/crm/v3/pipelines/${objectType}`;
  
  logger.debug(`Fetching pipelines for ${objectType}`);
  
  const response = await makeRequest<{ results: any[] }>(url);
  return response.results;
}

/**
 * Get all available properties for an object type
 * This fetches all properties (including custom properties) from HubSpot
 * Handles pagination if needed
 */
export async function getAllProperties(objectType: string): Promise<string[]> {
  const url = `${hubspotConfig.baseUrl}/crm/v3/properties/${objectType}`;
  
  logger.debug(`Fetching all properties for ${objectType}`);
  
  try {
    const allProperties: string[] = [];
    let after: string | undefined;
    
    do {
      const requestUrl = after ? `${url}?after=${after}` : url;
      const response = await makeRequest<{ 
        results: Array<{ name: string }>;
        paging?: { next?: { after: string } };
      }>(requestUrl);
      
      const propertyNames = response.results.map(prop => prop.name);
      allProperties.push(...propertyNames);
      
      after = response.paging?.next?.after;
      
      logger.debug(`Fetched ${propertyNames.length} properties for ${objectType}, total: ${allProperties.length}`);
    } while (after);
    
    logger.info(`Found ${allProperties.length} total properties for ${objectType}`);
    return allProperties;
  } catch (error) {
    logger.warn(`Failed to fetch all properties for ${objectType}, using default properties`, error);
    // Return empty array to fall back to default properties
    return [];
  }
}

/**
 * Get recently modified objects using Search API
 */
export async function getRecentlyModifiedObjects<T>(
  objectType: string,
  properties: string[],
  sinceTimestamp: number
): Promise<T[]> {
  const allResults: T[] = [];
  let after: number | undefined;
  
  do {
    const filters = [
      {
        propertyName: 'hs_lastmodifieddate',
        operator: 'GTE',
        value: sinceTimestamp.toString(),
      },
    ];
    
    const response = await searchObjects<T>(objectType, filters, properties, after);
    
    allResults.push(...response.results);
    after = response.paging?.next?.after ? parseInt(response.paging.next.after) : undefined;
    
    logger.info(`Fetched ${response.results.length} modified ${objectType}, total: ${allResults.length}`);
  } while (after);
  
  return allResults;
}
