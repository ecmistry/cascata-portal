# Cascata - Transform Forecasting

> A comprehensive revenue forecasting system that transforms complex Excel-based cascade models into an automated, visual web application. Integrates directly with HubSpot CRM to pull contacts and deals data for field mapping and configuration.

[![Security Status](https://img.shields.io/badge/security-reviewed-green)]()
[![Tests](https://img.shields.io/badge/tests-147%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Full Installation Guide](#full-installation-guide)
- [Configuration](#configuration)
- [HubSpot Integration](#hubspot-integration)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)

---

## Overview

Cascata is a web-based revenue forecasting platform that automates the cascade model calculation process. It predicts revenue based on SQL (Sales Qualified Lead) inputs with time-based conversion logic, replacing manual spreadsheet workflows with an intuitive, secure portal.

The platform connects directly to your HubSpot CRM to read contacts and deals data, allowing you to map HubSpot fields to the cascade model without any intermediate data warehouse.

### Key Capabilities

- **Automated Forecasting**: Calculate revenue forecasts from SQL inputs using configurable conversion rates
- **Visual Analytics**: Interactive Sankey diagrams and charts for data visualization
- **Multi-Dimensional Analysis**: Support for multiple regions, SQL types, and time periods
- **What-If Scenarios**: Test different assumptions and see impact on forecasts
- **Performance Tracking**: Compare actual vs predicted revenue with variance analysis
- **HubSpot Integration**: Read contacts and deals directly from HubSpot CRM API
- **Export & Reporting**: Export forecasts to Excel and PDF

---

## Features

### Core Functionality

- **Cascade Model Engine** - SQL to Opportunity conversion with configurable rates, Opportunity to Revenue conversion with win rates, time-based distribution (89% same quarter, 10% next, 1% two quarters later), multi-region and multi-SQL-type support
- **Data Management** - Multi-step setup wizard, historical SQL volume tracking (8+ quarters), conversion rate management by region and SQL type, deal economics (ACV) configuration, CSV bulk import
- **Visualization** - Interactive Sankey diagram, SQL volume trend charts, revenue forecast charts, regional performance comparison, conversion funnel visualization
- **Advanced Features** - What-If Analysis, Scenario Management, Performance Tracking, HubSpot CRM Integration, Excel/PDF Export

### HubSpot CRM Integration

- **Direct API Access**: Reads contacts and deals from HubSpot CRM API v3 using a private app access token
- **Field Mapping**: Configure Cascata Environment page lets you map HubSpot properties to cascade model fields (SQL date, team, SQL type, opportunity date, ARR, close date, etc.)
- **All Properties Available**: Automatically discovers and lists all HubSpot contact and deal properties for selection
- **Server-Side Pagination**: Efficient paginated queries using HubSpot's Search API
- **Caching**: 5-minute property name cache to reduce API calls

### Security Features

- Secure login with bcrypt password hashing (10 rounds)
- Session-based authentication with JWT (30-day expiration)
- Company-level access control with ownership verification
- Role-based permissions (admin/user)
- Rate limiting (5 login attempts per 15 minutes, 100 API requests per 15 minutes)
- CSRF protection using Double Submit Cookie pattern
- SQL injection protection via Drizzle ORM parameterized queries
- Input validation and sanitization using Zod schemas
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- HTTPS with SSL/TLS via Let's Encrypt
- HttpOnly session cookies with secure flag

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite 7 | Build tool and dev server |
| Tailwind CSS 4 | Styling |
| tRPC 11 | Type-safe API client |
| TanStack React Query | Data fetching and caching |
| Recharts | Data visualization |
| ReactFlow | Interactive Sankey diagrams |
| Wouter | Client-side routing |
| shadcn/ui | UI component library |

### Backend
| Technology | Purpose |
|---|---|
| Node.js 20+ | Runtime |
| Express 4 | Web framework |
| tRPC 11 | Type-safe API framework |
| Drizzle ORM | Database ORM (parameterized queries) |
| MariaDB/MySQL | Database |
| bcrypt | Password hashing |
| Jose | JWT session handling |
| Axios | HubSpot API client |

### Integrations
| Technology | Purpose |
|---|---|
| HubSpot CRM API v3 | Contacts and deals data source |
| Google BigQuery | Data warehouse sync (optional) |
| AWS S3 | File storage (optional) |

### Infrastructure
| Technology | Purpose |
|---|---|
| Nginx | Reverse proxy and SSL termination |
| Let's Encrypt / Certbot | SSL certificates with auto-renewal |
| PM2 | Process management |
| AWS EC2 | Hosting |

---

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm 10+
- MariaDB/MySQL 10.5+
- A HubSpot private app access token (for CRM integration)
- Nginx (for production)

### Quick Install

```bash
git clone <repository-url>
cd cascata-portal

pnpm install
pnpm rebuild

# Create .env file (see Configuration section)

pnpm db:push
npx tsx scripts/createUserSimple.ts
npx tsx scripts/seedDemoData.mjs  # Optional: load demo data

pnpm dev  # Development
# or
pnpm build && pnpm start  # Production
```

The application will be available at `http://localhost:3000`

Default login: `admin` / `Gr@v1t33r0ck$` (change immediately in production)

---

## Full Installation Guide

This guide covers a complete production deployment on Amazon Linux 2023 / AWS EC2.

### Step 1: Install System Dependencies

```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Install pnpm
sudo npm install -g pnpm@10.4.1

# Install MariaDB
sudo dnf install -y mariadb105-server
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Install Nginx
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot for SSL
sudo dnf install -y certbot python3-certbot-nginx

# Install PM2 for process management
sudo npm install -g pm2
```

### Step 2: Set Up the Database

```sql
-- Connect as root: sudo mariadb
CREATE DATABASE cascade_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cascade_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON cascade_portal.* TO 'cascade_user'@'localhost';
FLUSH PRIVILEGES;
```

### Step 3: Clone and Install the Application

```bash
cd /home/ec2-user
git clone <repository-url> cascata-portal
cd cascata-portal

pnpm install
pnpm rebuild
```

### Step 4: Create the .env File

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)

cat > .env << EOF
# Application
NODE_ENV=production
PORT=3000
DOMAIN=cascata.online

# Database
DATABASE_URL=mysql://cascade_user:your_secure_password_here@localhost:3306/cascade_portal

# Authentication
JWT_SECRET=${JWT_SECRET}

# HTTPS
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/cascata.online/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/cascata.online/privkey.pem

# HubSpot Integration
HUBSPOT_TOKEN=your-hubspot-private-app-token-here
EOF
```

### Step 5: Run Database Migrations and Seed Data

```bash
pnpm db:push
npx tsx scripts/createUserSimple.ts
DATABASE_URL="mysql://cascade_user:your_secure_password_here@localhost:3306/cascade_portal" npx tsx scripts/seedDemoData.mjs
```

### Step 6: Configure Nginx

Create `/etc/nginx/conf.d/cascata.online.conf`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    server_name cascata.online www.cascata.online;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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

    listen 80;
}
```

Test and reload:

```bash
sudo mkdir -p /var/www/html
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Set Up SSL

```bash
sudo certbot --nginx \
  -d cascata.online \
  -d www.cascata.online \
  --email admin@cascata.online \
  --agree-tos \
  --non-interactive
```

Certbot will automatically update the Nginx config with SSL certificates and HTTP-to-HTTPS redirect. Auto-renewal is configured automatically.

### Step 8: Build and Start the Application

```bash
pnpm build

NODE_ENV=production pm2 start dist/index.js --name cascata
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

### Step 9: Verify

```bash
# DNS resolution
dig cascata.online +short

# HTTPS response
curl -sI https://cascata.online

# SSL certificate
echo | openssl s_client -servername cascata.online -connect cascata.online:443 2>/dev/null | openssl x509 -noout -dates

# Application process
pm2 status

# Service health
sudo systemctl status mariadb nginx
```

### AWS Security Group

Ensure these ports are open:

| Port | Protocol | Purpose |
|---|---|---|
| 80 | HTTP | Let's Encrypt validation and redirect |
| 443 | HTTPS | Application traffic |
| 22 | SSH | Server administration |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Set to `production` for production deployments |
| `PORT` | No | `3000` | Application port |
| `DOMAIN` | No | `localhost` | Application domain |
| `DATABASE_URL` | Yes | - | MySQL/MariaDB connection string |
| `JWT_SECRET` | Yes (prod) | Dev fallback | Secret key for JWT session tokens |
| `ENABLE_HTTPS` | No | - | Set to `true` to enable HTTP-to-HTTPS redirect |
| `SSL_CERT_PATH` | No | - | Path to SSL certificate (fullchain.pem) |
| `SSL_KEY_PATH` | No | - | Path to SSL private key (privkey.pem) |
| `HUBSPOT_TOKEN` | Yes | - | HubSpot private app access token |
| `VITE_APP_ID` | No | - | OAuth application ID (if using OAuth) |
| `OAUTH_SERVER_URL` | No | - | OAuth server URL (if using OAuth) |
| `OWNER_OPEN_ID` | No | - | Owner OpenID for auto-admin role |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | - | Path to BigQuery service account JSON |

### Database Connection String Format

```
mysql://username:password@hostname:port/database_name
```

Example: `mysql://cascade_user:MyP@ss123@localhost:3306/cascade_portal`

---

## HubSpot Integration

### Setting Up a HubSpot Private App

1. Go to your HubSpot account > Settings > Integrations > Private Apps
2. Click **Create a private app**
3. Name it (e.g., "Cascata Portal")
4. Under **Scopes**, enable:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.schemas.contacts.read`
   - `crm.schemas.deals.read`
5. Click **Create app** and copy the access token
6. Add the token to your `.env` file as `HUBSPOT_TOKEN`

### How It Works

The "Configure Cascata Environment" page (`/configure-cascata`) reads directly from your HubSpot CRM:

1. **Property Discovery**: Fetches all available contact and deal property names from HubSpot's Properties API
2. **Data Fetching**: Uses HubSpot's Search API v3 to retrieve contacts and deals with all their properties
3. **Field Mapping**: Presents a configuration table where you map HubSpot fields to cascade model concepts:

| Question | Object | Default HubSpot Field |
|---|---|---|
| When did someone become an SQL? | Contacts | `property_admin_first_became_a_sql_date` |
| How do you select teams? | Contacts | `property_admin_pod` |
| What type of SQLs do you track? | Contacts | `property_sql_type` |
| Conversion to opportunity date? | Contacts | `property_admin_first_became_an_opportunity_date` |
| How do you select teams? | Deals | `property_deal_geo_pods` |
| What type of opportunities? | Deals | `property_dealtype` |
| What field captures ARR? | Deals | `property_amount_in_home_currency` |
| SQL associated with opportunity? | Deals | `property_type_of_sql_associated_to_deal` |
| Close date field? | Deals | `property_closedate` |
| Deal won field? | Deals | `deal_stage_value` (from deal_stage table) |

### Architecture

```
Browser  -->  tRPC Endpoint  -->  hubspot-client.ts  -->  HubSpot CRM API v3
                                       |
                                  Uses HUBSPOT_TOKEN
                                  (Bearer auth)
```

All HubSpot API calls are server-side. The token never reaches the browser.

---

## Security

### Security Measures

| Layer | Protection |
|---|---|
| Authentication | bcrypt password hashing (10 rounds), JWT sessions (30-day expiry) |
| Authorization | Company-level ownership checks, admin role enforcement |
| CSRF | Double Submit Cookie pattern with constant-time token comparison |
| Rate Limiting | Login: 5 attempts/15 min, API: 100 requests/15 min (per IP) |
| Input Validation | Zod schemas on all tRPC inputs (type coercion, length limits, range checks) |
| SQL Injection | Drizzle ORM parameterized queries (no raw SQL string concatenation) |
| Headers | CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy |
| Cookies | HttpOnly, Secure flag over HTTPS, SameSite attribute |
| Transport | TLS 1.2/1.3 via Let's Encrypt |
| Logging | No sensitive data (passwords, tokens, emails) in production logs |

### Security Best Practices

1. Change the default admin password immediately after first login
2. Use a strong, unique `JWT_SECRET` (generated via `openssl rand -hex 32`)
3. Keep the `HUBSPOT_TOKEN` in `.env` only (never commit to git)
4. Always run with `ENABLE_HTTPS=true` in production
5. Keep dependencies up to date (`pnpm update`)
6. Set up regular database backups
7. Monitor PM2 logs for suspicious activity (`pm2 logs cascata`)

---

## Testing

The project includes a comprehensive test suite with 147 tests across 10 files.

### Running Tests

```bash
pnpm test
```

### Test Coverage

| Test File | Tests | Coverage Area |
|---|---|---|
| `security-headers.test.ts` | 11 | CSP, X-Frame-Options, MIME sniffing, Permissions-Policy |
| `csrf.test.ts` | 13 | Token generation, validation, safe method exemption, OAuth bypass |
| `rate-limit.test.ts` | 8 | Login limiter (5/15min), API limiter (100/15min), per-IP isolation |
| `validation.test.ts` | 25 | Password complexity, email/username limits, company name, SQL injection strings |
| `sql-injection.test.ts` | 20 | Type coercion attacks, ORM parameterization, UNION/OR injection patterns |
| `auth-session.test.ts` | 19 | JWT create/verify, expired tokens, tampered tokens, bcrypt salting |
| `authorization.test.ts` | 17 | Company ownership, admin role (case-sensitive), route protection classification |
| `cookie-security.test.ts` | 9 | httpOnly, secure flag, sameSite, x-forwarded-proto handling |
| `cascade-engine.test.ts` | 21 | Quarter arithmetic, calculation correctness, time distribution, performance benchmarks |
| `hubspot-client.test.ts` | 4 | Token validation (missing, placeholder, empty), response shape |

### What the Tests Verify

- Every security middleware works correctly in isolation
- SQL injection attempts are caught by input validation or safely parameterized by the ORM
- Authentication tokens cannot be forged, tampered with, or replayed after expiry
- Company data is isolated per user (no cross-tenant access)
- Cascade calculations produce correct results with no overflow
- Core operations (validation, JWT, CSRF tokens) meet performance benchmarks

---

## Deployment

### Redeploying After Code Changes

```bash
cd /home/ec2-user/cascata-portal
git pull origin main
pnpm install
pnpm build
pm2 restart cascata
```

### Database Migrations

After schema changes:

```bash
pnpm db:push
pm2 restart cascata
```

### Viewing Logs

```bash
pm2 logs cascata            # Live log stream
pm2 logs cascata --lines 50 # Last 50 lines
```

### Restarting Services

```bash
pm2 restart cascata          # Application
sudo systemctl restart nginx # Nginx
sudo systemctl restart mariadb # Database
```

### SSL Certificate Renewal

Certbot auto-renews via a systemd timer. To test:

```bash
sudo certbot renew --dry-run
```

---

## API Documentation

### Authentication

All protected endpoints require authentication via session cookie. State-changing requests also require a CSRF token in the `x-csrf-token` header (read from the `csrf-token` cookie).

**Login**:
```
POST /api/trpc/auth.login
Body: { email: string, password: string }
Response: { success: true, user: { id, openId, name, email, role } }
```

**Logout**:
```
POST /api/trpc/auth.logout
Response: { success: true }
```

**Current User**:
```
GET /api/trpc/auth.me
Response: User | null
```

### Company Management

```
POST /api/trpc/company.create     { name, description? }
GET  /api/trpc/company.list
GET  /api/trpc/company.get        { id }
```

### Forecast Operations

```
POST /api/trpc/forecast.calculate { companyId }
GET  /api/trpc/forecast.list      { companyId }
```

### HubSpot Data (Configure Cascata Environment)

```
GET /api/trpc/dashboard.playground.cascataTest       { page, pageSize }
GET /api/trpc/dashboard.playground.cascataTestDeals   { page, pageSize }
```

These endpoints fetch contacts and deals directly from HubSpot CRM API using the `HUBSPOT_TOKEN`.

### Setup Data (all require company ownership)

```
POST /api/trpc/region.create          { companyId, name, displayName }
GET  /api/trpc/region.list            { companyId }
POST /api/trpc/sqlType.create         { companyId, name, displayName }
GET  /api/trpc/sqlType.list           { companyId }
POST /api/trpc/sqlHistory.upsert      { companyId, regionId, sqlTypeId, year, quarter, volume }
GET  /api/trpc/sqlHistory.list        { companyId }
POST /api/trpc/sqlHistory.importCSV   { companyId, records[] }
POST /api/trpc/conversionRate.upsert  { companyId, regionId, sqlTypeId, oppCoverageRatio, winRateNew, winRateUpsell }
POST /api/trpc/dealEconomics.upsert   { companyId, regionId, acvNew, acvUpsell }
POST /api/trpc/timeDistribution.upsert { companyId, sqlTypeId, sameQuarterPct, nextQuarterPct, twoQuarterPct }
```

See `server/routers.ts` for the complete API definition.

---

## Troubleshooting

### Application Won't Start

**Port in use**:
```bash
sudo lsof -i :3000
kill -9 <PID>
```

**Database connection failed**:
```bash
sudo systemctl status mariadb
mariadb -u cascade_user -p cascade_portal -e "SELECT 1;"
# Verify DATABASE_URL in .env matches
```

### Login Issues

- "Invalid email or password" -- verify user exists: `mariadb -u cascade_user -p cascade_portal -e "SELECT email FROM users;"`
- Session expires immediately -- check `JWT_SECRET` is set in `.env` and HTTPS is working

### HubSpot Integration Issues

**"HUBSPOT_TOKEN is not configured"**:
- Verify `HUBSPOT_TOKEN` is set in `.env` and is not the placeholder value
- Restart the app after changing `.env`: `pm2 restart cascata`

**401 Unauthorized from HubSpot**:
- The token may have expired or been revoked -- generate a new one in HubSpot Settings > Private Apps
- Ensure the private app has `crm.objects.contacts.read` and `crm.objects.deals.read` scopes

**Slow initial load on Configure Cascata page**:
- First request fetches all property names from HubSpot (cached for 5 minutes after)
- Large HubSpot portals with many custom properties may take a few seconds

### Performance Issues

**Slow forecast calculation**: Check database indexes and data volume
**Slow page loads**: Check Nginx proxy config and browser console for errors

### Diagnostic Commands

```bash
# Application
pm2 status
pm2 logs cascata --lines 30

# Nginx
sudo systemctl status nginx
sudo nginx -t

# Database
sudo systemctl status mariadb
mariadb -u cascade_user -p cascade_portal -e "SHOW TABLES;"

# SSL
curl -sI https://cascata.online | head -10
echo | openssl s_client -servername cascata.online -connect cascata.online:443 2>/dev/null | openssl x509 -noout -dates

# DNS
dig cascata.online +short

# HubSpot connectivity test
curl -s -H "Authorization: Bearer $(grep HUBSPOT_TOKEN .env | cut -d= -f2)" \
  https://api.hubapi.com/crm/v3/objects/contacts?limit=1 | head -100

# Run tests
pnpm test
```

---

## Development

### Project Structure

```
cascata-portal/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components (Dashboard, Login, Setup, etc.)
│   │   ├── components/       # Reusable components (ui/, DashboardLayout, etc.)
│   │   ├── _core/hooks/      # Auth hooks
│   │   └── lib/              # tRPC client, utils, CSRF
│   └── public/               # Static assets (logos)
├── server/                    # Express backend
│   ├── _core/                # Core middleware and utilities
│   │   ├── index.ts          # Server entry point
│   │   ├── csrf.ts           # CSRF protection
│   │   ├── rateLimit.ts      # Rate limiting
│   │   ├── securityHeaders.ts # Security headers
│   │   ├── cookies.ts        # Cookie configuration
│   │   ├── sdk.ts            # Auth/session management
│   │   ├── validation.ts     # Input validation schemas
│   │   └── env.ts            # Environment config
│   ├── __tests__/            # Test suite (10 files, 147 tests)
│   ├── routers.ts            # tRPC API routes
│   ├── db.ts                 # Database functions (Drizzle ORM)
│   ├── hubspot-client.ts     # HubSpot CRM API client
│   ├── cascadeEngine.ts      # Forecast calculation engine
│   └── bigquery-playground.ts # BigQuery integration (legacy)
├── drizzle/                   # Database schema and migrations
│   ├── schema.ts             # Table definitions
│   └── 0000_*.sql - 0004_*.sql # Migration files
├── shared/                    # Shared types and constants
├── scripts/                   # Setup and seed scripts
│   ├── createUserSimple.ts   # Create admin user
│   ├── seedDemoData.mjs      # Seed demo data
│   └── seedGraviteeData.mjs  # Seed Gravitee demo data
├── .env                       # Environment variables (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── drizzle.config.ts
```

### Available Scripts

```bash
pnpm dev          # Start development server with hot reload
pnpm build        # Build for production (Vite + esbuild)
pnpm start        # Start production server (node dist/index.js)
pnpm test         # Run test suite (147 tests)
pnpm db:push      # Generate and run database migrations
pnpm check        # TypeScript type check
pnpm format       # Format code with Prettier
```

### Database Schema

| Table | Purpose |
|---|---|
| `users` | User accounts (email, passwordHash, role, openId) |
| `companies` | Company/organization models (with BigQuery config) |
| `regions` | Geographic regions (NORAM, EMESA North, EMESA South) |
| `sqlTypes` | SQL types (Inbound, Outbound, ILO, Event, Partner) |
| `sqlHistory` | Historical SQL volume data (by region, type, quarter) |
| `conversionRates` | SQL to Opportunity conversion rates (basis points) |
| `dealEconomics` | Average Contract Values (ACVs, in cents) |
| `timeDistributions` | Time-based conversion probabilities |
| `forecasts` | Calculated forecast results |
| `actuals` | Actual performance data for comparison |
| `scenarios` | Saved what-if scenarios |

See `drizzle/schema.ts` for complete schema definition.

---

## Contributing

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm test` and ensure all 147 tests pass
4. Run `pnpm check` for type safety
5. Submit a pull request

### Code Style

- TypeScript for all source files
- Prettier for formatting (`pnpm format`)
- Zod schemas for all API input validation
- Drizzle ORM for all database queries (no raw SQL)

### Security Rules

- Never commit `.env`, credentials, or tokens
- All new API endpoints must use `protectedProcedure` or `companyProtectedProcedure`
- All user inputs must be validated with Zod schemas
- Add tests for any new security-critical code

---

## License

MIT License - see LICENSE file for details.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.

### Version 1.1.0 (2026-03-11)
- Direct HubSpot CRM API integration (replaces BigQuery for Configure Cascata Environment page)
- CSP updated to allow Google Fonts
- Comprehensive test suite (147 tests across 10 files)

### Version 1.0.0 (2026-01-15)
- Complete cascade model calculation engine
- Multi-step setup wizard
- Interactive visualizations (Sankey diagrams, charts)
- What-If analysis and scenario management
- Performance tracking (actual vs predicted)
- Security hardening (CSRF, rate limiting, session management)
