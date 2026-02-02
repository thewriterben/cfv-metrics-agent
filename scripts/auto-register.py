#!/usr/bin/env python3
"""
CFV Metrics Agent - Browser Automation for Account Creation

This script provides semi-automated browser assistance for creating accounts
on CoinGecko, Etherscan, and GitHub. It opens browsers and guides you through
the registration process.

Note: Full automation is not possible due to CAPTCHAs and email verification.
This script assists by opening the correct pages and providing step-by-step guidance.
"""

import os
import sys
import time
import webbrowser
from pathlib import Path

# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color

def print_header():
    """Print script header"""
    print(f"{Colors.CYAN}{Colors.BOLD}")
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║     CFV METRICS AGENT - ACCOUNT CREATION ASSISTANT                ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.NC}\n")

def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'━' * 70}{Colors.NC}")
    print(f"{Colors.BLUE}{Colors.BOLD}  {title}{Colors.NC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'━' * 70}{Colors.NC}\n")

def print_success(message: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")

def print_error(message: str):
    """Print error message"""
    print(f"{Colors.RED}✗{Colors.NC} {message}")

def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠{Colors.NC} {message}")

def print_info(message: str):
    """Print info message"""
    print(f"{Colors.CYAN}ℹ{Colors.NC} {message}")

def print_step(number: int, message: str):
    """Print numbered step"""
    print(f"{Colors.BOLD}{number}.{Colors.NC} {message}")

def prompt_continue():
    """Prompt user to continue"""
    input(f"\n{Colors.YELLOW}Press Enter to continue...{Colors.NC}")

def open_browser(url: str):
    """Open URL in default browser"""
    print_info(f"Opening: {url}")
    try:
        webbrowser.open(url)
        time.sleep(2)  # Give browser time to open
        return True
    except Exception as e:
        print_error(f"Failed to open browser: {e}")
        print_warning(f"Please manually visit: {url}")
        return False

def guide_coingecko():
    """Guide through CoinGecko account creation"""
    print_section("CoinGecko Account Creation")
    
    print("CoinGecko provides cryptocurrency market data.")
    print("You'll need to create an account to get an API key.\n")
    
    print_step(1, "Choose your plan:")
    print("   • Demo (Free): 30 calls/minute, 10,000 calls/month")
    print("   • Analyst ($129/month): 500 calls/minute, unlimited calls\n")
    
    plan = input(f"{Colors.BOLD}Which plan do you want? (demo/analyst): {Colors.NC}").lower()
    
    if plan not in ['demo', 'analyst']:
        plan = 'demo'
        print_info("Defaulting to Demo plan")
    
    print()
    print_step(2, "Opening CoinGecko API pricing page...")
    open_browser("https://www.coingecko.com/en/api/pricing")
    
    print()
    print_step(3, "In your browser:")
    print(f"   • Click '{Colors.GREEN}Get Started{Colors.NC}' on the {plan.capitalize()} plan")
    print("   • Fill in registration form:")
    print("     - Email address")
    print("     - Password")
    print("     - Full name")
    print("     - Company name (optional)")
    print("   • Complete CAPTCHA")
    print("   • Click 'Sign Up'")
    
    prompt_continue()
    
    print()
    print_step(4, "Check your email for verification link")
    print("   • Look for email from CoinGecko")
    print("   • Click the verification link")
    print("   • Wait for account activation")
    
    prompt_continue()
    
    print()
    print_step(5, "Opening API dashboard...")
    open_browser("https://www.coingecko.com/en/developers/dashboard")
    
    print()
    print_step(6, "Generate your API key:")
    print("   • Click 'Generate API Key' or 'Create New Key'")
    print("   • Give it a name (e.g., 'CFV Metrics Agent')")
    print("   • Click 'Create'")
    print(f"   • {Colors.RED}IMPORTANT: Copy the key immediately!{Colors.NC}")
    print("   • Key format: CG-xxxxxxxxxxxxxxxxxxxx")
    
    prompt_continue()
    
    print()
    print_success("CoinGecko account creation complete!")
    print_info("Save your API key - you'll need it for the setup wizard")

def guide_etherscan():
    """Guide through Etherscan account creation"""
    print_section("Etherscan Account Creation")
    
    print("Etherscan provides Ethereum blockchain data.")
    print("Free plan includes 5 calls/second, 100,000 calls/day.\n")
    
    print_step(1, "Opening Etherscan...")
    open_browser("https://etherscan.io")
    
    print()
    print_step(2, "In your browser:")
    print("   • Click 'Sign In' (top-right corner)")
    print("   • Click 'Click to sign up' (at bottom)")
    print("   • Fill in registration form:")
    print("     - Username (cannot be changed later!)")
    print("     - Email address")
    print("     - Password")
    print("     - Confirm password")
    print("   • Complete CAPTCHA")
    print("   • Accept Terms of Service")
    print("   • Click 'Create an Account'")
    
    prompt_continue()
    
    print()
    print_step(3, "Check your email for verification link")
    print("   • Look for email from Etherscan")
    print("   • Click the verification link")
    print("   • Your account is now activated")
    
    prompt_continue()
    
    print()
    print_step(4, "Opening API Keys page...")
    open_browser("https://etherscan.io/myapikey")
    
    print()
    print_step(5, "Generate your API key:")
    print("   • Click '+ Add' button")
    print("   • Fill in the form:")
    print("     - AppName: 'CFV Metrics Agent'")
    print("     - Email: (confirm your email)")
    print("   • Complete CAPTCHA")
    print("   • Click 'Create New API Key'")
    print("   • Copy your API key")
    print("   • Key format: ABCDEFGHIJK1234567890ABCDEFGHIJK")
    
    prompt_continue()
    
    print()
    print_success("Etherscan account creation complete!")
    print_info("Save your API key - you'll need it for the setup wizard")

def guide_github():
    """Guide through GitHub token creation"""
    print_section("GitHub Personal Access Token Creation")
    
    print("GitHub token provides access to developer metrics.")
    print("With token: 5,000 requests/hour (vs 60 without)\n")
    
    print_step(1, "Do you have a GitHub account?")
    has_account = input(f"{Colors.BOLD}(y/n): {Colors.NC}").lower()
    
    if has_account != 'y':
        print()
        print_info("Opening GitHub sign-up page...")
        open_browser("https://github.com/signup")
        print()
        print("Create your GitHub account first, then return here.")
        prompt_continue()
    
    print()
    print_step(2, "Opening GitHub token settings...")
    open_browser("https://github.com/settings/tokens")
    
    print()
    print_step(3, "In your browser:")
    print("   • Click 'Personal access tokens' → 'Tokens (classic)'")
    print("   • Click 'Generate new token' → 'Generate new token (classic)'")
    
    prompt_continue()
    
    print()
    print_step(4, "Configure your token:")
    print(f"   • {Colors.BOLD}Note:{Colors.NC} 'CFV Metrics Agent - Read Public Repos'")
    print(f"   • {Colors.BOLD}Expiration:{Colors.NC} Choose duration (90 days recommended)")
    print(f"   • {Colors.BOLD}Scopes:{Colors.NC} Check ONLY '{Colors.GREEN}public_repo{Colors.NC}'")
    print(f"   • {Colors.RED}DO NOT check:{Colors.NC} repo, admin:org, delete_repo, etc.")
    print("   • Scroll down and click 'Generate token'")
    
    prompt_continue()
    
    print()
    print_step(5, f"{Colors.RED}CRITICAL: Copy your token immediately!{Colors.NC}")
    print("   • Token format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    print(f"   • {Colors.RED}You will NEVER see this token again!{Colors.NC}")
    print("   • If you lose it, you'll need to generate a new one")
    print("   • Save it to a password manager or secure note")
    
    prompt_continue()
    
    print()
    print_success("GitHub token creation complete!")
    print_info("Save your token - you'll need it for the setup wizard")

def main():
    """Main function"""
    print_header()
    
    print("This assistant will help you create accounts and obtain API keys.")
    print("Due to CAPTCHAs and email verification, full automation is not possible.")
    print("I'll open the correct pages and guide you through each step.\n")
    
    print(f"{Colors.BOLD}Services to set up:{Colors.NC}")
    print("  1. CoinGecko (cryptocurrency data)")
    print("  2. Etherscan (blockchain data)")
    print("  3. GitHub (developer metrics)")
    print()
    
    print(f"{Colors.YELLOW}Time required: ~20-30 minutes{Colors.NC}")
    print(f"{Colors.YELLOW}You'll need: Email address(es) for verification{Colors.NC}")
    print()
    
    prompt_continue()
    
    # Ask which services to set up
    print_section("Service Selection")
    
    setup_coingecko_flag = input("Set up CoinGecko? (y/n): ").lower() == 'y'
    setup_etherscan_flag = input("Set up Etherscan? (y/n): ").lower() == 'y'
    setup_github_flag = input("Set up GitHub? (y/n): ").lower() == 'y'
    
    if not any([setup_coingecko_flag, setup_etherscan_flag, setup_github_flag]):
        print_warning("No services selected. Exiting.")
        return
    
    # Guide through each service
    if setup_coingecko_flag:
        guide_coingecko()
    
    if setup_etherscan_flag:
        guide_etherscan()
    
    if setup_github_flag:
        guide_github()
    
    # Final instructions
    print_section("Next Steps")
    
    print("You should now have API keys for the selected services.")
    print()
    print_step(1, "Run the setup wizard to configure your keys:")
    print(f"   {Colors.CYAN}cd /home/ubuntu/cfv-metrics-agent{Colors.NC}")
    print(f"   {Colors.CYAN}./scripts/setup-api-keys.sh{Colors.NC}")
    print()
    print_step(2, "Or manually add keys to .env file:")
    print(f"   {Colors.CYAN}nano /home/ubuntu/cfv-metrics-agent/.env{Colors.NC}")
    print()
    print_step(3, "Validate your keys:")
    print(f"   {Colors.CYAN}./scripts/validate-keys.py{Colors.NC}")
    print()
    
    print_success("Account creation assistant complete!")
    print()
    print(f"{Colors.BOLD}Remember to save your API keys securely!{Colors.NC}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Assistant interrupted by user{Colors.NC}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}Error: {str(e)}{Colors.NC}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
