# CFV Metrics Agent - Railway Deployment Guide

## Quick Start (5 Minutes)

### Step 1: Prepare Repository

1. **Push to GitHub** (if not already done):
```bash
cd /home/ubuntu/cfv-metrics-agent
git init
git add .
git commit -m "Initial commit - CFV Metrics Agent"
git remote add origin https://github.com/yourusername/cfv-metrics-agent.git
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select `cfv-metrics-agent` repository
6. Railway will automatically detect the Dockerfile and start building

### Step 3: Add MySQL Database

1. In Railway project dashboard, click "New"
2. Select "Database" → "MySQL"
3. Railway provisions MySQL and auto-injects environment variables

### Step 4: Configure Environment Variables

In Railway dashboard, go to Variables tab and add:

```env
# API Configuration
API_PORT=3000
NODE_ENV=production

# Database (auto-injected by Railway, but verify)
DB_HOST=${{MYSQL.RAILWAY_PRIVATE_DOMAIN}}
DB_PORT=${{MYSQL.RAILWAY_TCP_PROXY_PORT}}
DB_USER=${{MYSQL.MYSQLUSER}}
DB_PASSWORD=${{MYSQL.MYSQLPASSWORD}}
DB_NAME=cfv_metrics

# API Keys (REQUIRED - add your keys)
COINGECKO_API_KEY=your_coingecko_api_key_here

# Collection Settings
COLLECTION_INTERVAL_MINUTES=60
DELAY_BETWEEN_COINS_MS=5000
MAX_RETRIES=3
RETRY_DELAY_MS=2000

# Logging
LOG_LEVEL=info
```

### Step 5: Initialize Database

**Option A: Using Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Connect to MySQL
railway connect MySQL

# Run schema
mysql -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < database/schema.sql
```

**Option B: Using Web Shell**

1. In Railway dashboard, click on MySQL service
2. Click "Connect" → "Web Shell"
3. Copy/paste the schema SQL from `database/schema.sql`

**Option C: Using npm script** (add to package.json)

```json
{
  "scripts": {
    "db:init": "node -e \"require('./dist/database/DatabaseManager').initializeDatabase()\""
  }
}
```

Then run:
```bash
railway run npm run db:init
```

### Step 6: Verify Deployment

1. Railway will provide a public URL like: `https://cfv-metrics-agent-production.up.railway.app`
2. Test the health endpoint:

```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T...",
  "components": {
    "database": { "status": "healthy" },
    "collectors": { "status": "healthy" },
    "api": { "status": "healthy" }
  }
}
```

---

## Railway Configuration Files

### railway.json

Already created at `/home/ubuntu/cfv-metrics-agent/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Dockerfile

Already created at `/home/ubuntu/cfv-metrics-agent/Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_PORT` | Port for API server | `3000` |
| `NODE_ENV` | Environment | `production` |
| `DB_HOST` | MySQL host | Auto-injected by Railway |
| `DB_PORT` | MySQL port | Auto-injected by Railway |
| `DB_USER` | MySQL user | Auto-injected by Railway |
| `DB_PASSWORD` | MySQL password | Auto-injected by Railway |
| `DB_NAME` | Database name | `cfv_metrics` |
| `COINGECKO_API_KEY` | CoinGecko API key | Get from coingecko.com |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COLLECTION_INTERVAL_MINUTES` | How often to collect data | `60` |
| `DELAY_BETWEEN_COINS_MS` | Delay between API calls | `5000` |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `RETRY_DELAY_MS` | Delay before retry | `2000` |
| `LOG_LEVEL` | Logging level | `info` |

---

## Monitoring & Logs

### View Logs

**Railway Dashboard:**
1. Go to your project
2. Click on the service
3. Click "Logs" tab
4. View real-time logs

**Railway CLI:**
```bash
railway logs
railway logs --tail 100
railway logs --follow
```

### Metrics

Railway provides built-in metrics:
1. CPU usage
2. Memory usage
3. Network traffic
4. Response times

Access via: Project → Service → Metrics tab

---

## Scaling

### Vertical Scaling

Increase resources for a single instance:

1. Go to Settings → Resources
2. Adjust:
   - Memory: 512MB → 2GB
   - CPU: 0.5 vCPU → 2 vCPU

**Cost Impact:** ~$5-20/month depending on resources

### Horizontal Scaling

Run multiple instances:

1. Go to Settings → Scaling
2. Enable "Horizontal Scaling"
3. Set min/max replicas (e.g., 2-5)
4. Railway auto-scales based on load

**Cost Impact:** Multiplied by number of replicas

---

## Custom Domain

### Add Custom Domain

1. Go to Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `api.cfv.example.com`)
4. Add CNAME record to your DNS:
   ```
   CNAME api.cfv.example.com → your-app.up.railway.app
   ```
5. Wait for DNS propagation (5-60 minutes)
6. Railway automatically provisions SSL certificate

---

## Database Management

### Backup Database

**Automated Backups:**
Railway provides automatic daily backups for MySQL.

**Manual Backup:**
```bash
# Using Railway CLI
railway connect MySQL
mysqldump -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE > backup.sql
```

### Restore Database

```bash
railway connect MySQL
mysql -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < backup.sql
```

### Database Migrations

Add to package.json:
```json
{
  "scripts": {
    "db:migrate": "node scripts/migrate.js"
  }
}
```

Run on Railway:
```bash
railway run npm run db:migrate
```

---

## Troubleshooting

### Build Fails

**Check build logs:**
```bash
railway logs --deployment
```

**Common issues:**
- Missing dependencies: Check package.json
- TypeScript errors: Run `npm run build` locally first
- Node version mismatch: Verify Dockerfile uses Node 22

### Database Connection Failed

**Check environment variables:**
```bash
railway variables
```

**Verify MySQL is running:**
1. Go to MySQL service in dashboard
2. Check status (should be "Active")
3. View logs for errors

**Test connection:**
```bash
railway run node -e "const mysql = require('mysql2/promise'); mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD}).then(() => console.log('Connected!')).catch(console.error)"
```

### API Not Responding

**Check health endpoint:**
```bash
curl https://your-app.railway.app/health
```

**Check logs:**
```bash
railway logs --tail 50
```

**Common issues:**
- Port mismatch: Verify API_PORT=3000
- Firewall: Railway handles this automatically
- Startup timeout: Increase in Settings → Deploy

### High Memory Usage

**Check metrics:**
1. Go to Metrics tab
2. View memory usage graph

**Solutions:**
1. Increase memory limit (Settings → Resources)
2. Optimize code (reduce caching, fix memory leaks)
3. Enable horizontal scaling

---

## Cost Optimization

### Current Estimated Cost

| Resource | Usage | Monthly Cost |
|----------|-------|--------------|
| API Service | 24/7, 512MB RAM | $5 |
| MySQL Database | 1GB storage | $5 |
| Bandwidth | 100GB | $10 |
| **Total** | | **$20/month** |

### Optimization Tips

1. **Use caching** - Reduce database queries
2. **Implement rate limiting** - Prevent abuse
3. **Compress responses** - Reduce bandwidth
4. **Schedule collections** - Run during off-peak hours
5. **Use Railway's free tier** - $5 credit/month

---

## Security Best Practices

### Environment Variables

✅ **DO:**
- Store all secrets in Railway environment variables
- Rotate API keys regularly
- Use different keys for staging/production

❌ **DON'T:**
- Commit `.env` files to git
- Share API keys in logs
- Use production keys in development

### Database Security

✅ **DO:**
- Use Railway's private networking
- Enable SSL for external connections
- Limit database user permissions
- Regular backups

### API Security

✅ **DO:**
- Implement rate limiting
- Validate all inputs
- Use HTTPS only
- Add CORS restrictions
- Monitor for abuse

---

## Health Checks

### Built-in Health Check

Railway uses the Dockerfile HEALTHCHECK:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### External Monitoring

**UptimeRobot (Free):**
1. Sign up at https://uptimerobot.com
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://your-app.railway.app/health`
   - Interval: 5 minutes
3. Configure alerts (email, SMS, Slack)

**Better Uptime:**
1. Sign up at https://betteruptime.com
2. Add new monitor
3. Configure status page

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code pushed to GitHub
- [ ] All tests passing locally
- [ ] Environment variables documented
- [ ] Database schema ready
- [ ] API keys obtained

### Deployment

- [ ] Railway project created
- [ ] GitHub repo connected
- [ ] MySQL database added
- [ ] Environment variables configured
- [ ] Database schema initialized
- [ ] Health check passing

### Post-Deployment

- [ ] API responding correctly
- [ ] Database queries working
- [ ] Logs showing no errors
- [ ] Monitoring configured
- [ ] Custom domain added (optional)
- [ ] SSL certificate active
- [ ] Backups configured
- [ ] Documentation updated

---

## Support

### Railway Support

- **Documentation:** https://docs.railway.app
- **Discord:** https://discord.gg/railway
- **Email:** team@railway.app

### Project Support

- **GitHub Issues:** https://github.com/yourusername/cfv-metrics-agent/issues
- **Documentation:** See README.md and DEPLOYMENT.md

---

## Next Steps

After successful Railway deployment:

1. **Deploy CFV Calculator** to Vercel (see separate guide)
2. **Configure integration** between services
3. **Setup monitoring** with Sentry/UptimeRobot
4. **Test end-to-end** functionality
5. **Update documentation** with production URLs

---

## Quick Reference

### Useful Commands

```bash
# View logs
railway logs

# View variables
railway variables

# Run command
railway run <command>

# Connect to MySQL
railway connect MySQL

# Restart service
railway restart

# View status
railway status
```

### Important URLs

- Railway Dashboard: https://railway.app/dashboard
- Project URL: https://railway.app/project/<project-id>
- API URL: https://your-app.up.railway.app
- Health Check: https://your-app.up.railway.app/health

---

**Deployment Time:** ~10-15 minutes  
**Monthly Cost:** ~$20  
**Uptime SLA:** 99.9%  
**Support:** 24/7 via Discord
