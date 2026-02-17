/**
 * Environment Variable Validation Utility
 * 
 * Validates that required environment variables are properly set
 * and provides helpful error messages for missing or invalid values.
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check Node environment
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push('NODE_ENV not set. Defaulting to development mode');
  } else if (!['development', 'production', 'test'].includes(nodeEnv)) {
    warnings.push(`NODE_ENV is "${nodeEnv}" but should be one of: development, production, test`);
  }
  
  // Check API keys
  const coingeckoKey = process.env.COINGECKO_API_KEY;
  if (!coingeckoKey) {
    errors.push('COINGECKO_API_KEY is required but not set. Get your API key from https://www.coingecko.com/en/api');
  } else if (coingeckoKey.length < 10) {
    warnings.push('COINGECKO_API_KEY seems too short. Please verify it is correct');
  }
  
  // Check database configuration
  const mysqlUrl = process.env.MYSQL_URL;
  const dbHost = process.env.DB_HOST || process.env.MYSQLHOST;
  const dbUser = process.env.DB_USER || process.env.MYSQLUSER;
  const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE;
  
  if (!mysqlUrl && !dbHost) {
    errors.push('Database configuration missing. Set either MYSQL_URL or DB_HOST/MYSQLHOST');
  }
  
  if (!mysqlUrl) {
    // Check individual database variables if MYSQL_URL is not provided
    if (!dbUser) {
      warnings.push('DB_USER/MYSQLUSER not set. Defaulting to "root"');
    }
    
    if (!dbPassword) {
      warnings.push('DB_PASSWORD/MYSQLPASSWORD not set. Using empty password');
    }
    
    if (!dbName) {
      warnings.push('DB_NAME/MYSQLDATABASE not set. Defaulting to "cfv_metrics"');
    }
  }
  
  // Check port settings
  const apiPort = process.env.API_PORT || process.env.PORT;
  if (apiPort) {
    const port = parseInt(apiPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`Invalid API_PORT/PORT: "${apiPort}". Must be a number between 1 and 65535`);
    }
  } else {
    warnings.push('API_PORT/PORT not set. Defaulting to 3000');
  }
  
  // Check Redis configuration (optional)
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    warnings.push('REDIS_URL not set. Will attempt to connect to redis://localhost:6379 or fall back to memory cache');
  }
  
  // Check collection interval settings (optional)
  const intervalMinutes = process.env.COLLECTION_INTERVAL_MINUTES;
  if (intervalMinutes) {
    const interval = parseInt(intervalMinutes);
    if (isNaN(interval) || interval < 1) {
      warnings.push(`COLLECTION_INTERVAL_MINUTES is "${intervalMinutes}" but should be a positive number. Defaulting to 60`);
    }
  }
  
  const delayMs = process.env.DELAY_BETWEEN_COINS_MS;
  if (delayMs) {
    const delay = parseInt(delayMs);
    if (isNaN(delay) || delay < 0) {
      warnings.push(`DELAY_BETWEEN_COINS_MS is "${delayMs}" but should be a non-negative number. Defaulting to 5000`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate environment and print results
 * Throws an error if validation fails
 */
export function validateAndReportEnvironment(): void {
  const result = validateEnvironment();
  
  // Print warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    result.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
    console.log('');
  }
  
  // Print errors and exit if validation failed
  if (!result.valid) {
    console.error('\n❌ Environment Validation Failed:\n');
    result.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    console.error('\nPlease check your .env file or environment variables.\n');
    console.error('Example .env file:');
    console.error('  COINGECKO_API_KEY=your_api_key_here');
    console.error('  DB_HOST=localhost');
    console.error('  DB_USER=root');
    console.error('  DB_PASSWORD=your_password');
    console.error('  DB_NAME=cfv_metrics');
    console.error('  API_PORT=3000');
    console.error('  NODE_ENV=development\n');
    
    throw new Error('Environment validation failed. Please fix the errors above.');
  }
  
  // Success message
  if (result.warnings.length === 0) {
    console.log('✅ Environment validation passed\n');
  }
}
