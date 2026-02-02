#!/usr/bin/env python3
"""
CFV Metrics Agent - API Key Validator

This script validates all configured API keys and provides detailed
diagnostics about their status, rate limits, and capabilities.
"""

import os
import sys
import json
import time
import requests
from typing import Dict, Tuple, Optional
from datetime import datetime
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
    print("║          CFV METRICS AGENT - API KEY VALIDATOR                    ║")
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

def load_env_file(env_path: str) -> Dict[str, str]:
    """Load environment variables from .env file"""
    env_vars = {}
    
    if not os.path.exists(env_path):
        print_error(f".env file not found: {env_path}")
        return env_vars
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
    
    return env_vars

def validate_coingecko(api_key: Optional[str]) -> Tuple[bool, Dict]:
    """Validate CoinGecko API key"""
    result = {
        'service': 'CoinGecko',
        'status': 'unknown',
        'message': '',
        'details': {}
    }
    
    if not api_key:
        result['status'] = 'not_configured'
        result['message'] = 'API key not configured'
        return False, result
    
    try:
        # Test ping endpoint
        response = requests.get(
            'https://api.coingecko.com/api/v3/ping',
            headers={'x-cg-demo-api-key': api_key},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            result['status'] = 'valid'
            result['message'] = 'API key is valid'
            result['details']['response'] = data.get('gecko_says', 'OK')
            
            # Get rate limit info from headers
            if 'x-ratelimit-limit' in response.headers:
                result['details']['rate_limit'] = response.headers['x-ratelimit-limit']
            if 'x-ratelimit-remaining' in response.headers:
                result['details']['rate_remaining'] = response.headers['x-ratelimit-remaining']
            
            return True, result
        elif response.status_code == 401:
            result['status'] = 'invalid'
            result['message'] = 'API key is invalid or expired'
            return False, result
        elif response.status_code == 429:
            result['status'] = 'rate_limited'
            result['message'] = 'Rate limit exceeded'
            return False, result
        else:
            result['status'] = 'error'
            result['message'] = f'HTTP {response.status_code}: {response.text[:100]}'
            return False, result
            
    except requests.exceptions.Timeout:
        result['status'] = 'timeout'
        result['message'] = 'Request timed out'
        return False, result
    except requests.exceptions.RequestException as e:
        result['status'] = 'error'
        result['message'] = f'Request failed: {str(e)}'
        return False, result

def validate_etherscan(api_key: Optional[str]) -> Tuple[bool, Dict]:
    """Validate Etherscan API key"""
    result = {
        'service': 'Etherscan',
        'status': 'unknown',
        'message': '',
        'details': {}
    }
    
    if not api_key:
        result['status'] = 'not_configured'
        result['message'] = 'API key not configured'
        return False, result
    
    try:
        # Test with ETH price endpoint
        response = requests.get(
            f'https://api.etherscan.io/api',
            params={
                'module': 'stats',
                'action': 'ethprice',
                'apikey': api_key
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == '1':
                result['status'] = 'valid'
                result['message'] = 'API key is valid'
                
                # Extract ETH price as a test
                if 'result' in data and 'ethusd' in data['result']:
                    result['details']['eth_price'] = f"${data['result']['ethusd']}"
                
                return True, result
            else:
                result['status'] = 'invalid'
                result['message'] = data.get('message', 'API key validation failed')
                return False, result
        else:
            result['status'] = 'error'
            result['message'] = f'HTTP {response.status_code}'
            return False, result
            
    except requests.exceptions.Timeout:
        result['status'] = 'timeout'
        result['message'] = 'Request timed out'
        return False, result
    except requests.exceptions.RequestException as e:
        result['status'] = 'error'
        result['message'] = f'Request failed: {str(e)}'
        return False, result

def validate_github(token: Optional[str]) -> Tuple[bool, Dict]:
    """Validate GitHub personal access token"""
    result = {
        'service': 'GitHub',
        'status': 'unknown',
        'message': '',
        'details': {}
    }
    
    if not token:
        result['status'] = 'not_configured'
        result['message'] = 'Token not configured'
        return False, result
    
    try:
        # Test with rate limit endpoint
        response = requests.get(
            'https://api.github.com/rate_limit',
            headers={'Authorization': f'token {token}'},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            rate_limit = data.get('rate', {}).get('limit', 0)
            remaining = data.get('rate', {}).get('remaining', 0)
            reset_time = data.get('rate', {}).get('reset', 0)
            
            result['status'] = 'valid'
            result['message'] = 'Token is valid'
            result['details']['rate_limit'] = f'{rate_limit} requests/hour'
            result['details']['remaining'] = f'{remaining} requests remaining'
            
            if reset_time:
                reset_dt = datetime.fromtimestamp(reset_time)
                result['details']['reset_time'] = reset_dt.strftime('%Y-%m-%d %H:%M:%S')
            
            if rate_limit < 5000:
                result['message'] += f' (Limited to {rate_limit} req/hour - consider using token with higher limits)'
            
            return True, result
        elif response.status_code == 401:
            result['status'] = 'invalid'
            result['message'] = 'Token is invalid or expired'
            return False, result
        else:
            result['status'] = 'error'
            result['message'] = f'HTTP {response.status_code}'
            return False, result
            
    except requests.exceptions.Timeout:
        result['status'] = 'timeout'
        result['message'] = 'Request timed out'
        return False, result
    except requests.exceptions.RequestException as e:
        result['status'] = 'error'
        result['message'] = f'Request failed: {str(e)}'
        return False, result

def print_validation_result(result: Dict):
    """Print validation result in formatted way"""
    service = result['service']
    status = result['status']
    message = result['message']
    details = result['details']
    
    # Print status
    if status == 'valid':
        print_success(f"{service}: {message}")
    elif status == 'not_configured':
        print_warning(f"{service}: {message}")
    else:
        print_error(f"{service}: {message}")
    
    # Print details
    if details:
        for key, value in details.items():
            print(f"  {key}: {value}")

def generate_report(results: Dict[str, Tuple[bool, Dict]]) -> str:
    """Generate JSON report of validation results"""
    report = {
        'timestamp': datetime.now().isoformat(),
        'results': {}
    }
    
    for service, (valid, result) in results.items():
        report['results'][service] = {
            'valid': valid,
            'status': result['status'],
            'message': result['message'],
            'details': result['details']
        }
    
    return json.dumps(report, indent=2)

def main():
    """Main function"""
    print_header()
    
    # Determine project directory
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    env_file = project_dir / '.env'
    
    print_info(f"Project directory: {project_dir}")
    print_info(f"Environment file: {env_file}")
    print()
    
    # Load environment variables
    env_vars = load_env_file(str(env_file))
    
    if not env_vars:
        print_error("Failed to load .env file")
        sys.exit(1)
    
    print_success(f"Loaded {len(env_vars)} environment variables")
    
    # Validate each API key
    print_section("Validating API Keys")
    
    results = {}
    
    # CoinGecko
    print("Testing CoinGecko API key...")
    coingecko_key = env_vars.get('COINGECKO_API_KEY')
    valid, result = validate_coingecko(coingecko_key)
    results['coingecko'] = (valid, result)
    print_validation_result(result)
    print()
    time.sleep(1)  # Rate limiting
    
    # Etherscan
    print("Testing Etherscan API key...")
    etherscan_key = env_vars.get('ETHERSCAN_API_KEY')
    valid, result = validate_etherscan(etherscan_key)
    results['etherscan'] = (valid, result)
    print_validation_result(result)
    print()
    time.sleep(1)  # Rate limiting
    
    # GitHub
    print("Testing GitHub token...")
    github_token = env_vars.get('GITHUB_TOKEN')
    valid, result = validate_github(github_token)
    results['github'] = (valid, result)
    print_validation_result(result)
    print()
    
    # Summary
    print_section("Summary")
    
    total = len(results)
    valid_count = sum(1 for v, _ in results.values() if v)
    configured_count = sum(1 for _, r in results.values() if r[1]['status'] != 'not_configured')
    
    print(f"Total services: {total}")
    print(f"Configured: {configured_count}/{total}")
    print(f"Valid: {valid_count}/{configured_count if configured_count > 0 else total}")
    print()
    
    if valid_count == configured_count and configured_count > 0:
        print_success("All configured API keys are valid! ✨")
    elif valid_count > 0:
        print_warning(f"{valid_count} API key(s) valid, {configured_count - valid_count} need attention")
    else:
        print_error("No valid API keys found. Please configure your keys.")
    
    # Generate report
    print_section("Detailed Report")
    report = generate_report(results)
    
    report_file = project_dir / 'api-keys-validation-report.json'
    with open(report_file, 'w') as f:
        f.write(report)
    
    print_success(f"Report saved to: {report_file}")
    print()
    print("Report contents:")
    print(report)
    
    # Exit code
    if valid_count == configured_count and configured_count > 0:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Validation interrupted by user{Colors.NC}")
        sys.exit(130)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
