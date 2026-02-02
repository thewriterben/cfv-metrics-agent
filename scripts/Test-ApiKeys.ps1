<#
.SYNOPSIS
    CFV Metrics Agent - API Key Validator (PowerShell)

.DESCRIPTION
    Validates all configured API keys and generates detailed diagnostic reports.

.EXAMPLE
    .\Test-ApiKeys.ps1

.EXAMPLE
    .\Test-ApiKeys.ps1 -Verbose

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

# Get project directory
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $ProjectDir ".env"

Write-Header "CFV METRICS AGENT - API KEY VALIDATOR"

Write-Info "Project directory: $ProjectDir"
Write-Info "Environment file: $EnvFile"

# Check if .env exists
if (-not (Test-Path $EnvFile)) {
    Write-Error-Custom ".env file not found!"
    Write-Host "`nPlease run Setup-ApiKeys.ps1 first to configure your API keys.`n"
    exit 1
}

# Load .env file
$EnvVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $EnvVars[$matches[1]] = $matches[2]
    }
}

Write-Success "Loaded $($EnvVars.Count) environment variables"

# Initialize results
$Results = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fff"
    results = @{}
}

# Function to validate CoinGecko API key
function Test-CoinGeckoKey {
    param([string]$ApiKey)
    
    Write-Info "Testing CoinGecko API key..."
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.coingecko.com/api/v3/ping" `
            -Headers @{"x-cg-demo-api-key" = $ApiKey} `
            -TimeoutSec 10
        
        if ($Response.gecko_says) {
            Write-Success "CoinGecko: API key is valid"
            Write-Host "  response: $($Response.gecko_says)" -ForegroundColor Gray
            
            # Try to get rate limit info
            try {
                $RateLimit = Invoke-WebRequest -Uri "https://api.coingecko.com/api/v3/ping" `
                    -Headers @{"x-cg-demo-api-key" = $ApiKey} `
                    -TimeoutSec 10
                
                $RateLimitValue = $RateLimit.Headers["X-RateLimit-Limit"]
                $RateRemaining = $RateLimit.Headers["X-RateLimit-Remaining"]
                
                if ($RateLimitValue) {
                    Write-Host "  rate_limit: $RateLimitValue" -ForegroundColor Gray
                    Write-Host "  rate_remaining: $RateRemaining" -ForegroundColor Gray
                }
            }
            catch {
                # Rate limit headers may not be available
            }
            
            return @{
                valid = $true
                status = "valid"
                message = "API key is valid"
                details = @{
                    response = $Response.gecko_says
                }
            }
        }
        
        return @{
            valid = $false
            status = "invalid"
            message = "Invalid response from API"
            details = @{}
        }
    }
    catch {
        Write-Error-Custom "CoinGecko: Validation failed"
        Write-Host "  error: $($_.Exception.Message)" -ForegroundColor Gray
        
        return @{
            valid = $false
            status = "error"
            message = $_.Exception.Message
            details = @{}
        }
    }
}

# Function to validate Etherscan API key
function Test-EtherscanKey {
    param([string]$ApiKey)
    
    Write-Info "Testing Etherscan API key..."
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=$ApiKey" `
            -TimeoutSec 10
        
        if ($Response.status -eq "1") {
            $EthPrice = [math]::Round([decimal]$Response.result.ethusd, 2)
            
            Write-Success "Etherscan: API key is valid"
            Write-Host "  eth_price: `$$EthPrice" -ForegroundColor Gray
            
            return @{
                valid = $true
                status = "valid"
                message = "API key is valid"
                details = @{
                    eth_price = "`$$EthPrice"
                }
            }
        }
        
        Write-Error-Custom "Etherscan: API key is invalid"
        Write-Host "  error: $($Response.message)" -ForegroundColor Gray
        
        return @{
            valid = $false
            status = "invalid"
            message = $Response.message
            details = @{}
        }
    }
    catch {
        Write-Error-Custom "Etherscan: Validation failed"
        Write-Host "  error: $($_.Exception.Message)" -ForegroundColor Gray
        
        return @{
            valid = $false
            status = "error"
            message = $_.Exception.Message
            details = @{}
        }
    }
}

# Function to validate GitHub token
function Test-GitHubToken {
    param([string]$Token)
    
    Write-Info "Testing GitHub token..."
    
    try {
        $Response = Invoke-RestMethod -Uri "https://api.github.com/rate_limit" `
            -Headers @{"Authorization" = "token $Token"} `
            -TimeoutSec 10
        
        $RateLimit = $Response.rate.limit
        $Remaining = $Response.rate.remaining
        $ResetTime = [DateTimeOffset]::FromUnixTimeSeconds($Response.rate.reset).LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss")
        
        Write-Success "GitHub: Token is valid"
        Write-Host "  rate_limit: $RateLimit requests/hour" -ForegroundColor Gray
        Write-Host "  remaining: $Remaining requests remaining" -ForegroundColor Gray
        Write-Host "  reset_time: $ResetTime" -ForegroundColor Gray
        
        return @{
            valid = $true
            status = "valid"
            message = "Token is valid"
            details = @{
                rate_limit = "$RateLimit requests/hour"
                remaining = "$Remaining requests remaining"
                reset_time = $ResetTime
            }
        }
    }
    catch {
        Write-Error-Custom "GitHub: Token validation failed"
        Write-Host "  error: $($_.Exception.Message)" -ForegroundColor Gray
        
        return @{
            valid = $false
            status = "error"
            message = $_.Exception.Message
            details = @{}
        }
    }
}

# Validate API keys
Write-Section "Validating API Keys"

$TotalServices = 3
$ConfiguredCount = 0
$ValidCount = 0

# Test CoinGecko
if ($EnvVars.ContainsKey("COINGECKO_API_KEY") -and $EnvVars["COINGECKO_API_KEY"]) {
    Write-Host "Testing CoinGecko API key..."
    $ConfiguredCount++
    $Result = Test-CoinGeckoKey -ApiKey $EnvVars["COINGECKO_API_KEY"]
    $Results.results["coingecko"] = $Result
    if ($Result.valid) { $ValidCount++ }
}
else {
    Write-Warning-Custom "CoinGecko: API key not configured"
    $Results.results["coingecko"] = @{
        valid = $false
        status = "not_configured"
        message = "API key not set in .env file"
        details = @{}
    }
}

Write-Host ""

# Test Etherscan
if ($EnvVars.ContainsKey("ETHERSCAN_API_KEY") -and $EnvVars["ETHERSCAN_API_KEY"]) {
    Write-Host "Testing Etherscan API key..."
    $ConfiguredCount++
    $Result = Test-EtherscanKey -ApiKey $EnvVars["ETHERSCAN_API_KEY"]
    $Results.results["etherscan"] = $Result
    if ($Result.valid) { $ValidCount++ }
}
else {
    Write-Warning-Custom "Etherscan: API key not configured"
    $Results.results["etherscan"] = @{
        valid = $false
        status = "not_configured"
        message = "API key not set in .env file"
        details = @{}
    }
}

Write-Host ""

# Test GitHub
if ($EnvVars.ContainsKey("GITHUB_TOKEN") -and $EnvVars["GITHUB_TOKEN"]) {
    Write-Host "Testing GitHub token..."
    $ConfiguredCount++
    $Result = Test-GitHubToken -Token $EnvVars["GITHUB_TOKEN"]
    $Results.results["github"] = $Result
    if ($Result.valid) { $ValidCount++ }
}
else {
    Write-Warning-Custom "GitHub: Token not configured"
    $Results.results["github"] = @{
        valid = $false
        status = "not_configured"
        message = "Token not set in .env file"
        details = @{}
    }
}

# Summary
Write-Section "Summary"

Write-Host "Total services: $TotalServices"
Write-Host "Configured: $ConfiguredCount/$TotalServices"
Write-Host "Valid: $ValidCount/$ConfiguredCount`n"

if ($ValidCount -eq $ConfiguredCount -and $ConfiguredCount -gt 0) {
    Write-Success "All configured API keys are valid! ✨"
    $ExitCode = 0
}
elseif ($ValidCount -gt 0) {
    Write-Warning-Custom "Some API keys are invalid or not configured."
    $ExitCode = 1
}
else {
    Write-Error-Custom "No valid API keys found."
    $ExitCode = 1
}

# Save report
Write-Section "Detailed Report"

$ReportFile = Join-Path $ProjectDir "api-keys-validation-report.json"
$Results | ConvertTo-Json -Depth 10 | Set-Content -Path $ReportFile

Write-Success "Report saved to: $ReportFile"

Write-Host "`nReport contents:"
$Results | ConvertTo-Json -Depth 10 | Write-Host

exit $ExitCode
