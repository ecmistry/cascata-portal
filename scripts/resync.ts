import 'dotenv/config';
import { syncFromHubSpot } from '../server/hubspotSync';

async function main() {
  const stats = await syncFromHubSpot(1, { fullSync: false });
  console.log('Contacts fetched:', stats.contactsFetched);
  console.log('Deals fetched:', stats.dealsFetched);
  console.log('Actuals upserted:', stats.actualsUpserted);
  console.log('Duration:', stats.durationMs, 'ms');
  console.log('Errors:', stats.errors.length > 0 ? stats.errors.join('\n') : 'none');
  process.exit(0);
}

main();
