# Cascata - Transform Forecasting

> A comprehensive revenue forecasting system that transforms complex Excel-based cascade models into an automated, visual web application.

[![Security Status](https://img.shields.io/badge/security-reviewed-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Security](#security)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

Cascata - Transform Forecasting is a web-based revenue forecasting platform that automates the cascade model calculation process. It predicts revenue based on SQL (Sales Qualified Lead) inputs with time-based conversion logic, replacing manual spreadsheet workflows with an intuitive, secure portal.

### Key Capabilities

- **Automated Forecasting**: Calculate revenue forecasts from SQL inputs using configurable conversion rates
- **Visual Analytics**: Interactive Sankey diagrams and charts for data visualization
- **Multi-Dimensional Analysis**: Support for multiple regions, SQL types, and time periods
- **What-If Scenarios**: Test different assumptions and see impact on forecasts
- **Performance Tracking**: Compare actual vs predicted revenue with variance analysis
- **BigQuery Integration**: Sync data from BigQuery data warehouse
- **Export & Reporting**: Export forecasts to Excel and PDF

---

## Features

### Core Functionality

✅ **Cascade Model Engine**
- SQL → Opportunity conversion with configurable rates
- Opportunity → Revenue conversion with win rates
- Time-based distribution (89% same quarter, 10% next, 1% two quarters later)
- Multi-region and multi-SQL-type support

✅ **Data Management**
- Multi-step setup wizard for model configuration
- Historical SQL volume tracking (8+ quarters)
- Conversion rate management by region and SQL type
- Deal economics (ACV) configuration
- CSV bulk import for historical data

✅ **Visualization**
- Interactive Sankey diagram showing cascade flow
- SQL volume trend charts
- Revenue forecast charts
- Regional performance comparison
- SQL type effectiveness analysis
- Conversion funnel visualization

✅ **Advanced Features**
- What-If Analysis: Adjust parameters and see forecast impact
- Scenario Management: Save and compare multiple scenarios
- Performance Tracking: Actual vs predicted revenue comparison
- BigQuery Integration: Automated data sync from data warehouse
- Export Functionality: Excel and PDF export

### Security Features

✅ **Authentication & Authorization**
- Secure login with bcrypt password hashing
- Session-based authentication (30-day expiration)
- Company-level access control
- Role-based permissions (admin/user)

✅ **Security Measures**
- Rate limiting (5 login attempts per 15 minutes)
- SQL injection protection (ORM + query sanitization)
- Input validation and sanitization
- HTTPS support with SSL/TLS
- HttpOnly cookies
- No sensitive data in logs

---

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **tRPC** - Type-safe API client
- **React Query** - Data fetching and caching
- **Recharts** - Data visualization
- **ReactFlow** - Interactive diagrams
- **Wouter** - Client-side routing

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **tRPC** - Type-safe API framework
- **Drizzle ORM** - Database ORM
- **MariaDB/MySQL** - Database
- **bcrypt** - Password hashing
- **Jose** - JWT handling

### Infrastructure
- **Nginx** - Reverse proxy and SSL termination
- **Let's Encrypt** - SSL certificates
- **AWS EC2** - Hosting
- **BigQuery** - Data warehouse integration

---

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm
- MariaDB/MySQL 10.5+
- Nginx (for production)
- SSL certificates (for HTTPS)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cascade_portal

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm db:push

# Create admin user
npx tsx scripts/createUserSimple.ts

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Application
NODE_ENV=production
PORT=3000
DOMAIN=cascata.online

# Database
DATABASE_URL=mysql://user:password@localhost:3306/database_name

# Authentication
JWT_SECRET=your-secret-key-change-in-production
VITE_APP_ID=your-app-id

# HTTPS (Production)
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/cascata.online/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/cascata.online/privkey.pem

# OAuth (Optional)
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-owner-open-id

# BigQuery (Optional)
GOOGLE_APPLICATION_CREDENTIALS=credentials/reporting-299920-803fa8e5405b.json
# Note: Credentials files should be placed in the credentials/ directory
```

### Database Setup

1. **Create Database**:
```sql
CREATE DATABASE cascade_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cascade_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON cascade_portal.* TO 'cascade_user'@'localhost';
FLUSH PRIVILEGES;
```

2. **Run Migrations**:
```bash
pnpm db:push
```

3. **Create Admin User**:
```bash
npx tsx scripts/createUserSimple.ts
```

Default credentials:
- Username: `admin`
- Password: `Gr@v1t33r0ck$`

**⚠️ Change the default password immediately in production!**

### Logo Files

Place logo files in `client/public/`:
- `logo.png` - Main application logo (used in header and home page)
- `logo2.png` - Favicon (used as browser icon)

Supported formats: PNG, SVG, ICO

---

## Security

### Security Features

The application implements comprehensive security measures:

- ✅ **Authorization**: Company-level access control ensures users can only access their own data
- ✅ **Rate Limiting**: Protection against brute force attacks (5 login attempts per 15 minutes)
- ✅ **Session Security**: 30-day session expiration, HttpOnly cookies, secure flag
- ✅ **Input Validation**: All inputs validated and sanitized using Zod schemas
- ✅ **SQL Injection Protection**: ORM usage + BigQuery query sanitization
- ✅ **Password Security**: bcrypt hashing with 10 rounds
- ✅ **HTTPS**: SSL/TLS encryption for all traffic
- ✅ **Secure Logging**: No sensitive data in production logs

### Security Review

See [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) for detailed security assessment.

**Status**: ✅ All critical security issues resolved. Production ready.

### Security Best Practices

1. **Change Default Credentials**: Update admin password immediately
2. **Use Strong Passwords**: Minimum 8 characters with complexity requirements
3. **Enable HTTPS**: Always use HTTPS in production
4. **Regular Updates**: Keep dependencies up to date
5. **Monitor Logs**: Review logs regularly for suspicious activity
6. **Backup Database**: Regular automated backups recommended

---

## Deployment

### Production Deployment

#### 1. Server Setup

```bash
# Install Node.js and pnpm
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
npm install -g pnpm

# Install MariaDB
sudo yum install -y mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Install Nginx
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 2. SSL Certificate Setup

```bash
# Install Certbot
sudo yum install -y certbot

# Obtain certificate
sudo certbot certonly --standalone \
  -d cascata.online \
  -d www.cascata.online \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Set up auto-renewal
sudo certbot renew --dry-run
```

#### 3. Nginx Configuration

Create `/etc/nginx/conf.d/cascata.online.conf`:

```nginx
server {
    listen 80;
    server_name cascata.online www.cascata.online;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cascata.online www.cascata.online;

    ssl_certificate /etc/letsencrypt/live/cascata.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cascata.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Add to `/etc/nginx/nginx.conf` (in `http` block):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. AWS Security Group

Open ports in AWS Security Group:
- Port 80 (HTTP) - for Let's Encrypt validation
- Port 443 (HTTPS) - for secure traffic
- Port 3000 (optional) - for direct access (not recommended)

#### 5. Application Deployment

```bash
# Build application
pnpm build

# Set up environment
cp .env.example .env
# Edit .env with production values

# Start application
NODE_ENV=production pnpm start
```

#### 6. Process Management (Recommended)

Use PM2 or systemd to manage the application:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/index.js --name cascata

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## API Documentation

### Authentication

All protected endpoints require authentication via session cookie.

**Login**:
```typescript
POST /api/trpc/auth.login
Body: { email: string, password: string }
Response: { success: true, user: {...} }
```

**Logout**:
```typescript
POST /api/trpc/auth.logout
Response: { success: true }
```

### Company Management

**List Companies**:
```typescript
GET /api/trpc/company.list
Response: Company[]
```

**Get Company**:
```typescript
GET /api/trpc/company.get?input={"id":1}
Response: Company
```

**Create Company**:
```typescript
POST /api/trpc/company.create
Body: { name: string, description?: string }
Response: { id: number }
```

### Forecast Operations

**Calculate Forecast**:
```typescript
POST /api/trpc/forecast.calculate
Body: { companyId: number }
Response: { success: true, count: number, message: string }
```

**List Forecasts**:
```typescript
GET /api/trpc/forecast.list?input={"companyId":1}
Response: Forecast[]
```

### BigQuery Integration

**Update Config**:
```typescript
POST /api/trpc/bigquery.updateConfig
Body: {
  companyId: number,
  bigqueryEnabled?: boolean,
  bigqueryProjectId?: string,
  bigqueryDatasetId?: string,
  bigqueryCredentials?: string,
  ...
}
Response: { success: true }
```

**Sync Data**:
```typescript
POST /api/trpc/bigquery.sync
Body: { companyId: number }
Response: SyncResult
```

See `server/routers.ts` for complete API documentation.

---

## Troubleshooting

### Common Issues

#### Application Won't Start

**Issue**: Port already in use
```bash
# Check what's using the port
sudo lsof -i :3000

# Kill the process or use a different port
kill -9 <PID>
# Or set PORT=3001 in .env
```

**Issue**: Database connection failed
```bash
# Verify database is running
sudo systemctl status mariadb

# Test connection
mysql -u cascade_user -p cascade_portal

# Check DATABASE_URL in .env
```

#### Login Issues

**Issue**: "Invalid email or password"
- Verify user exists in database
- Check password is correct
- Ensure database connection is working

**Issue**: Session expires immediately
- Check cookie settings in browser
- Verify HTTPS is configured correctly
- Check `JWT_SECRET` is set in `.env`

#### BigQuery Sync Issues

**Issue**: "Connection failed"
- Verify credentials are correct
- Check project ID and dataset ID
- Ensure service account has proper permissions

**Issue**: "Table not found"
- Verify table names match exactly
- Check table exists in BigQuery
- Review table schema requirements

#### Performance Issues

**Issue**: Slow forecast calculation
- Check database indexes
- Review forecast data volume
- Consider caching results

**Issue**: Slow page loads
- Check network connection
- Review browser console for errors
- Verify Nginx proxy configuration

### Diagnostic Commands

```bash
# Check application status
ps aux | grep -E "tsx|node.*index"

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check database status
sudo systemctl status mariadb
mysql -u cascade_user -p -e "SHOW DATABASES;"

# View application logs
tail -f /var/log/nginx/error.log
# Or if using PM2
pm2 logs cascata

# Test SSL certificate
curl -v https://cascata.online 2>&1 | grep -E "SSL|certificate"

# Test API endpoint
curl -I https://cascata.online/api/trpc/system.health
```

---

## Development

### Project Structure

```
cascade_portal/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   └── lib/           # Utilities and tRPC client
│   └── public/            # Static assets
├── server/                # Backend Express application
│   ├── _core/            # Core server utilities
│   ├── routers.ts        # tRPC API routes
│   ├── db.ts             # Database functions
│   └── cascadeEngine.ts  # Forecast calculation engine
├── drizzle/              # Database schema and migrations
├── shared/               # Shared types and constants
├── scripts/              # Utility scripts
└── package.json          # Dependencies and scripts
```

### Available Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload

# Building
pnpm build            # Build for production

# Production
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes to database

# Code Quality
pnpm check            # Type check without emitting
pnpm format           # Format code with Prettier
pnpm test             # Run tests
```

### Database Schema

Key tables:
- `users` - User accounts and authentication
- `companies` - Company/organization models
- `regions` - Geographic regions (NORAM, EMESA North, EMESA South)
- `sqlTypes` - SQL types (Inbound, Outbound, ILO, Event, Partner)
- `sqlHistory` - Historical SQL volume data
- `conversionRates` - SQL → Opportunity conversion rates
- `dealEconomics` - Average Contract Values (ACVs)
- `timeDistributions` - Time-based conversion probabilities
- `forecasts` - Calculated forecast results
- `actuals` - Actual performance data
- `scenarios` - Saved what-if scenarios

See `drizzle/schema.ts` for complete schema definition.

---

## Contributing

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Use Prettier for formatting
- Write descriptive commit messages

### Security

- Never commit secrets or credentials
- Review security implications of changes
- Follow security best practices
- Report security issues responsibly

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues, questions, or feature requests:
- Check the [Troubleshooting](#troubleshooting) section
- Review [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) for security information
- Contact the development team

---

## Changelog

### Version 1.0.0 (2025-01-15)

**Security Improvements:**
- ✅ Fixed all critical authorization vulnerabilities
- ✅ Implemented rate limiting
- ✅ Reduced session duration to 30 days
- ✅ Removed sensitive data from logs
- ✅ Added SQL injection protection
- ✅ Enhanced input validation

**Features:**
- ✅ Complete cascade model calculation engine
- ✅ Multi-step setup wizard
- ✅ Interactive visualizations
- ✅ BigQuery integration
- ✅ What-If analysis
- ✅ Performance tracking
- ✅ Export functionality

---

**Built with ❤️ for accurate revenue forecasting**
