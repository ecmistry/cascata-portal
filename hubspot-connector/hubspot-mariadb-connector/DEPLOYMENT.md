# Deployment Guide

This guide provides step-by-step instructions for deploying the HubSpot to MariaDB Connector on your Amazon EC2 server.

## Prerequisites

Before deploying, ensure you have:

1. **Amazon EC2 Server** running Ubuntu or similar Linux distribution
2. **Node.js 18.x or higher** installed
3. **MariaDB 10.11.13** accessible from your EC2 server
4. **HubSpot API Key** with required permissions
5. **SSH access** to your EC2 server

## Step 1: Prepare Your EC2 Server

### Install Node.js (if not already installed)

```bash
# Update package list
sudo apt update

# Install Node.js 22.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version
```

### Install PM2 for Process Management

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

## Step 2: Transfer the Connector to Your Server

### Option A: Using SCP

From your local machine:

```bash
# Upload the connector directory
scp -r hubspot-mariadb-connector ubuntu@your-ec2-ip:/home/ubuntu/

# Or if you have it as a zip file
scp hubspot-mariadb-connector.zip ubuntu@your-ec2-ip:/home/ubuntu/
```

### Option B: Using Git

If you've committed the connector to a Git repository:

```bash
# SSH into your EC2 server
ssh ubuntu@your-ec2-ip

# Clone the repository
cd /home/ubuntu
git clone your-repo-url hubspot-mariadb-connector
cd hubspot-mariadb-connector
```

### Option C: Direct Download

```bash
# SSH into your EC2 server
ssh ubuntu@your-ec2-ip

# Download and extract (if hosted somewhere)
cd /home/ubuntu
wget https://your-server.com/hubspot-mariadb-connector.zip
unzip hubspot-mariadb-connector.zip
cd hubspot-mariadb-connector
```

## Step 3: Install Dependencies

```bash
cd /home/ubuntu/hubspot-mariadb-connector
npm install
```

## Step 4: Configure Environment Variables

### Create .env file

```bash
cp .env.example .env
nano .env  # or use vim, vi, etc.
```

### Set Your Configuration

```env
# HubSpot Configuration
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Database Configuration
DB_HOST=your-mariadb-host.rds.amazonaws.com  # or localhost if local
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=cascade_portal

# Sync Configuration
SYNC_INTERVAL_MINUTES=15
SYNC_BUFFER_MINUTES=5
RATE_LIMIT_REQUESTS=90

# Logging
LOG_LEVEL=info
```

**Important**: 
- Replace `HUBSPOT_API_KEY` with your actual HubSpot Private App token
- Update database credentials to match your MariaDB setup
- Adjust `RATE_LIMIT_REQUESTS` based on your HubSpot tier (see README)

### Secure the .env file

```bash
# Restrict access to .env file
chmod 600 .env
```

## Step 5: Set Up the Database

### Create Database Tables

```bash
npm run db:push
```

This will create all necessary tables in your MariaDB database:
- `sync_state`
- `hubspot_contacts`
- `hubspot_deals`
- `hubspot_deal_pipelines`
- `hubspot_deal_stages`

### Verify Tables Were Created

```bash
# Connect to your database
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# List tables
SHOW TABLES;

# Exit MySQL
EXIT;
```

You should see the five tables listed above.

## Step 6: Test the Connector

### Run a One-Time Sync

Before setting up continuous sync, test with a single run:

```bash
npm run start:once
```

This will:
1. Connect to your database
2. Fetch data from HubSpot
3. Sync contacts, deals, and pipelines
4. Exit when complete

**Monitor the output** for any errors. You should see logs like:

```
[2026-01-02T14:00:00.000Z] [INFO] === Starting contacts sync ===
[2026-01-02T14:00:01.000Z] [INFO] Fetched 100 contacts, total: 100
[2026-01-02T14:00:02.000Z] [INFO] Upserting 100 contacts
[2026-01-02T14:00:03.000Z] [INFO] === Contacts sync completed successfully ===
```

### Verify Data Was Synced

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
SELECT 'contacts' as type, COUNT(*) as count FROM hubspot_contacts
UNION ALL
SELECT 'deals', COUNT(*) FROM hubspot_deals
UNION ALL
SELECT 'pipelines', COUNT(*) FROM hubspot_deal_pipelines
UNION ALL
SELECT 'stages', COUNT(*) FROM hubspot_deal_stages;
"
```

You should see non-zero counts for each type.

## Step 7: Deploy with PM2

### Start the Connector

```bash
cd /home/ubuntu/hubspot-mariadb-connector
pm2 start npm --name "hubspot-connector" -- start
```

### Configure PM2 to Start on Boot

```bash
# Generate startup script
pm2 startup

# This will output a command like:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Run the command it outputs (copy and paste)

# Save the current PM2 process list
pm2 save
```

### Verify the Connector is Running

```bash
pm2 status
```

You should see:

```
┌─────┬───────────────────┬─────────┬─────────┬──────────┬────────┬──────┐
│ id  │ name              │ mode    │ ↺      │ status   │ cpu    │ mem  │
├─────┼───────────────────┼─────────┼─────────┼──────────┼────────┼──────┤
│ 0   │ hubspot-connector │ fork    │ 0       │ online   │ 0%     │ 50mb │
└─────┴───────────────────┴─────────┴─────────┴──────────┴────────┴──────┘
```

### View Logs

```bash
# View real-time logs
pm2 logs hubspot-connector

# View last 100 lines
pm2 logs hubspot-connector --lines 100

# View only errors
pm2 logs hubspot-connector --err
```

## Step 8: Monitor and Maintain

### Check Sync Status

Query the sync_state table to see sync history:

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
SELECT 
  object_type,
  last_sync_date,
  status,
  records_synced,
  SUBSTRING(error_message, 1, 50) as error
FROM sync_state
ORDER BY last_sync_date DESC;
"
```

### Monitor PM2 Process

```bash
# Check process status
pm2 status

# View detailed info
pm2 info hubspot-connector

# Monitor CPU and memory usage
pm2 monit
```

### Restart the Connector

If you need to restart (e.g., after updating .env):

```bash
pm2 restart hubspot-connector
```

### Stop the Connector

```bash
pm2 stop hubspot-connector
```

### Remove from PM2

```bash
pm2 delete hubspot-connector
```

## Step 9: Set Up Log Rotation (Optional but Recommended)

PM2 can automatically rotate logs to prevent them from growing too large:

```bash
# Install PM2 log rotate module
pm2 install pm2-logrotate

# Configure log rotation (optional, defaults are usually fine)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Troubleshooting Deployment

### Issue: "Cannot connect to database"

**Solution**:
1. Verify database credentials in `.env`
2. Check that MariaDB is accessible from EC2:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "SELECT 1;"
   ```
3. Check security groups allow MySQL traffic (port 3306)
4. If using RDS, ensure EC2 security group is allowed in RDS security group

### Issue: "HubSpot API authentication failed"

**Solution**:
1. Verify `HUBSPOT_API_KEY` in `.env` is correct
2. Test API key:
   ```bash
   curl -H "Authorization: Bearer $HUBSPOT_API_KEY" \
        https://api.hubapi.com/crm/v3/objects/contacts?limit=1
   ```
3. Check that your HubSpot Private App has required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.schemas.deals.read`

### Issue: "Module not found" errors

**Solution**:
```bash
# Reinstall dependencies
cd /home/ubuntu/hubspot-mariadb-connector
rm -rf node_modules package-lock.json
npm install
pm2 restart hubspot-connector
```

### Issue: Connector keeps crashing

**Solution**:
1. Check PM2 logs for errors:
   ```bash
   pm2 logs hubspot-connector --err
   ```
2. Check sync_state table for error messages:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
     -e "SELECT * FROM sync_state WHERE status='failed';"
   ```
3. Try running once to see full error:
   ```bash
   pm2 stop hubspot-connector
   npm run start:once
   ```

### Issue: High memory usage

**Solution**:
1. The connector processes data in batches, so memory usage should be reasonable
2. If memory is an issue, you can reduce batch size in `src/config/hubspot.ts`
3. Monitor with: `pm2 monit`

## Updating the Connector

To update the connector to a new version:

1. **Backup your database**:
   ```bash
   mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup.sql
   ```

2. **Stop the connector**:
   ```bash
   pm2 stop hubspot-connector
   ```

3. **Backup current installation**:
   ```bash
   cd /home/ubuntu
   cp -r hubspot-mariadb-connector hubspot-mariadb-connector.backup
   ```

4. **Update the code**:
   ```bash
   cd /home/ubuntu/hubspot-mariadb-connector
   # Pull updates if using Git
   git pull
   
   # Or replace files if using zip
   # unzip -o hubspot-mariadb-connector-v2.zip
   ```

5. **Install dependencies**:
   ```bash
   npm install
   ```

6. **Run database migrations** (if any):
   ```bash
   npm run db:push
   ```

7. **Restart the connector**:
   ```bash
   pm2 restart hubspot-connector
   ```

## Security Best Practices

1. **Protect your .env file**:
   ```bash
   chmod 600 /home/ubuntu/hubspot-mariadb-connector/.env
   ```

2. **Use AWS Secrets Manager** (optional but recommended):
   - Store sensitive credentials in AWS Secrets Manager
   - Update connector to fetch secrets at runtime
   - Rotate credentials regularly

3. **Enable SSL for database connections**:
   - Configure MariaDB to use SSL/TLS
   - Update connection string in `.env`

4. **Restrict EC2 security group**:
   - Only allow necessary inbound traffic
   - Limit SSH access to your IP

5. **Keep Node.js and dependencies updated**:
   ```bash
   npm audit
   npm audit fix
   ```

6. **Monitor logs for suspicious activity**:
   ```bash
   pm2 logs hubspot-connector | grep -i error
   ```

## Backup and Recovery

### Backup Strategy

1. **Database backups** (automated):
   ```bash
   # Add to crontab
   crontab -e
   
   # Add this line to backup daily at 2 AM
   0 2 * * * mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > /home/ubuntu/backups/hubspot_$(date +\%Y\%m\%d).sql
   ```

2. **Configuration backup**:
   ```bash
   cp /home/ubuntu/hubspot-mariadb-connector/.env /home/ubuntu/backups/.env.backup
   ```

### Recovery

If you need to restore:

1. **Stop the connector**:
   ```bash
   pm2 stop hubspot-connector
   ```

2. **Restore database**:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup.sql
   ```

3. **Restart connector**:
   ```bash
   pm2 restart hubspot-connector
   ```

## Support Checklist

Before reaching out for help, verify:

- [ ] Node.js version is 18.x or higher
- [ ] MariaDB is accessible and credentials are correct
- [ ] HubSpot API key is valid and has required scopes
- [ ] All environment variables are set in `.env`
- [ ] Database tables were created successfully
- [ ] One-time sync test completed without errors
- [ ] PM2 process is running (`pm2 status`)
- [ ] Logs show sync activity (`pm2 logs hubspot-connector`)
- [ ] sync_state table shows successful syncs
- [ ] Data is appearing in hubspot_contacts and hubspot_deals tables

## Next Steps

After successful deployment:

1. **Monitor for 24 hours** to ensure syncs are running smoothly
2. **Set up alerting** (optional) for sync failures
3. **Document your configuration** for your team
4. **Schedule regular database backups**
5. **Plan for scaling** if data volume grows significantly

Congratulations! Your HubSpot to MariaDB Connector is now deployed and running.
