<#
.SYNOPSIS
    CFV Metrics Agent - Account Creation Assistant (PowerShell)

.DESCRIPTION
    Semi-automated browser assistance for creating accounts on CoinGecko, Etherscan, and GitHub.
    Opens registration pages and provides step-by-step guidance.

.EXAMPLE
    .\Start-AccountCreation.ps1

.NOTES
    Requires PowerShell 5.1 or higher
    Full automation is not possible due to CAPTCHAs and email verification
#>

# Requires PowerShell 5.1+
#Requires -Version 5.1

# Set strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Color functions
function Write-Header {
    param([string]$Text)
    Write-Host "`n$('═' * 70)" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "$('═' * 70)`n" -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Text)
    Write-Host "`n$('━' * 70)" -ForegroundColor Blue
    Write-Host "  $Text" -ForegroundColor Blue
    Write-Host "$('━' * 70)`n" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Text
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $Text
}

function Write-Warning-Custom {
    param([string]$Text)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Text
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ " -ForegroundColor Cyan -NoNewline
    Write-Host $Text
}

function Write-Step {
    param(
        [int]$Number,
        [string]$Text
    )
    Write-Host "$Number. " -ForegroundColor White -NoNewline
    Write-Host $Text
}

function Start-BrowserUrl {
    param([string]$Url)
    
    Write-Info "Opening: $Url"
    try {
        Start-Process $Url
        Start-Sleep -Seconds 2
        return $true
    }
    catch {
        Write-Error-Custom "Failed to open browser: $($_.Exception.Message)"
        Write-Warning-Custom "Please manually visit: $Url"
        return $false
    }
}

function Read-HostContinue {
    Read-Host "`nPress Enter to continue" | Out-Null
}

# CoinGecko guidance
function Start-CoinGeckoGuide {
    Write-Section "CoinGecko Account Creation"
    
    Write-Host "CoinGecko provides cryptocurrency market data."
    Write-Host "You'll need to create an account to get an API key.`n"
    
    Write-Step 1 "Choose your plan:"
    Write-Host "   • Demo (Free): 30 calls/minute, 10,000 calls/month"
    Write-Host "   • Analyst (`$129/month): 500 calls/minute, unlimited calls`n"
    
    $Plan = Read-Host "Which plan do you want? (demo/analyst)"
    
    if ($Plan -notin @('demo', 'analyst')) {
        $Plan = 'demo'
        Write-Info "Defaulting to Demo plan"
    }
    
    Write-Host ""
    Write-Step 2 "Opening CoinGecko API pricing page..."
    Start-BrowserUrl "https://www.coingecko.com/en/api/pricing"
    
    Write-Host ""
    Write-Step 3 "In your browser:"
    Write-Host "   • Click '" -NoNewline
    Write-Host "Get Started" -ForegroundColor Green -NoNewline
    Write-Host "' on the $($Plan.ToUpper()) plan"
    Write-Host "   • Fill in registration form:"
    Write-Host "     - Email address"
    Write-Host "     - Password"
    Write-Host "     - Full name"
    Write-Host "     - Company name (optional)"
    Write-Host "   • Complete CAPTCHA"
    Write-Host "   • Click 'Sign Up'"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 4 "Check your email for verification link"
    Write-Host "   • Look for email from CoinGecko"
    Write-Host "   • Click the verification link"
    Write-Host "   • Wait for account activation"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 5 "Opening API dashboard..."
    Start-BrowserUrl "https://www.coingecko.com/en/developers/dashboard"
    
    Write-Host ""
    Write-Step 6 "Generate your API key:"
    Write-Host "   • Click 'Generate API Key' or 'Create New Key'"
    Write-Host "   • Give it a name (e.g., 'CFV Metrics Agent')"
    Write-Host "   • Click 'Create'"
    Write-Host "   • " -NoNewline
    Write-Host "IMPORTANT: Copy the key immediately!" -ForegroundColor Red
    Write-Host "   • Key format: CG-xxxxxxxxxxxxxxxxxxxx"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Success "CoinGecko account creation complete!"
    Write-Info "Save your API key - you'll need it for the setup wizard"
}

# Etherscan guidance
function Start-EtherscanGuide {
    Write-Section "Etherscan Account Creation"
    
    Write-Host "Etherscan provides Ethereum blockchain data."
    Write-Host "Free plan includes 5 calls/second, 100,000 calls/day.`n"
    
    Write-Step 1 "Opening Etherscan..."
    Start-BrowserUrl "https://etherscan.io"
    
    Write-Host ""
    Write-Step 2 "In your browser:"
    Write-Host "   • Click 'Sign In' (top-right corner)"
    Write-Host "   • Click 'Click to sign up' (at bottom)"
    Write-Host "   • Fill in registration form:"
    Write-Host "     - Username (cannot be changed later!)"
    Write-Host "     - Email address"
    Write-Host "     - Password"
    Write-Host "     - Confirm password"
    Write-Host "   • Complete CAPTCHA"
    Write-Host "   • Accept Terms of Service"
    Write-Host "   • Click 'Create an Account'"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 3 "Check your email for verification link"
    Write-Host "   • Look for email from Etherscan"
    Write-Host "   • Click the verification link"
    Write-Host "   • Your account is now activated"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 4 "Opening API Keys page..."
    Start-BrowserUrl "https://etherscan.io/myapikey"
    
    Write-Host ""
    Write-Step 5 "Generate your API key:"
    Write-Host "   • Click '+ Add' button"
    Write-Host "   • Fill in the form:"
    Write-Host "     - AppName: 'CFV Metrics Agent'"
    Write-Host "     - Email: (confirm your email)"
    Write-Host "   • Complete CAPTCHA"
    Write-Host "   • Click 'Create New API Key'"
    Write-Host "   • Copy your API key"
    Write-Host "   • Key format: ABCDEFGHIJK1234567890ABCDEFGHIJK"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Success "Etherscan account creation complete!"
    Write-Info "Save your API key - you'll need it for the setup wizard"
}

# GitHub guidance
function Start-GitHubGuide {
    Write-Section "GitHub Personal Access Token Creation"
    
    Write-Host "GitHub token provides access to developer metrics."
    Write-Host "With token: 5,000 requests/hour (vs 60 without)`n"
    
    Write-Step 1 "Do you have a GitHub account?"
    $HasAccount = Read-Host "(y/n)"
    
    if ($HasAccount -ne 'y') {
        Write-Host ""
        Write-Info "Opening GitHub sign-up page..."
        Start-BrowserUrl "https://github.com/signup"
        Write-Host ""
        Write-Host "Create your GitHub account first, then return here."
        Read-HostContinue
    }
    
    Write-Host ""
    Write-Step 2 "Opening GitHub token settings..."
    Start-BrowserUrl "https://github.com/settings/tokens"
    
    Write-Host ""
    Write-Step 3 "In your browser:"
    Write-Host "   • Click 'Personal access tokens' → 'Tokens (classic)'"
    Write-Host "   • Click 'Generate new token' → 'Generate new token (classic)'"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 4 "Configure your token:"
    Write-Host "   • " -NoNewline
    Write-Host "Note: " -NoNewline
    Write-Host "'CFV Metrics Agent - Read Public Repos'"
    Write-Host "   • " -NoNewline
    Write-Host "Expiration: " -NoNewline
    Write-Host "Choose duration (90 days recommended)"
    Write-Host "   • " -NoNewline
    Write-Host "Scopes: " -NoNewline
    Write-Host "Check ONLY '" -NoNewline
    Write-Host "public_repo" -ForegroundColor Green -NoNewline
    Write-Host "'"
    Write-Host "   • " -NoNewline
    Write-Host "DO NOT check: " -ForegroundColor Red -NoNewline
    Write-Host "repo, admin:org, delete_repo, etc."
    Write-Host "   • Scroll down and click 'Generate token'"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Step 5 ""
    Write-Host "CRITICAL: Copy your token immediately!" -ForegroundColor Red
    Write-Host "   • Token format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    Write-Host "   • " -NoNewline
    Write-Host "You will NEVER see this token again!" -ForegroundColor Red
    Write-Host "   • If you lose it, you'll need to generate a new one"
    Write-Host "   • Save it to a password manager or secure note"
    
    Read-HostContinue
    
    Write-Host ""
    Write-Success "GitHub token creation complete!"
    Write-Info "Save your token - you'll need it for the setup wizard"
}

# Main function
function Start-Main {
    Write-Header "CFV METRICS AGENT - ACCOUNT CREATION ASSISTANT"
    
    Write-Host "This assistant will help you create accounts and obtain API keys."
    Write-Host "Due to CAPTCHAs and email verification, full automation is not possible."
    Write-Host "I'll open the correct pages and guide you through each step.`n"
    
    Write-Host "Services to set up:" -NoNewline
    Write-Host ""
    Write-Host "  1. CoinGecko (cryptocurrency data)"
    Write-Host "  2. Etherscan (blockchain data)"
    Write-Host "  3. GitHub (developer metrics)"
    Write-Host ""
    
    Write-Host "Time required: ~20-30 minutes" -ForegroundColor Yellow
    Write-Host "You'll need: Email address(es) for verification" -ForegroundColor Yellow
    Write-Host ""
    
    Read-HostContinue
    
    # Service selection
    Write-Section "Service Selection"
    
    $SetupCoinGecko = (Read-Host "Set up CoinGecko? (y/n)") -eq 'y'
    $SetupEtherscan = (Read-Host "Set up Etherscan? (y/n)") -eq 'y'
    $SetupGitHub = (Read-Host "Set up GitHub? (y/n)") -eq 'y'
    
    if (-not ($SetupCoinGecko -or $SetupEtherscan -or $SetupGitHub)) {
        Write-Warning-Custom "No services selected. Exiting."
        return
    }
    
    # Guide through each service
    if ($SetupCoinGecko) {
        Start-CoinGeckoGuide
    }
    
    if ($SetupEtherscan) {
        Start-EtherscanGuide
    }
    
    if ($SetupGitHub) {
        Start-GitHubGuide
    }
    
    # Final instructions
    Write-Section "Next Steps"
    
    Write-Host "You should now have API keys for the selected services."
    Write-Host ""
    Write-Step 1 "Run the setup wizard to configure your keys:"
    Write-Host "   " -NoNewline
    Write-Host "cd $PSScriptRoot\.." -ForegroundColor Cyan
    Write-Host "   " -NoNewline
    Write-Host ".\scripts\Setup-ApiKeys.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Step 2 "Or manually add keys to .env file:"
    Write-Host "   " -NoNewline
    Write-Host "notepad $PSScriptRoot\..\.env" -ForegroundColor Cyan
    Write-Host ""
    Write-Step 3 "Validate your keys:"
    Write-Host "   " -NoNewline
    Write-Host ".\scripts\Test-ApiKeys.ps1" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Success "Account creation assistant complete!"
    Write-Host ""
    Write-Host "Remember to save your API keys securely!" -NoNewline
    Write-Host ""
}

# Run main function
try {
    Start-Main
}
catch {
    Write-Host "`n" -NoNewline
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    $_.ScriptStackTrace | Write-Host -ForegroundColor Gray
    exit 1
}
