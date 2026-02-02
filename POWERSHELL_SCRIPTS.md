# PowerShell Automation Scripts for Windows

Complete guide to using PowerShell automation scripts for CFV Metrics Agent API key setup on Windows.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Script Descriptions](#script-descriptions)
- [Detailed Usage](#detailed-usage)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## Overview

Three PowerShell scripts automate the API key setup process for Windows users:

| Script | Purpose | Time | Automation Level |
|--------|---------|------|------------------|
| `Start-AccountCreation.ps1` | Account creation assistant | 20-30 min | Semi-automated |
| `Setup-ApiKeys.ps1` | API key configuration wizard | 15 min | Fully automated |
| `Test-ApiKeys.ps1` | API key validator | 1 min | Fully automated |

**Total Time**: ~35-45 minutes for complete setup

---

## Prerequisites

### System Requirements

- **Operating System**: Windows 10/11 or Windows Server 2016+
- **PowerShell**: Version 5.1 or higher (check with `$PSVersionTable.PSVersion`)
- **Internet Connection**: Required for API validation
- **Browser**: Any modern browser (Edge, Chrome, Firefox)

### Check PowerShell Version

```powershell
$PSVersionTable.PSVersion
```

Should show version 5.1 or higher.

### Execution Policy

You may need to allow script execution:

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow scripts (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Quick Start

### 1. Extract the Agent

```powershell
# Extract the archive
Expand-Archive -Path cfv-metrics-agent-with-automation.zip -DestinationPath C:\cfv-metrics-agent

# Navigate to project
cd C:\cfv-metrics-agent
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Create Accounts (if needed)

```powershell
.\scripts\Start-AccountCreation.ps1
```

### 4. Configure API Keys

```powershell
.\scripts\Setup-ApiKeys.ps1
```

### 5. Validate Configuration

```powershell
.\scripts\Test-ApiKeys.ps1
```

### 6. Test the Agent

```powershell
npm run test:standalone DASH
```

---

## Script Descriptions

### 1. Start-AccountCreation.ps1

**Purpose**: Guides you through creating accounts on CoinGecko, Etherscan, and GitHub.

**Features**:
- Opens registration pages automatically
- Provides step-by-step instructions
- Handles all three services
- Interactive service selection
- Security best practices included

**Automation Level**: Semi-automated (manual steps required for CAPTCHAs and email verification)

**Usage**:
```powershell
.\scripts\Start-AccountCreation.ps1
```

**What It Does**:
1. Opens browser to registration pages
2. Guides through form filling
3. Reminds about email verification
4. Shows where to find API keys
5. Provides next steps

**Manual Steps Required**:
- Fill in registration forms
- Complete CAPTCHAs
- Verify email addresses
- Copy API keys

---

### 2. Setup-ApiKeys.ps1

**Purpose**: Interactive wizard to configure and validate API keys.

**Features**:
- Real-time API key validation
- Automatic .env file creation/update
- Service-by-service configuration
- Comprehensive testing
- Optional agent test

**Automation Level**: Fully automated (after you have API keys)

**Usage**:
```powershell
.\scripts\Setup-ApiKeys.ps1
```

**What It Does**:
1. Checks prerequisites
2. Creates/loads .env file
3. For each service:
   - Opens documentation
   - Prompts for API key
   - Validates key immediately
   - Saves to .env if valid
4. Runs final verification
5. Optionally tests agent

**Example Output**:
```
═══════════════════════════════════════════════════════════════════
  CFV METRICS AGENT - API KEY SETUP WIZARD
═══════════════════════════════════════════════════════════════════

✓ Project directory found: C:\cfv-metrics-agent
✓ .env file created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. CoinGecko API Key Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ Testing CoinGecko API key...
✓ CoinGecko API key is valid!
  Response: (V3) To the Moon!
✓ CoinGecko API key saved to .env

Total services: 3
Configured: 3/3
Valid: 3/3

✓ All configured API keys are valid! ✨
```

---

### 3. Test-ApiKeys.ps1

**Purpose**: Validates all configured API keys and generates diagnostic reports.

**Features**:
- Tests all three services
- Shows rate limits and quotas
- Generates JSON report
- Color-coded output
- Exit code for CI/CD integration

**Automation Level**: Fully automated

**Usage**:
```powershell
.\scripts\Test-ApiKeys.ps1
```

**What It Does**:
1. Loads .env file
2. Tests each configured API key
3. Shows detailed results
4. Generates JSON report
5. Returns exit code (0 = success, 1 = failure)

**Example Output**:
```
═══════════════════════════════════════════════════════════════════
  CFV METRICS AGENT - API KEY VALIDATOR
═══════════════════════════════════════════════════════════════════

ℹ Testing CoinGecko API key...
✓ CoinGecko: API key is valid
  response: (V3) To the Moon!

ℹ Testing Etherscan API key...
✓ Etherscan: API key is valid
  eth_price: $3,245.67

ℹ Testing GitHub token...
✓ GitHub: Token is valid
  rate_limit: 5000 requests/hour
  remaining: 4998 requests remaining
  reset_time: 2026-02-02 14:30:00

Total services: 3
Configured: 3/3
Valid: 3/3

✓ All configured API keys are valid! ✨

✓ Report saved to: C:\cfv-metrics-agent\api-keys-validation-report.json
```

**Report Format** (`api-keys-validation-report.json`):
```json
{
  "timestamp": "2026-02-02T13:45:23.456",
  "results": {
    "coingecko": {
      "valid": true,
      "status": "valid",
      "message": "API key is valid",
      "details": {
        "response": "(V3) To the Moon!"
      }
    },
    "etherscan": {
      "valid": true,
      "status": "valid",
      "message": "API key is valid",
      "details": {
        "eth_price": "$3,245.67"
      }
    },
    "github": {
      "valid": true,
      "status": "valid",
      "message": "Token is valid",
      "details": {
        "rate_limit": "5000 requests/hour",
        "remaining": "4998 requests remaining",
        "reset_time": "2026-02-02 14:30:00"
      }
    }
  }
}
```

---

## Detailed Usage

### Workflow 1: Complete Setup (New User)

```powershell
# Step 1: Create accounts
.\scripts\Start-AccountCreation.ps1
# Follow prompts, create accounts, get API keys

# Step 2: Configure keys
.\scripts\Setup-ApiKeys.ps1
# Enter keys when prompted

# Step 3: Validate
.\scripts\Test-ApiKeys.ps1
# Verify all keys work

# Step 4: Test agent
npm run test:standalone DASH
```

### Workflow 2: Update Existing Keys

```powershell
# Option A: Use wizard
.\scripts\Setup-ApiKeys.ps1

# Option B: Edit .env manually
notepad .env
# Then validate
.\scripts\Test-ApiKeys.ps1
```

### Workflow 3: CI/CD Integration

```powershell
# In your CI/CD pipeline
.\scripts\Test-ApiKeys.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Error "API key validation failed"
    exit 1
}
```

---

## Troubleshooting

### Issue: "Execution Policy" Error

**Error**:
```
.\Setup-ApiKeys.ps1 : File cannot be loaded because running scripts is disabled on this system.
```

**Solution**:
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass
PowerShell -ExecutionPolicy Bypass -File .\scripts\Setup-ApiKeys.ps1
```

---

### Issue: "Cannot find path" Error

**Error**:
```
Cannot find path 'C:\cfv-metrics-agent\.env'
```

**Solution**:
```powershell
# Ensure you're in the project directory
cd C:\cfv-metrics-agent

# Run script with full path
.\scripts\Setup-ApiKeys.ps1
```

---

### Issue: API Key Validation Fails

**Error**:
```
✗ CoinGecko: Validation failed
  error: 401 Unauthorized
```

**Solutions**:

1. **Check key format**:
   - CoinGecko: `CG-xxxxxxxxxxxxxxxxxxxx`
   - Etherscan: `ABCDEFGHIJK1234567890ABCDEFGHIJK`
   - GitHub: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **Verify key is active**:
   - Log in to service dashboard
   - Check if key exists and is enabled

3. **Check rate limits**:
   - You may have exceeded free tier limits
   - Wait for rate limit reset

4. **Test manually**:
   ```powershell
   # CoinGecko
   Invoke-RestMethod -Uri "https://api.coingecko.com/api/v3/ping" `
       -Headers @{"x-cg-demo-api-key" = "YOUR_KEY"}
   
   # Etherscan
   Invoke-RestMethod -Uri "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=YOUR_KEY"
   
   # GitHub
   Invoke-RestMethod -Uri "https://api.github.com/rate_limit" `
       -Headers @{"Authorization" = "token YOUR_TOKEN"}
   ```

---

### Issue: Browser Doesn't Open

**Error**:
```
✗ Failed to open browser
```

**Solution**:
```powershell
# Manually visit the URL shown in the error message
# Or set default browser
Start-Process "https://www.coingecko.com/en/api/pricing"
```

---

### Issue: .env File Permissions

**Error**:
```
Access to the path '.env' is denied
```

**Solution**:
```powershell
# Check file permissions
Get-Acl .env | Format-List

# Grant full control
$Acl = Get-Acl .env
$Permission = "$env:USERNAME","FullControl","Allow"
$AccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $Permission
$Acl.SetAccessRule($AccessRule)
Set-Acl .env $Acl
```

---

## Security Best Practices

### 1. Protect Your API Keys

**DO**:
- ✅ Store keys in `.env` file (not tracked by Git)
- ✅ Use password manager for backup
- ✅ Set appropriate expiration dates
- ✅ Use minimal required permissions
- ✅ Rotate keys regularly (every 90 days)

**DON'T**:
- ❌ Commit `.env` to Git
- ❌ Share keys in chat/email
- ❌ Use keys in public code
- ❌ Grant excessive permissions
- ❌ Use same key across projects

### 2. .env File Security

```powershell
# Ensure .env is in .gitignore
Add-Content .gitignore ".env"

# Set restrictive permissions
icacls .env /inheritance:r /grant:r "$env:USERNAME:F"

# Verify .env is not tracked
git status
```

### 3. Key Rotation

```powershell
# Every 90 days:
# 1. Generate new keys
.\scripts\Start-AccountCreation.ps1

# 2. Update .env
.\scripts\Setup-ApiKeys.ps1

# 3. Validate
.\scripts\Test-ApiKeys.ps1

# 4. Delete old keys from service dashboards
```

### 4. Monitor Usage

```powershell
# Check rate limits regularly
.\scripts\Test-ApiKeys.ps1

# Review API usage in dashboards:
# - CoinGecko: https://www.coingecko.com/en/developers/dashboard
# - Etherscan: https://etherscan.io/myapikey
# - GitHub: https://github.com/settings/tokens
```

### 5. Incident Response

**If keys are compromised**:

1. **Immediately revoke**:
   - CoinGecko: Delete key in dashboard
   - Etherscan: Delete key in dashboard
   - GitHub: Revoke token in settings

2. **Generate new keys**:
   ```powershell
   .\scripts\Start-AccountCreation.ps1
   ```

3. **Update configuration**:
   ```powershell
   .\scripts\Setup-ApiKeys.ps1
   ```

4. **Review logs**:
   - Check for unauthorized usage
   - Look for unusual API calls
   - Review rate limit history

---

## Advanced Usage

### Automated Setup (Non-Interactive)

```powershell
# Set environment variables
$env:COINGECKO_API_KEY = "CG-your-key-here"
$env:ETHERSCAN_API_KEY = "your-etherscan-key"
$env:GITHUB_TOKEN = "ghp_your-github-token"

# Create .env file
@"
COINGECKO_API_KEY=$env:COINGECKO_API_KEY
ETHERSCAN_API_KEY=$env:ETHERSCAN_API_KEY
GITHUB_TOKEN=$env:GITHUB_TOKEN
REDIS_URL=redis://localhost:6379
"@ | Set-Content .env

# Validate
.\scripts\Test-ApiKeys.ps1
```

### Scheduled Validation

```powershell
# Create scheduled task to validate keys daily
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\cfv-metrics-agent\scripts\Test-ApiKeys.ps1"

$Trigger = New-ScheduledTaskTrigger -Daily -At 9am

Register-ScheduledTask -TaskName "CFV-ValidateKeys" `
    -Action $Action -Trigger $Trigger `
    -Description "Validate CFV Metrics Agent API keys daily"
```

### Logging

```powershell
# Enable transcript logging
Start-Transcript -Path "C:\cfv-metrics-agent\logs\setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

.\scripts\Setup-ApiKeys.ps1

Stop-Transcript
```

---

## Support

### Get Help

```powershell
# Show script help
Get-Help .\scripts\Setup-ApiKeys.ps1 -Full
Get-Help .\scripts\Test-ApiKeys.ps1 -Full
Get-Help .\scripts\Start-AccountCreation.ps1 -Full
```

### Report Issues

If you encounter issues:

1. Run validation with verbose output:
   ```powershell
   .\scripts\Test-ApiKeys.ps1 -Verbose
   ```

2. Check the generated report:
   ```powershell
   Get-Content api-keys-validation-report.json | ConvertFrom-Json | Format-List
   ```

3. Provide error details when reporting issues

---

## Summary

| Task | Command | Time |
|------|---------|------|
| Create accounts | `.\scripts\Start-AccountCreation.ps1` | 20-30 min |
| Configure keys | `.\scripts\Setup-ApiKeys.ps1` | 15 min |
| Validate keys | `.\scripts\Test-ApiKeys.ps1` | 1 min |
| Test agent | `npm run test:standalone DASH` | 1-2 min |

**Total**: ~35-45 minutes for complete setup

---

## Next Steps

After completing the setup:

1. **Test the agent**: `npm run test:standalone DASH`
2. **Integrate with CFV Calculator**: Copy collectors to your project
3. **Monitor usage**: Check rate limits regularly
4. **Rotate keys**: Every 90 days

For more information, see:
- [README.md](README.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [API_KEYS_GUIDE.md](API_KEYS_GUIDE.md) - Detailed API key guide
