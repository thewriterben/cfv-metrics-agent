# CFV Metrics Agent - Automation Scripts Documentation

This document describes the automation scripts available for setting up and configuring API keys for the CFV Metrics Agent.

---

## 📋 Overview

Three automation scripts are provided to streamline the API key setup process:

1. **setup-api-keys.sh** - Interactive setup wizard (Bash)
2. **validate-keys.py** - API key validator (Python)
3. **auto-register.py** - Account creation assistant (Python)

---

## 1️⃣ Interactive Setup Wizard

### Script: `scripts/setup-api-keys.sh`

**Purpose**: Guides you through the entire API key setup process with validation and testing.

### Features

- ✅ Step-by-step guided setup
- ✅ Automatic browser opening
- ✅ Real-time API key validation
- ✅ Automatic .env file configuration
- ✅ Final verification tests
- ✅ Agent testing with real cryptocurrency

### Usage

```bash
cd /home/ubuntu/cfv-metrics-agent
./scripts/setup-api-keys.sh
```

### What It Does

1. **Checks Prerequisites**
   - Verifies project directory exists
   - Creates .env file if missing
   - Loads existing configuration

2. **CoinGecko Setup**
   - Opens pricing page in browser
   - Provides step-by-step instructions
   - Prompts for API key input
   - Validates key with live API call
   - Saves to .env file

3. **Etherscan Setup**
   - Opens Etherscan website
   - Guides through account creation
   - Prompts for API key input
   - Validates key with live API call
   - Saves to .env file

4. **GitHub Setup**
   - Opens token settings page
   - Explains scope requirements
   - Prompts for token input
   - Validates token with live API call
   - Saves to .env file

5. **Final Verification**
   - Tests all configured keys
   - Displays validation results
   - Shows rate limits and status

6. **Agent Testing**
   - Optionally tests agent with real crypto
   - Runs full CFV calculation
   - Displays results

### Example Session

```
╔═══════════════════════════════════════════════════════════════════╗
║          CFV METRICS AGENT - API KEY SETUP WIZARD                 ║
╚═══════════════════════════════════════════════════════════════════╝

This wizard will guide you through setting up API keys for:
  1. CoinGecko (cryptocurrency data)
  2. Etherscan (blockchain data)
  3. GitHub (developer metrics)

Time required: ~15 minutes
Cost: Free tiers available for all services

Press Enter to continue...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. CoinGecko API Key Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CoinGecko provides cryptocurrency market data including:
  • Prices and market caps
  • Community metrics (Twitter, Reddit, Telegram)
  • Developer statistics
  • Trading volume

Plans:
  • Demo (Free): 30 calls/minute, 10,000 calls/month
  • Analyst ($129/month): 500 calls/minute, unlimited calls

Do you want to set up CoinGecko API key? (y/n): y

ℹ Opening CoinGecko API pricing page...

Steps to get your API key:
  1. Click 'Get Started' on Demo or Analyst plan
  2. Create an account (verify email)
  3. Go to: https://www.coingecko.com/en/developers/dashboard
  4. Click 'Generate API Key'
  5. Copy the API key (starts with 'CG-')

Press Enter to continue...

Enter your CoinGecko API key:
CG-xxxxxxxxxxxxxxxxxxxx

ℹ Testing CoinGecko API key...
✓ CoinGecko API key is valid!
✓ CoinGecko API key saved to .env

[... continues for Etherscan and GitHub ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  4. Final Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Running comprehensive tests...

✓ .env file exists
ℹ Testing CoinGecko API key...
✓ CoinGecko API key is valid!

ℹ Testing Etherscan API key...
✓ Etherscan API key is valid!

ℹ Testing GitHub token...
✓ GitHub token is valid! (5000 requests/hour)

Total services: 3
Configured: 3/3
Valid: 3/3

✓ All configured API keys are valid! ✨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your API keys have been configured in:
  /home/ubuntu/cfv-metrics-agent/.env

Next steps:
  1. Review your configuration: cat /home/ubuntu/cfv-metrics-agent/.env
  2. Test the agent: cd /home/ubuntu/cfv-metrics-agent && npm run test:standalone DASH
  3. Integrate with CFV Calculator

✓ Setup wizard completed successfully!
```

### Validation Functions

The script includes built-in validation for each service:

**CoinGecko Validation:**
```bash
validate_coingecko_key() {
    curl -s "https://api.coingecko.com/api/v3/ping" \
        -H "x-cg-demo-api-key: $key"
}
```

**Etherscan Validation:**
```bash
validate_etherscan_key() {
    curl -s "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=$key"
}
```

**GitHub Validation:**
```bash
validate_github_token() {
    curl -s -H "Authorization: token $token" \
        "https://api.github.com/rate_limit"
}
```

---

## 2️⃣ API Key Validator

### Script: `scripts/validate-keys.py`

**Purpose**: Validates all configured API keys and generates detailed diagnostic reports.

### Features

- ✅ Validates all API keys
- ✅ Checks rate limits
- ✅ Tests API connectivity
- ✅ Generates JSON report
- ✅ Color-coded output
- ✅ Detailed error messages

### Usage

```bash
cd /home/ubuntu/cfv-metrics-agent
./scripts/validate-keys.py
```

Or with Python directly:
```bash
python3 scripts/validate-keys.py
```

### What It Does

1. **Loads Configuration**
   - Reads .env file
   - Extracts API keys
   - Validates file format

2. **Tests Each Service**
   - CoinGecko: Ping endpoint + rate limits
   - Etherscan: ETH price endpoint + status
   - GitHub: Rate limit endpoint + permissions

3. **Generates Report**
   - Validation status for each key
   - Rate limit information
   - Remaining requests
   - Reset times
   - Detailed error messages

4. **Saves Results**
   - Creates JSON report file
   - Includes timestamp
   - Full diagnostic data

### Example Output

```
╔═══════════════════════════════════════════════════════════════════╗
║          CFV METRICS AGENT - API KEY VALIDATOR                    ║
╚═══════════════════════════════════════════════════════════════════╝

ℹ Project directory: /home/ubuntu/cfv-metrics-agent
ℹ Environment file: /home/ubuntu/cfv-metrics-agent/.env

✓ Loaded 15 environment variables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Validating API Keys
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing CoinGecko API key...
ℹ Testing CoinGecko API key...
✓ CoinGecko: API key is valid
  response: (V3) To the Moon!
  rate_limit: 30
  rate_remaining: 29

Testing Etherscan API key...
ℹ Testing Etherscan API key...
✓ Etherscan: API key is valid
  eth_price: $3,245.67

Testing GitHub token...
ℹ Testing GitHub token...
✓ GitHub: Token is valid
  rate_limit: 5000 requests/hour
  remaining: 4998 requests remaining
  reset_time: 2026-02-02 03:45:12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total services: 3
Configured: 3/3
Valid: 3/3

✓ All configured API keys are valid! ✨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Detailed Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Report saved to: /home/ubuntu/cfv-metrics-agent/api-keys-validation-report.json

Report contents:
{
  "timestamp": "2026-02-02T02:30:45.123456",
  "results": {
    "coingecko": {
      "valid": true,
      "status": "valid",
      "message": "API key is valid",
      "details": {
        "response": "(V3) To the Moon!",
        "rate_limit": "30",
        "rate_remaining": "29"
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
        "reset_time": "2026-02-02 03:45:12"
      }
    }
  }
}
```

### Status Codes

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `valid` | ✅ Key is working | None |
| `invalid` | ❌ Key is wrong/expired | Regenerate key |
| `not_configured` | ⚠️ Key not set | Add key to .env |
| `rate_limited` | ⚠️ Too many requests | Wait or upgrade plan |
| `timeout` | ⚠️ Request timed out | Check internet connection |
| `error` | ❌ Other error | Check error message |

### Exit Codes

- `0`: All configured keys are valid
- `1`: Some keys failed validation or not configured

---

## 3️⃣ Account Creation Assistant

### Script: `scripts/auto-register.py`

**Purpose**: Semi-automated browser assistance for creating accounts.

### Features

- ✅ Opens correct registration pages
- ✅ Step-by-step guidance
- ✅ Browser automation assistance
- ✅ Plan selection guidance
- ✅ Scope configuration help

### Usage

```bash
cd /home/ubuntu/cfv-metrics-agent
./scripts/auto-register.py
```

Or with Python directly:
```bash
python3 scripts/auto-register.py
```

### What It Does

1. **Service Selection**
   - Choose which services to set up
   - CoinGecko, Etherscan, GitHub

2. **CoinGecko Guidance**
   - Opens pricing page
   - Explains plan differences
   - Guides through registration
   - Helps with email verification
   - Opens API dashboard
   - Guides API key generation

3. **Etherscan Guidance**
   - Opens Etherscan homepage
   - Guides through sign-up
   - Helps with email verification
   - Opens API keys page
   - Guides key generation

4. **GitHub Guidance**
   - Checks if account exists
   - Opens token settings
   - Explains scope requirements
   - Guides token generation
   - Warns about token visibility

5. **Next Steps**
   - Provides commands to run
   - Links to setup wizard
   - Reminds to save keys securely

### Example Session

```
╔═══════════════════════════════════════════════════════════════════╗
║     CFV METRICS AGENT - ACCOUNT CREATION ASSISTANT                ║
╚═══════════════════════════════════════════════════════════════════╝

This assistant will help you create accounts and obtain API keys.
Due to CAPTCHAs and email verification, full automation is not possible.
I'll open the correct pages and guide you through each step.

Services to set up:
  1. CoinGecko (cryptocurrency data)
  2. Etherscan (blockchain data)
  3. GitHub (developer metrics)

Time required: ~20-30 minutes
You'll need: Email address(es) for verification

Press Enter to continue...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Service Selection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set up CoinGecko? (y/n): y
Set up Etherscan? (y/n): y
Set up GitHub? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CoinGecko Account Creation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CoinGecko provides cryptocurrency market data.
You'll need to create an account to get an API key.

1. Choose your plan:
   • Demo (Free): 30 calls/minute, 10,000 calls/month
   • Analyst ($129/month): 500 calls/minute, unlimited calls

Which plan do you want? (demo/analyst): demo

2. Opening CoinGecko API pricing page...
ℹ Opening: https://www.coingecko.com/en/api/pricing

3. In your browser:
   • Click 'Get Started' on the Demo plan
   • Fill in registration form:
     - Email address
     - Password
     - Full name
     - Company name (optional)
   • Complete CAPTCHA
   • Click 'Sign Up'

Press Enter to continue...

4. Check your email for verification link
   • Look for email from CoinGecko
   • Click the verification link
   • Wait for account activation

Press Enter to continue...

5. Opening API dashboard...
ℹ Opening: https://www.coingecko.com/en/developers/dashboard

6. Generate your API key:
   • Click 'Generate API Key' or 'Create New Key'
   • Give it a name (e.g., 'CFV Metrics Agent')
   • Click 'Create'
   • IMPORTANT: Copy the key immediately!
   • Key format: CG-xxxxxxxxxxxxxxxxxxxx

Press Enter to continue...

✓ CoinGecko account creation complete!
ℹ Save your API key - you'll need it for the setup wizard

[... continues for Etherscan and GitHub ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You should now have API keys for the selected services.

1. Run the setup wizard to configure your keys:
   cd /home/ubuntu/cfv-metrics-agent
   ./scripts/setup-api-keys.sh

2. Or manually add keys to .env file:
   nano /home/ubuntu/cfv-metrics-agent/.env

3. Validate your keys:
   ./scripts/validate-keys.py

✓ Account creation assistant complete!

Remember to save your API keys securely!
```

### Limitations

**Cannot Automate:**
- ❌ CAPTCHA solving
- ❌ Email verification
- ❌ Password creation
- ❌ Form filling (security reasons)

**Can Assist With:**
- ✅ Opening correct pages
- ✅ Step-by-step guidance
- ✅ Plan selection advice
- ✅ Scope configuration
- ✅ Best practices

---

## 🔄 Recommended Workflow

### For New Users (No Accounts)

```bash
# Step 1: Create accounts
./scripts/auto-register.py

# Step 2: Configure keys
./scripts/setup-api-keys.sh

# Step 3: Validate (optional, already done in step 2)
./scripts/validate-keys.py

# Step 4: Test agent
npm run test:standalone DASH
```

### For Existing Users (Have Accounts)

```bash
# Step 1: Configure keys
./scripts/setup-api-keys.sh

# Step 2: Validate
./scripts/validate-keys.py

# Step 3: Test agent
npm run test:standalone DASH
```

### For Manual Configuration

```bash
# Step 1: Edit .env file
nano .env

# Step 2: Add your keys
COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxx
ETHERSCAN_API_KEY=ABCDEFGHIJK1234567890ABCDEFGHIJK
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Step 3: Validate
./scripts/validate-keys.py

# Step 4: Test agent
npm run test:standalone DASH
```

---

## 🐛 Troubleshooting

### Script Won't Run

**Problem**: Permission denied

**Solution**:
```bash
chmod +x scripts/*.sh scripts/*.py
```

### Browser Won't Open

**Problem**: `xdg-open` or `open` command not found

**Solution**: Manually visit the URLs shown in the output

### Validation Fails

**Problem**: API key validation returns errors

**Solutions**:
1. Check for typos in .env file
2. Verify no extra spaces around keys
3. Ensure key hasn't expired (GitHub tokens)
4. Test key manually with curl commands
5. Regenerate key if necessary

### Rate Limit Errors

**Problem**: 429 Too Many Requests

**Solutions**:
1. Wait 1 minute before retrying
2. Upgrade to paid plan
3. Increase cache TTLs in .env

---

## 📝 Script Maintenance

### Adding New Services

To add support for a new API service:

1. **Update setup-api-keys.sh**:
   ```bash
   setup_newservice() {
       # Add setup function
   }
   
   validate_newservice_key() {
       # Add validation function
   }
   ```

2. **Update validate-keys.py**:
   ```python
   def validate_newservice(api_key):
       # Add validation logic
       pass
   ```

3. **Update auto-register.py**:
   ```python
   def guide_newservice():
       # Add guidance function
       pass
   ```

4. **Update documentation**:
   - Add to API_KEYS_GUIDE.md
   - Update this file
   - Update README.md

### Testing Scripts

```bash
# Test setup wizard (dry run)
./scripts/setup-api-keys.sh

# Test validator with test keys
COINGECKO_API_KEY=test ./scripts/validate-keys.py

# Test account assistant
./scripts/auto-register.py
```

---

## 📚 Related Documentation

- **API_KEYS_GUIDE.md** - Detailed manual setup instructions
- **README.md** - Project overview and usage
- **DEPLOYMENT.md** - Deployment guide
- **.env.example** - Environment variables template

---

## ✅ Summary

| Script | Purpose | Time | Automation Level |
|--------|---------|------|------------------|
| setup-api-keys.sh | Full setup wizard | 15 min | Semi-automated |
| validate-keys.py | Validate keys | 1 min | Fully automated |
| auto-register.py | Account creation | 20 min | Assisted |

**Best Practice**: Use all three scripts in sequence for the smoothest experience.

1. `auto-register.py` - Create accounts
2. `setup-api-keys.sh` - Configure keys
3. `validate-keys.py` - Verify setup

This ensures a complete, validated setup with minimal manual effort.
