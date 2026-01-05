export const hubspotConfig = {
  apiKey: process.env.HUBSPOT_API_KEY || '',
  baseUrl: 'https://api.hubapi.com',
  rateLimit: {
    requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '90'), // 90% of 100 for Free tier
    windowMs: 10000, // 10 seconds
  },
};

export const syncConfig = {
  intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15'),
  bufferMinutes: parseInt(process.env.SYNC_BUFFER_MINUTES || '5'),
  batchSize: 100,
};
