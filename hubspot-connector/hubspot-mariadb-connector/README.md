# HubSpot to MariaDB Connector

A lightweight, intelligent connector that syncs HubSpot data (contacts, deals, and deal stages) to MariaDB with automatic incremental updates.

## Features

- **Intelligent Incremental Sync**: Only syncs records modified since the last sync, with a configurable buffer period
- **Automatic Scheduling**: Runs syncs every 15 minutes (configurable) with staggered execution to avoid rate limits
- **Full Initial Sync**: Performs a complete data sync on first run, then switches to incremental updates
- **Rate Limit Management**: Built-in rate limiting to respect HubSpot API limits
- **Error Handling**: Robust retry logic with exponential backoff
- **Sync State Tracking**: Maintains sync history and status for each object type
- **Flexible Configuration**: Environment-based configuration for easy deployment

## Architecture

### Synced Objects

1. **Contacts**: Email, name, phone, company, lifecycle stage, job title, and all custom properties
2. **Deals**: Deal name, stage, pipeline, amount, close date, owner, and all custom properties
3. **Deal Pipelines & Stages**: Pipeline definitions and stage configurations

### Database Schema

The connector creates the following tables in your MariaDB database:

- `sync_state`: Tracks sync status and timestamps
- `hubspot_contacts`: Stores contact records
- `hubspot_deals`: Stores deal records
- `hubspot_deal_pipelines`: Stores pipeline definitions
- `hubspot_deal_stages`: Stores pipeline stage definitions

### Sync Strategy

**Initial Sync (First Run)**:
- Fetches all records from HubSpot using pagination
- Inserts all records into MariaDB
- Records the sync timestamp

**Incremental Sync (Subsequent Runs)**:
- Queries HubSpot for records modified since last sync (with 5-minute buffer)
- Uses HubSpot Search API with `hs_lastmodifieddate` filter
- Upserts modified records (INSERT ON DUPLICATE KEY UPDATE)
- Updates sync timestamp

**Staggered Execution**:
- Contacts sync: Every 15 minutes at minute 0
- Deals sync: Every 15 minutes at minute 5
- Pipelines sync: Every 15 minutes at minute 10

This prevents hitting rate limits by spacing out API calls.

## Prerequisites

- Node.js 18.x or higher
- MariaDB 10.11+ or MySQL 5.7+
- HubSpot account with API access
- HubSpot Private App or API key with the following scopes:
  - `crm.objects.contacts.read`
  - `crm.objects.deals.read`
  - `crm.schemas.deals.read`

## Installation

1. **Extract the connector**:
   ```bash
   # Extract the downloaded archive
   unzip hubspot-mariadb-connector.zip
   cd hubspot-mariadb-connector
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your configuration:
   ```env
   # HubSpot Configuration
   HUBSPOT_API_KEY=your_hubspot_api_key_here

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=cascade_portal

   # Sync Configuration
   SYNC_INTERVAL_MINUTES=15
   SYNC_BUFFER_MINUTES=5
   RATE_LIMIT_REQUESTS=90

   # Logging
   LOG_LEVEL=info
   ```

4. **Create database tables**:
   ```bash
   npm run db:push
   ```

   This will create all necessary tables in your MariaDB database.

## Usage

### Running the Connector

**Continuous Mode (Recommended for Production)**:
```bash
npm start
```

This will:
1. Run an initial sync of all data
2. Start the scheduler to run syncs every 15 minutes
3. Continue running until stopped (Ctrl+C)

**One-Time Sync**:
```bash
npm run start:once
```

This will run a single sync and exit. Useful for testing or manual syncs.

**Development Mode** (with auto-reload):
```bash
npm run dev
```

### Process Management (Production)

For production deployments, use a process manager like PM2:

1. **Install PM2**:
   ```bash
   npm install -g pm2
   ```

2. **Start the connector**:
   ```bash
   pm2 start npm --name "hubspot-connector" -- start
   ```

3. **Configure PM2 to start on boot**:
   ```bash
   pm2 startup
   pm2 save
   ```

4. **Monitor the connector**:
   ```bash
   pm2 logs hubspot-connector
   pm2 status
   ```

5. **Stop the connector**:
   ```bash
   pm2 stop hubspot-connector
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HUBSPOT_API_KEY` | *required* | Your HubSpot API key or Private App token |
| `DB_HOST` | `localhost` | MariaDB host address |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_USER` | *required* | Database user |
| `DB_PASSWORD` | *required* | Database password |
| `DB_NAME` | `cascade_portal` | Database name |
| `SYNC_INTERVAL_MINUTES` | `15` | How often to run syncs (in minutes) |
| `SYNC_BUFFER_MINUTES` | `5` | Buffer time to catch missed updates (in minutes) |
| `RATE_LIMIT_REQUESTS` | `90` | Max API requests per 10-second window (90% of limit) |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

### HubSpot API Rate Limits

The connector respects HubSpot's rate limits:

| Tier | Burst Limit | Daily Limit |
|------|-------------|-------------|
| Free & Starter | 100 requests/10s | 250,000/day |
| Professional & Enterprise | 150 requests/10s | 500,000/day |
| API Add-on | 200 requests/10s | 1,000,000/day |

Set `RATE_LIMIT_REQUESTS` to 90% of your tier's burst limit for safety.

## Database Schema Details

### sync_state Table

Tracks sync status for each object type:

```sql
CREATE TABLE sync_state (
  id INT PRIMARY KEY AUTO_INCREMENT,
  object_type VARCHAR(50) UNIQUE NOT NULL,
  last_sync_timestamp BIGINT,
  last_sync_date DATETIME,
  status VARCHAR(20) DEFAULT 'success',
  records_synced INT DEFAULT 0,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

### hubspot_contacts Table

Stores contact records with common properties and a JSON field for all properties:

```sql
CREATE TABLE hubspot_contacts (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255),
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  website VARCHAR(255),
  lifecyclestage VARCHAR(100),
  jobtitle VARCHAR(255),
  createdate DATETIME,
  lastmodifieddate DATETIME,
  hs_lastmodifieddate BIGINT,
  properties_json JSON,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX email_idx (email),
  INDEX lastmodified_idx (lastmodifieddate),
  INDEX hs_lastmodified_idx (hs_lastmodifieddate)
);
```

### hubspot_deals Table

Stores deal records:

```sql
CREATE TABLE hubspot_deals (
  id VARCHAR(50) PRIMARY KEY,
  dealname VARCHAR(255),
  dealstage VARCHAR(100),
  pipeline VARCHAR(100),
  amount DECIMAL(15,2),
  closedate DATETIME,
  createdate DATETIME,
  lastmodifieddate DATETIME,
  hs_lastmodifieddate BIGINT,
  hubspot_owner_id VARCHAR(50),
  dealtype VARCHAR(100),
  properties_json JSON,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX dealstage_idx (dealstage),
  INDEX pipeline_idx (pipeline),
  INDEX lastmodified_idx (lastmodifieddate),
  INDEX hs_lastmodified_idx (hs_lastmodifieddate)
);
```

### hubspot_deal_pipelines & hubspot_deal_stages Tables

Store pipeline and stage definitions for reference.

## Troubleshooting

### Connection Issues

**Database connection failed**:
- Verify database credentials in `.env`
- Check that MariaDB is running
- Ensure database user has proper permissions
- Test connection: `mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME`

**HubSpot API authentication failed**:
- Verify `HUBSPOT_API_KEY` is correct
- Check that your Private App or API key has required scopes
- Test API key: `curl -H "Authorization: Bearer YOUR_API_KEY" https://api.hubapi.com/crm/v3/objects/contacts?limit=1`

### Sync Issues

**No records syncing**:
- Check logs for errors: `pm2 logs hubspot-connector`
- Verify HubSpot has data in the objects you're syncing
- Check sync_state table for error messages: `SELECT * FROM sync_state;`

**Rate limit errors**:
- Reduce `RATE_LIMIT_REQUESTS` in `.env`
- Increase `SYNC_INTERVAL_MINUTES` to reduce frequency
- Check your HubSpot tier's rate limits

**Slow initial sync**:
- Initial sync fetches all records, which can take time for large datasets
- Monitor progress in logs
- Consider running initial sync during off-hours

### Performance Optimization

**Large datasets**:
- Ensure database indexes are created (automatically done by `db:push`)
- Consider increasing MariaDB connection pool size
- Monitor database performance during sync

**Memory issues**:
- The connector processes records in batches of 100
- If memory is still an issue, reduce batch size in `src/config/hubspot.ts`

## Monitoring

### Log Levels

Set `LOG_LEVEL` in `.env`:
- `debug`: Detailed information for debugging
- `info`: General information about sync progress (recommended)
- `warn`: Warning messages and rate limit notifications
- `error`: Error messages only

### Checking Sync Status

Query the sync_state table:

```sql
SELECT 
  object_type,
  last_sync_date,
  status,
  records_synced,
  error_message
FROM sync_state
ORDER BY last_sync_date DESC;
```

### Monitoring Synced Data

Check record counts:

```sql
SELECT 'contacts' as type, COUNT(*) as count FROM hubspot_contacts
UNION ALL
SELECT 'deals', COUNT(*) FROM hubspot_deals
UNION ALL
SELECT 'pipelines', COUNT(*) FROM hubspot_deal_pipelines
UNION ALL
SELECT 'stages', COUNT(*) FROM hubspot_deal_stages;
```

Check recently synced records:

```sql
SELECT id, email, firstname, lastname, synced_at
FROM hubspot_contacts
ORDER BY synced_at DESC
LIMIT 10;
```

## Security Considerations

1. **API Key Protection**:
   - Never commit `.env` file to version control
   - Use environment variables or secrets manager in production
   - Rotate API keys regularly

2. **Database Security**:
   - Use least-privilege database user
   - Enable SSL/TLS for database connections
   - Restrict database access to connector host only

3. **Data Privacy**:
   - Contact data may contain PII (email, phone)
   - Ensure compliance with GDPR, CCPA, and other regulations
   - Implement data retention policies

## Upgrading

To upgrade the connector:

1. **Backup your database**:
   ```bash
   mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup.sql
   ```

2. **Stop the connector**:
   ```bash
   pm2 stop hubspot-connector
   ```

3. **Update the code**:
   ```bash
   # Extract new version
   unzip hubspot-mariadb-connector-v2.zip -d hubspot-mariadb-connector-new
   
   # Copy your .env file
   cp hubspot-mariadb-connector/.env hubspot-mariadb-connector-new/
   
   # Install dependencies
   cd hubspot-mariadb-connector-new
   npm install
   ```

4. **Run migrations** (if any):
   ```bash
   npm run db:push
   ```

5. **Restart the connector**:
   ```bash
   pm2 restart hubspot-connector
   ```

## Support

For issues or questions:

1. Check the logs for error messages
2. Review this README and troubleshooting section
3. Verify your HubSpot API key and database credentials
4. Check HubSpot API status: https://status.hubspot.com/

## License

MIT License - See LICENSE file for details

## Changelog

### Version 1.0.0 (Initial Release)
- Initial release with contacts, deals, and pipelines sync
- Intelligent incremental sync with buffer
- Rate limit management
- Staggered execution to avoid API limits
- Comprehensive error handling and logging
