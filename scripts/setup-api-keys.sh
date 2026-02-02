#!/bin/bash

###############################################################################
# CFV Metrics Agent - API Key Setup Wizard
# 
# This script guides you through the process of obtaining and configuring
# API keys for the CFV Metrics Agent.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Project directory
PROJECT_DIR="/home/ubuntu/cfv-metrics-agent"
ENV_FILE="$PROJECT_DIR/.env"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║          CFV METRICS AGENT - API KEY SETUP WIZARD                 ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

prompt_continue() {
    echo -e "\n${YELLOW}Press Enter to continue...${NC}"
    read -r
}

open_url() {
    local url=$1
    print_info "Opening: $url"
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "$url" 2>/dev/null || true
    elif command -v open &> /dev/null; then
        open "$url" 2>/dev/null || true
    else
        print_warning "Could not open browser automatically. Please visit:"
        echo -e "${BOLD}$url${NC}"
    fi
}

###############################################################################
# Validation Functions
###############################################################################

validate_coingecko_key() {
    local key=$1
    print_info "Testing CoinGecko API key..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "https://api.coingecko.com/api/v3/ping" \
        -H "x-cg-demo-api-key: $key" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "CoinGecko API key is valid!"
        return 0
    else
        print_error "CoinGecko API key validation failed (HTTP $http_code)"
        return 1
    fi
}

validate_etherscan_key() {
    local key=$1
    print_info "Testing Etherscan API key..."
    
    response=$(curl -s -w "\n%{http_code}" \
        "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=$key" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"status":"1"'; then
        print_success "Etherscan API key is valid!"
        return 0
    else
        print_error "Etherscan API key validation failed"
        return 1
    fi
}

validate_github_token() {
    local token=$1
    print_info "Testing GitHub token..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: token $token" \
        "https://api.github.com/rate_limit" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        rate_limit=$(echo "$body" | grep -o '"limit":[0-9]*' | head -1 | cut -d':' -f2)
        if [ "$rate_limit" = "5000" ]; then
            print_success "GitHub token is valid! (5000 requests/hour)"
            return 0
        else
            print_warning "GitHub token works but has limited rate (${rate_limit:-60} requests/hour)"
            return 0
        fi
    else
        print_error "GitHub token validation failed (HTTP $http_code)"
        return 1
    fi
}

###############################################################################
# Setup Functions
###############################################################################

setup_coingecko() {
    print_section "1. CoinGecko API Key Setup"
    
    echo "CoinGecko provides cryptocurrency market data including:"
    echo "  • Prices and market caps"
    echo "  • Community metrics (Twitter, Reddit, Telegram)"
    echo "  • Developer statistics"
    echo "  • Trading volume"
    echo ""
    echo "Plans:"
    echo "  • ${GREEN}Demo (Free)${NC}: 30 calls/minute, 10,000 calls/month"
    echo "  • ${YELLOW}Analyst ($129/month)${NC}: 500 calls/minute, unlimited calls"
    echo ""
    
    read -p "Do you want to set up CoinGecko API key? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Skipping CoinGecko setup"
        return
    fi
    
    echo ""
    print_info "Opening CoinGecko API pricing page..."
    open_url "https://www.coingecko.com/en/api/pricing"
    
    echo ""
    echo "Steps to get your API key:"
    echo "  1. Click 'Get Started' on Demo or Analyst plan"
    echo "  2. Create an account (verify email)"
    echo "  3. Go to: https://www.coingecko.com/en/developers/dashboard"
    echo "  4. Click 'Generate API Key'"
    echo "  5. Copy the API key (starts with 'CG-')"
    echo ""
    
    prompt_continue
    
    while true; do
        echo -e "\n${BOLD}Enter your CoinGecko API key:${NC}"
        read -r coingecko_key
        
        if [ -z "$coingecko_key" ]; then
            print_error "API key cannot be empty"
            continue
        fi
        
        if validate_coingecko_key "$coingecko_key"; then
            # Update .env file
            if grep -q "^COINGECKO_API_KEY=" "$ENV_FILE"; then
                sed -i "s|^COINGECKO_API_KEY=.*|COINGECKO_API_KEY=$coingecko_key|" "$ENV_FILE"
            else
                echo "COINGECKO_API_KEY=$coingecko_key" >> "$ENV_FILE"
            fi
            print_success "CoinGecko API key saved to .env"
            break
        else
            read -p "Try again? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Skipping CoinGecko setup"
                break
            fi
        fi
    done
}

setup_etherscan() {
    print_section "2. Etherscan API Key Setup"
    
    echo "Etherscan provides Ethereum blockchain data including:"
    echo "  • Transaction history"
    echo "  • Smart contract data"
    echo "  • Account balances"
    echo "  • Gas prices"
    echo ""
    echo "Free Plan: 5 calls/second, 100,000 calls/day"
    echo ""
    
    read -p "Do you want to set up Etherscan API key? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Skipping Etherscan setup"
        return
    fi
    
    echo ""
    print_info "Opening Etherscan..."
    open_url "https://etherscan.io"
    
    echo ""
    echo "Steps to get your API key:"
    echo "  1. Click 'Sign In' → 'Click to sign up'"
    echo "  2. Create account (verify email)"
    echo "  3. Go to: https://etherscan.io/myapikey"
    echo "  4. Click '+ Add' button"
    echo "  5. Enter app name (e.g., 'CFV Metrics Agent')"
    echo "  6. Copy the API key"
    echo ""
    
    prompt_continue
    
    while true; do
        echo -e "\n${BOLD}Enter your Etherscan API key:${NC}"
        read -r etherscan_key
        
        if [ -z "$etherscan_key" ]; then
            print_error "API key cannot be empty"
            continue
        fi
        
        if validate_etherscan_key "$etherscan_key"; then
            # Update .env file
            if grep -q "^ETHERSCAN_API_KEY=" "$ENV_FILE"; then
                sed -i "s|^ETHERSCAN_API_KEY=.*|ETHERSCAN_API_KEY=$etherscan_key|" "$ENV_FILE"
            else
                echo "ETHERSCAN_API_KEY=$etherscan_key" >> "$ENV_FILE"
            fi
            print_success "Etherscan API key saved to .env"
            break
        else
            read -p "Try again? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Skipping Etherscan setup"
                break
            fi
        fi
    done
}

setup_github() {
    print_section "3. GitHub Personal Access Token Setup"
    
    echo "GitHub token provides developer metrics including:"
    echo "  • Repository statistics"
    echo "  • Contributor counts"
    echo "  • Commit activity"
    echo "  • Code frequency"
    echo ""
    echo "Rate Limits:"
    echo "  • ${RED}Without token${NC}: 60 requests/hour"
    echo "  • ${GREEN}With token${NC}: 5,000 requests/hour"
    echo ""
    
    read -p "Do you want to set up GitHub token? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Skipping GitHub setup"
        return
    fi
    
    echo ""
    print_info "Opening GitHub token settings..."
    open_url "https://github.com/settings/tokens"
    
    echo ""
    echo "Steps to get your token:"
    echo "  1. Click 'Generate new token' → 'Generate new token (classic)'"
    echo "  2. Note: 'CFV Metrics Agent'"
    echo "  3. Expiration: Choose duration (90 days recommended)"
    echo "  4. Scopes: Check ONLY '${GREEN}public_repo${NC}'"
    echo "  5. Click 'Generate token'"
    echo "  6. ${RED}IMPORTANT: Copy token immediately (you won't see it again!)${NC}"
    echo ""
    
    prompt_continue
    
    while true; do
        echo -e "\n${BOLD}Enter your GitHub token (starts with 'ghp_'):${NC}"
        read -r github_token
        
        if [ -z "$github_token" ]; then
            print_error "Token cannot be empty"
            continue
        fi
        
        if validate_github_token "$github_token"; then
            # Update .env file
            if grep -q "^GITHUB_TOKEN=" "$ENV_FILE"; then
                sed -i "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$github_token|" "$ENV_FILE"
            else
                echo "GITHUB_TOKEN=$github_token" >> "$ENV_FILE"
            fi
            print_success "GitHub token saved to .env"
            break
        else
            read -p "Try again? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Skipping GitHub setup"
                break
            fi
        fi
    done
}

###############################################################################
# Final Testing
###############################################################################

run_final_tests() {
    print_section "4. Final Verification"
    
    echo "Running comprehensive tests..."
    echo ""
    
    # Check .env file
    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env file not found!"
        return 1
    fi
    
    print_success ".env file exists"
    
    # Load environment variables
    source "$ENV_FILE"
    
    # Test each API key
    local all_valid=true
    
    if [ -n "$COINGECKO_API_KEY" ]; then
        if validate_coingecko_key "$COINGECKO_API_KEY"; then
            true
        else
            all_valid=false
        fi
    else
        print_warning "CoinGecko API key not configured"
    fi
    
    echo ""
    
    if [ -n "$ETHERSCAN_API_KEY" ]; then
        if validate_etherscan_key "$ETHERSCAN_API_KEY"; then
            true
        else
            all_valid=false
        fi
    else
        print_warning "Etherscan API key not configured"
    fi
    
    echo ""
    
    if [ -n "$GITHUB_TOKEN" ]; then
        if validate_github_token "$GITHUB_TOKEN"; then
            true
        else
            all_valid=false
        fi
    else
        print_warning "GitHub token not configured"
    fi
    
    echo ""
    
    if [ "$all_valid" = true ]; then
        print_success "All configured API keys are valid!"
        return 0
    else
        print_error "Some API keys failed validation"
        return 1
    fi
}

test_agent() {
    print_section "5. Test CFV Metrics Agent"
    
    echo "Would you like to test the agent with a real cryptocurrency?"
    echo ""
    read -p "Run test? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    echo ""
    echo "Enter a cryptocurrency symbol to test (e.g., DASH, DGB, XMR):"
    read -r symbol
    
    if [ -z "$symbol" ]; then
        symbol="DASH"
        print_info "Using default: DASH"
    fi
    
    echo ""
    print_info "Running: npm run test:standalone $symbol"
    echo ""
    
    cd "$PROJECT_DIR"
    npm run test:standalone "$symbol" || true
}

###############################################################################
# Main Script
###############################################################################

main() {
    clear
    print_header
    
    echo "This wizard will guide you through setting up API keys for:"
    echo "  1. CoinGecko (cryptocurrency data)"
    echo "  2. Etherscan (blockchain data)"
    echo "  3. GitHub (developer metrics)"
    echo ""
    echo "Time required: ~15 minutes"
    echo "Cost: Free tiers available for all services"
    echo ""
    
    prompt_continue
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    
    # Check if .env file exists, create if not
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found, creating from template..."
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
            print_success ".env file created"
        else
            print_error ".env.example not found!"
            exit 1
        fi
    fi
    
    # Run setup steps
    setup_coingecko
    setup_etherscan
    setup_github
    
    # Final verification
    run_final_tests
    
    # Test agent
    test_agent
    
    # Summary
    print_section "Setup Complete!"
    
    echo "Your API keys have been configured in:"
    echo "  ${BOLD}$ENV_FILE${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review your configuration: ${CYAN}cat $ENV_FILE${NC}"
    echo "  2. Test the agent: ${CYAN}cd $PROJECT_DIR && npm run test:standalone DASH${NC}"
    echo "  3. Integrate with CFV Calculator"
    echo ""
    echo "For more information, see:"
    echo "  • README.md - User guide"
    echo "  • DEPLOYMENT.md - Deployment guide"
    echo "  • API_KEYS_GUIDE.md - Detailed API key documentation"
    echo ""
    
    print_success "Setup wizard completed successfully!"
}

# Run main function
main
