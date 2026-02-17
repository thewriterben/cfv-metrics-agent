# API Authentication Setup Guide

This document describes how to configure and use API authentication for the CFV Metrics Agent API.

## Overview

The API now includes comprehensive authentication and authorization to protect against:
- Unauthorized access to sensitive data
- Abuse and denial of service attacks
- Aggressive data scraping
- Exhaustion of external API rate limits

## Features

### 1. **API Key Authentication**
- Support for multiple API keys
- Two levels of access: regular and admin
- API keys can be provided via `X-API-Key` header or `Authorization: Bearer` header

### 2. **Per-Key Rate Limiting**
- Rate limits are tracked per API key (not per IP)
- Different limits for different endpoint types
- Falls back to IP-based limiting when no API key is provided

### 3. **Endpoint Protection Levels**

#### Public Endpoints (No Auth Required)
- `GET /health` - Health check endpoint

#### Optional Auth Endpoints (Better limits with auth)
- `GET /api/coins` - List all coins
- `GET /api/metrics` - Get all latest metrics
- `GET /api/metrics/:symbol/history` - Get metrics history
- `GET /api/collection-runs` - Get collection run summary
- `GET /api/summary` - Get metrics summary

#### Protected Endpoints (Auth Required)
- `GET /api/metrics/:symbol` - Get specific coin metrics
- `POST /api/collect/:symbol` - Trigger collection for specific coin

#### Admin-Only Endpoints (Admin Auth Required)
- `POST /api/collect` - Trigger full collection run for all coins

## Configuration

### 1. Generate API Keys

Generate secure random keys for your API keys. You can use any secure random generator:

```bash
# Generate a secure API key
openssl rand -hex 32
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Regular API Keys (comma-separated)
API_KEYS=your-api-key-1,your-api-key-2,your-api-key-3

# Admin API Keys (comma-separated, have elevated privileges)
ADMIN_API_KEYS=your-admin-key-1,your-admin-key-2

# Optional: Configure rate limits (defaults shown)
RATE_LIMIT_API_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_API_MAX_REQUESTS=100        # 100 requests per window
RATE_LIMIT_STRICT_WINDOW_MS=60000      # 1 minute
RATE_LIMIT_STRICT_MAX_REQUESTS=10      # 10 requests per minute
```

### 3. Restart the Server

After configuring environment variables, restart the API server for changes to take effect.

## Using the API

### With X-API-Key Header

```bash
curl -H "X-API-Key: your-api-key-here" \
  https://your-api-domain.com/api/metrics/BTC
```

### With Authorization Bearer Header

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  https://your-api-domain.com/api/metrics/BTC
```

### JavaScript Example

```javascript
const apiKey = 'your-api-key-here';

// Using fetch
const response = await fetch('https://your-api-domain.com/api/metrics/BTC', {
  headers: {
    'X-API-Key': apiKey
  }
});

const data = await response.json();
```

### Python Example

```python
import requests

api_key = 'your-api-key-here'
headers = {'X-API-Key': api_key}

response = requests.get(
    'https://your-api-domain.com/api/metrics/BTC',
    headers=headers
)

data = response.json()
```

## Rate Limiting

### Rate Limit Headers

All authenticated requests include rate limit information in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-02-17T18:15:00.000Z
```

### Rate Limit Tiers

1. **IP-Based (No Auth)**
   - 100 requests per 15 minutes per IP
   - 10 requests per minute for expensive operations

2. **API Key-Based**
   - 100 requests per 15 minutes per key
   - 10 requests per minute for expensive operations
   - Independent tracking per key

3. **Admin Keys**
   - Same rate limits as regular keys
   - Access to admin-only endpoints

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": "42 seconds"
}
```

## Security Best Practices

### 1. **Key Management**
- Generate strong, random API keys (at least 32 characters)
- Store keys securely (use environment variables, never commit to git)
- Rotate keys periodically
- Revoke compromised keys immediately

### 2. **Key Distribution**
- Distribute different keys to different users/applications
- Use admin keys only for trusted automation
- Monitor key usage for suspicious activity

### 3. **Network Security**
- Always use HTTPS in production
- Consider IP whitelisting for admin keys
- Implement additional security layers (WAF, DDoS protection)

### 4. **Monitoring**
- Monitor API usage per key
- Set up alerts for unusual patterns
- Log authentication failures

## Troubleshooting

### 401 Unauthorized

**Error:**
```json
{
  "success": false,
  "error": "Authentication required. Please provide a valid API key"
}
```

**Solutions:**
- Check that you're including the API key in the request header
- Verify the API key is configured in the server's environment variables
- Ensure the API key matches exactly (no extra spaces or characters)

### 403 Forbidden

**Error:**
```json
{
  "success": false,
  "error": "Admin privileges required"
}
```

**Solutions:**
- This endpoint requires an admin API key
- Use a key from the `ADMIN_API_KEYS` environment variable
- Contact your administrator for admin access

### 429 Too Many Requests

**Error:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": "30 seconds"
}
```

**Solutions:**
- Wait for the specified `retryAfter` period
- Implement exponential backoff in your client
- Request a higher rate limit if needed
- Use different API keys for different applications

## Migration Guide

### For Existing Installations

If you're upgrading from a version without authentication:

1. **Read-only endpoints remain accessible without auth** (but with rate limits)
2. **State-modifying endpoints now require authentication**
3. **Add API keys to your environment configuration**
4. **Update client applications to include API keys**

### Backward Compatibility

- Health check endpoint (`/health`) remains public
- Read-only endpoints accept requests without auth (with strict rate limits)
- Authentication is required only for:
  - State-modifying operations (POST requests)
  - Data-intensive operations
  - Admin operations

## Example Integration

### Simple Node.js Client

```javascript
class CFVMetricsClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getMetrics(symbol) {
    const response = await fetch(`${this.baseUrl}/api/metrics/${symbol}`, {
      headers: {
        'X-API-Key': this.apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        const data = await response.json();
        throw new Error(`Rate limited. ${data.retryAfter}`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async triggerCollection(symbol) {
    const response = await fetch(`${this.baseUrl}/api/collect/${symbol}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Collection failed: ${response.status}`);
    }

    return response.json();
  }
}

// Usage
const client = new CFVMetricsClient('your-api-key', 'https://api.example.com');
const metrics = await client.getMetrics('BTC');
```

## Support

For questions or issues with authentication:
1. Check this documentation
2. Review the `.env.example` file for configuration examples
3. Check server logs for authentication errors
4. Open an issue on GitHub

## Security Disclosure

If you discover a security vulnerability, please report it privately to the maintainers. Do not disclose security issues publicly until they have been addressed.
