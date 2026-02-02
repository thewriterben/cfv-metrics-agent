<#
.SYNOPSIS
    CFV Metrics Agent - API Key Setup Wizard (PowerShell)

.DESCRIPTION
    Interactive wizard to set up API keys for CoinGecko, Etherscan, and GitHub.
    Validates keys in real-time and configures the .env file automatically.

.EXAMPLE
    .\Setup-ApiKeys.ps1

.NOTES
    Requires PowerShell 5.1 or higher
    Internet connection required for API validation
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
    Write-Host "  $Text" -ForegroundColor Cyan -NoNewline
    Write-Host ""
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

# Get project directory
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $ProjectDir ".env"

Write-Header "CFV METRICS AGENT - API KEY SETUP WIZARD"

Write-Host "This wizard will guide you through setting up API keys for:"
Write-Host "  1. CoinGecko (cryptocurrency data)"
Write-Host "  2. Etherscan (blockchain data)"
Write-Host "  3. GitHub (developer metrics)"
Write-Host ""
Write-Host "Time required: ~15 minutes" -ForegroundColor Yellow
Write-Host "Cost: Free tiers available for all services`n" -ForegroundColor Yellow

Read-Host "Press Enter to continue"

# Check prerequisites
Write-Section "Checking Prerequisites"

if (-not (Test-Path $ProjectDir)) {
    Write-Error-Custom "Project directory not found: $ProjectDir"
    exit 1
}
Write-Success "Project directory found: $ProjectDir"

# Create .env file if it doesn't exist
if (-not (Test-Path $EnvFile)) {
    Write-Info "Creating .env file..."
    New-Item -Path $EnvFile -ItemType File -Force | Out-Null
    Write-Success ".env file created"
} else {
    Write-Success ".env file exists"
}

# Load existing .env
$EnvVars = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $EnvVars[$matches[1]] = $matches[2]
        }
    }
}

# Function to update .env file
function Update-EnvFile {
    param(
        [string]$Key,
        [string]$Value
    )
    
    $EnvVars[$Key] = $Value
    
    $Content = $EnvVars.GetEnumerator() | ForEach-Object {
        "$($_.Key)=$($_.Value)"
    } | Sort-Object
    
    $Content | Set-Content -Path $EnvFile
}

# Function to validate CoinGecko API key
function Test-CoinGeckoKey {
    param([string]$ApiKey)
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.coingecko.com/api/v3/ping" `
            -Headers @{"x-cg-demo-api-key" = $ApiKey} `
            -TimeoutSec 10
        
        if ($Response.gecko_says) {
            return @{
                Valid = $true
                Message = $Response.gecko_says
            }
        }
        return @{Valid = $false; Message = "Invalid response"}
    }
    catch {
        return @{Valid = $false; Message = $_.Exception.Message}
    }
}

# Function to validate Etherscan API key
function Test-EtherscanKey {
    param([string]$ApiKey)
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=$ApiKey" `
            -TimeoutSec 10
        
        if ($Response.status -eq "1") {
            return @{
                Valid = $true
                Message = "ETH Price: `$$($Response.result.ethusd)"
            }
        }
        return @{Valid = $false; Message = $Response.message}
    }
    catch {
        return @{Valid = $false; Message = $_.Exception.Message}
    }
}

# Function to validate GitHub token
function Test-GitHubToken {
    param([string]$Token)
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.github.com/rate_limit" `
            -Headers @{"Authorization" = "token $Token"} `
            -TimeoutSec 10
        
        return @{
            Valid = $true
            Message = "Rate limit: $($Response.rate.limit) requests/hour"
            Remaining = $Response.rate.remaining
        }
    }
    catch {
        return @{Valid = $false; Message = $_.Exception.Message}
    }
}

# CoinGecko Setup
Write-Section "1. CoinGecko API Key Setup"

Write-Host "CoinGecko provides cryptocurrency market data including:"
Write-Host "  • Prices and market caps"
Write-Host "  • Community metrics (Twitter, Reddit, Telegram)"
Write-Host "  • Developer statistics"
Write-Host "  • Trading volume`n"

Write-Host "Plans:"
Write-Host "  • Demo (Free): 30 calls/minute, 10,000 calls/month"
Write-Host "  • Analyst (`$129/month): 500 calls/minute, unlimited calls`n"

$SetupCoinGecko = Read-Host "Do you want to set up CoinGecko API key? (y/n)"

if ($SetupCoinGecko -eq 'y') {
    Write-Info "Opening CoinGecko API pricing page..."
    Start-Process "https://www.coingecko.com/en/api/pricing"
    
    Write-Host "`nSteps to get your API key:"
    Write-Step 1 "Click 'Get Started' on Demo or Analyst plan"
    Write-Step 2 "Create an account (verify email)"
    Write-Step 3 "Go to: https://www.coingecko.com/en/developers/dashboard"
    Write-Step 4 "Click 'Generate API Key'"
    Write-Step 5 "Copy the API key (starts with 'CG-')`n"
    
    Read-Host "Press Enter to continue"
    
    $CoinGeckoKey = Read-Host "`nEnter your CoinGecko API key"
    
    if ($CoinGeckoKey) {
        Write-Info "Testing CoinGecko API key..."
        $Result = Test-CoinGeckoKey -ApiKey $CoinGeckoKey
        
        if ($Result.Valid) {
            Write-Success "CoinGecko API key is valid!"
            Write-Host "  Response: $($Result.Message)" -ForegroundColor Gray
            Update-EnvFile -Key "COINGECKO_API_KEY" -Value $CoinGeckoKey
            Write-Success "CoinGecko API key saved to .env"
        }
        else {
            Write-Error-Custom "CoinGecko API key validation failed: $($Result.Message)"
            Write-Warning-Custom "Key was not saved. Please check and try again."
        }
    }
}

# Etherscan Setup
Write-Section "2. Etherscan API Key Setup"

Write-Host "Etherscan provides Ethereum blockchain data including:"
Write-Host "  • Transaction history"
Write-Host "  • Smart contract data"
Write-Host "  • Gas prices"
Write-Host "  • Account balances`n"

Write-Host "Free plan: 5 calls/second, 100,000 calls/day`n"

$SetupEtherscan = Read-Host "Do you want to set up Etherscan API key? (y/n)"

if ($SetupEtherscan -eq 'y') {
    Write-Info "Opening Etherscan website..."
    Start-Process "https://etherscan.io"
    
    Write-Host "`nSteps to get your API key:"
    Write-Step 1 "Click 'Sign In' (top-right)"
    Write-Step 2 "Click 'Click to sign up'"
    Write-Step 3 "Fill in registration form and verify email"
    Write-Step 4 "Go to: https://etherscan.io/myapikey"
    Write-Step 5 "Click '+ Add' button"
    Write-Step 6 "Fill in AppName: 'CFV Metrics Agent'"
    Write-Step 7 "Complete CAPTCHA and create key`n"
    
    Read-Host "Press Enter to continue"
    
    $EtherscanKey = Read-Host "`nEnter your Etherscan API key"
    
    if ($EtherscanKey) {
        Write-Info "Testing Etherscan API key..."
        $Result = Test-EtherscanKey -ApiKey $EtherscanKey
        
        if ($Result.Valid) {
            Write-Success "Etherscan API key is valid!"
            Write-Host "  $($Result.Message)" -ForegroundColor Gray
            Update-EnvFile -Key "ETHERSCAN_API_KEY" -Value $EtherscanKey
            Write-Success "Etherscan API key saved to .env"
        }
        else {
            Write-Error-Custom "Etherscan API key validation failed: $($Result.Message)"
            Write-Warning-Custom "Key was not saved. Please check and try again."
        }
    }
}

# GitHub Setup
Write-Section "3. GitHub Token Setup"

Write-Host "GitHub token provides access to developer metrics:"
Write-Host "  • Repository statistics"
Write-Host "  • Commit activity"
Write-Host "  • Contributor counts"
Write-Host "  • Issue tracking`n"

Write-Host "With token: 5,000 requests/hour (vs 60 without)`n"

$SetupGitHub = Read-Host "Do you want to set up GitHub token? (y/n)"

if ($SetupGitHub -eq 'y') {
    Write-Info "Opening GitHub token settings..."
    Start-Process "https://github.com/settings/tokens"
    
    Write-Host "`nSteps to get your token:"
    Write-Step 1 "Click 'Personal access tokens' → 'Tokens (classic)'"
    Write-Step 2 "Click 'Generate new token' → 'Generate new token (classic)'"
    Write-Step 3 "Note: 'CFV Metrics Agent - Read Public Repos'"
    Write-Step 4 "Expiration: Choose duration (90 days recommended)"
    Write-Step 5 "Scopes: Check ONLY 'public_repo'"
    Write-Step 6 "Click 'Generate token'"
    Write-Host "`n" -NoNewline
    Write-Host "CRITICAL: " -ForegroundColor Red -NoNewline
    Write-Host "Copy your token immediately! You will NEVER see it again!`n"
    
    Read-Host "Press Enter to continue"
    
    $GitHubToken = Read-Host "`nEnter your GitHub token"
    
    if ($GitHubToken) {
        Write-Info "Testing GitHub token..."
        $Result = Test-GitHubToken -Token $GitHubToken
        
        if ($Result.Valid) {
            Write-Success "GitHub token is valid!"
            Write-Host "  $($Result.Message)" -ForegroundColor Gray
            Write-Host "  Remaining: $($Result.Remaining) requests" -ForegroundColor Gray
            Update-EnvFile -Key "GITHUB_TOKEN" -Value $GitHubToken
            Write-Success "GitHub token saved to .env"
        }
        else {
            Write-Error-Custom "GitHub token validation failed: $($Result.Message)"
            Write-Warning-Custom "Token was not saved. Please check and try again."
        }
    }
}

# Final verification
Write-Section "4. Final Verification"

Write-Host "Running comprehensive tests...`n"

$TotalServices = 3
$ConfiguredCount = 0
$ValidCount = 0

# Test CoinGecko
if ($EnvVars.ContainsKey("COINGECKO_API_KEY")) {
    $ConfiguredCount++
    Write-Info "Testing CoinGecko API key..."
    $Result = Test-CoinGeckoKey -ApiKey $EnvVars["COINGECKO_API_KEY"]
    if ($Result.Valid) {
        Write-Success "CoinGecko API key is valid!"
        $ValidCount++
    }
    else {
        Write-Error-Custom "CoinGecko API key is invalid: $($Result.Message)"
    }
}

# Test Etherscan
if ($EnvVars.ContainsKey("ETHERSCAN_API_KEY")) {
    $ConfiguredCount++
    Write-Info "Testing Etherscan API key..."
    $Result = Test-EtherscanKey -ApiKey $EnvVars["ETHERSCAN_API_KEY"]
    if ($Result.Valid) {
        Write-Success "Etherscan API key is valid!"
        $ValidCount++
    }
    else {
        Write-Error-Custom "Etherscan API key is invalid: $($Result.Message)"
    }
}

# Test GitHub
if ($EnvVars.ContainsKey("GITHUB_TOKEN")) {
    $ConfiguredCount++
    Write-Info "Testing GitHub token..."
    $Result = Test-GitHubToken -Token $EnvVars["GITHUB_TOKEN"]
    if ($Result.Valid) {
        Write-Success "GitHub token is valid! ($($Result.Remaining) requests remaining)"
        $ValidCount++
    }
    else {
        Write-Error-Custom "GitHub token is invalid: $($Result.Message)"
    }
}

Write-Host "`nTotal services: $TotalServices"
Write-Host "Configured: $ConfiguredCount/$TotalServices"
Write-Host "Valid: $ValidCount/$ConfiguredCount`n"

if ($ValidCount -eq $ConfiguredCount -and $ConfiguredCount -gt 0) {
    Write-Success "All configured API keys are valid! ✨"
}
elseif ($ValidCount -gt 0) {
    Write-Warning-Custom "Some API keys are invalid. Please check and update."
}
else {
    Write-Error-Custom "No valid API keys configured."
}

# Test agent
Write-Section "5. Test Agent (Optional)"

$TestAgent = Read-Host "Do you want to test the agent with a real cryptocurrency? (y/n)"

if ($TestAgent -eq 'y') {
    $Symbol = Read-Host "Enter cryptocurrency symbol (e.g., DASH, XNO, NEAR)"
    
    if ($Symbol) {
        Write-Info "Testing agent with $Symbol..."
        Write-Host "Running: npm run test:standalone $Symbol`n" -ForegroundColor Gray
        
        Push-Location $ProjectDir
        try {
            npm run test:standalone $Symbol
        }
        catch {
            Write-Error-Custom "Agent test failed: $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }
}

# Completion
Write-Section "Setup Complete!"

Write-Host "Your API keys have been configured in:"
Write-Host "  $EnvFile`n" -ForegroundColor Cyan

Write-Host "Next steps:"
Write-Step 1 "Review your configuration: Get-Content $EnvFile"
Write-Step 2 "Test the agent: npm run test:standalone DASH"
Write-Step 3 "Integrate with CFV Calculator`n"

Write-Success "Setup wizard completed successfully!"
