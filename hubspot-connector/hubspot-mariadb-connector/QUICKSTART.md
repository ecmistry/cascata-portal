# Quick Start Guide

Get up and running with the HubSpot to MariaDB Connector in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- MariaDB 10.11+ accessible
- HubSpot API key ready

## Installation

### 1. Extract and Install

```bash
cd /home/ubuntu
unzip hubspot-mariadb-connector.zip
cd hubspot-mariadb-connector
npm install
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

Set these required variables:

```env
HUBSPOT_API_KEY=your_api_key_here
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=cascade_portal
```

### 3. Create Database Tables

```bash
npm run db:push
```

### 4. Test

```bash
npm run start:once
```

You should see logs showing contacts, deals, and pipelines being synced.

### 5. Deploy

```bash
# Install PM2
sudo npm install -g pm2

# Start connector
pm2 start npm --name "hubspot-connector" -- start

# Configure auto-start on boot
pm2 startup
pm2 save
```

## Verify It's Working

### Check PM2 Status

```bash
pm2 status
```

Should show "online" status.

### Check Logs

```bash
pm2 logs hubspot-connector
```

Should show sync activity every 15 minutes.

### Check Database

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
SELECT 'contacts' as type, COUNT(*) as count FROM hubspot_contacts
UNION ALL
SELECT 'deals', COUNT(*) FROM hubspot_deals;
"
```

Should show record counts.

## Common Issues

### "Cannot connect to database"

- Verify credentials in `.env`
- Test: `mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME`

### "HubSpot API authentication failed"

- Verify `HUBSPOT_API_KEY` in `.env`
- Test: `curl -H "Authorization: Bearer YOUR_KEY" https://api.hubapi.com/crm/v3/objects/contacts?limit=1`

### "Module not found"

```bash
npm install
pm2 restart hubspot-connector
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Monitor logs: `pm2 logs hubspot-connector`
- Check sync status: `SELECT * FROM sync_state;`

## Need Help?

1. Check logs: `pm2 logs hubspot-connector --err`
2. Check sync_state table for errors
3. Review README.md troubleshooting section
4. Verify HubSpot API status: https://status.hubspot.com/

## Useful Commands

```bash
# View logs
pm2 logs hubspot-connector

# Restart connector
pm2 restart hubspot-connector

# Stop connector
pm2 stop hubspot-connector

# Run one-time sync
pm2 stop hubspot-connector
npm run start:once
pm2 start hubspot-connector

# Check sync status
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
  -e "SELECT * FROM sync_state ORDER BY last_sync_date DESC;"
```

That's it! Your connector is now syncing HubSpot data to MariaDB every 15 minutes.
