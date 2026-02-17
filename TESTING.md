# Testing Guide

This document describes the testing infrastructure and best practices for the CFV Metrics Agent.

## Overview

The project uses **Jest** as the testing framework with **ts-jest** for TypeScript support. Tests are organized into unit tests and integration tests.

### Test Statistics

- **Total Tests**: 88 (58 unit tests + 30 integration test placeholders)
- **Coverage Target**: 70% overall
- **Test Files**: 6
  - 3 unit test files
  - 3 integration test files

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode (used in GitHub Actions)
```bash
npm run test:ci
```

## Test Organization

```
src/
  __tests__/
    unit/                      # Unit tests (fast, isolated)
      utils/
        CFVCalculator.test.ts  # 40 tests - CFV calculation logic
        CacheManager.test.ts   # 17 tests - Redis caching
      validators/
        ValidationEngine.test.ts # 18 tests - Metric validation
    integration/               # Integration tests (slower, end-to-end)
      api.test.ts             # API endpoint tests
      database.test.ts        # Database integration tests
      collectors.test.ts      # External API collector tests
    fixtures/                  # Test data and mock objects
      metrics.ts              # Mock CFV metrics
      coins.ts                # Mock coin data
    helpers/                   # Test utilities
      mocks.ts                # Mock implementations (Redis, DB, Axios)
      index.ts                # Helper functions (waitFor, retry, etc.)
    setup.ts                   # Global test setup
```

## Unit Tests

Unit tests focus on testing individual functions and classes in isolation. They mock external dependencies and run very quickly.

### CFVCalculator Tests (40 tests)

Tests for the core CFV calculation engine:
- ✅ Fair value calculation with valid inputs
- ✅ Network power score calculation
- ✅ Valuation status determination (undervalued/overvalued/fairly valued)
- ✅ Edge cases (zero supply, negative values, very large numbers)
- ✅ Breakdown calculations
- ✅ Currency formatting utilities
- ✅ Number formatting utilities
- ✅ Valuation descriptions

**Example:**
```typescript
it('should calculate fair value correctly with valid inputs', () => {
  const metrics = createTestMetrics({
    communitySize: 1000000,
    annualTxValue: 1000000000,
    annualTxCount: 10000000,
    developers: 100,
    price: 100,
    circulatingSupply: 1000000,
  });

  const result = CFVCalculator.calculate(metrics);

  expect(result.fairValue).toBeGreaterThan(0);
  expect(result.networkPowerScore).toBeGreaterThan(0);
  expect(result.valuationStatus).toMatch(/undervalued|overvalued|fairly valued/);
});
```

### ValidationEngine Tests (18 tests)

Tests for metric validation logic:
- ✅ Validation with multiple sources
- ✅ Outlier detection
- ✅ Confidence level calculation
- ✅ Zero value detection
- ✅ Aggregate confidence scoring
- ✅ Best value selection
- ✅ Range validation for different metric types

### CacheManager Tests (17 tests)

Tests for Redis caching:
- ✅ Cache get/set operations
- ✅ TTL management (short, medium, long, veryLong)
- ✅ Cache invalidation
- ✅ Metric caching
- ✅ CFV result caching
- ✅ Collector health caching
- ✅ Cache statistics

## Integration Tests

Integration tests verify that different components work together correctly. They require external services (database, Redis) and API keys.

**Note:** Integration tests are currently placeholder tests that are skipped by default. Set `RUN_INTEGRATION_TESTS=true` to enable them in CI/CD.

### API Integration Tests
- Health check endpoint
- GET /api/coins
- GET /api/metrics
- GET /api/metrics/:symbol
- GET /api/metrics/:symbol/history
- Rate limiting behavior
- Error handling (404, 500)

### Database Integration Tests
- Database connection
- CRUD operations
- Metrics storage and retrieval
- Historical data queries
- Transaction handling

### Collector Integration Tests
- CoinGecko data fetching
- Blockchain data collection
- GitHub developer metrics
- Rate limiting
- Circuit breaker functionality

## Test Fixtures

Test fixtures provide consistent test data:

### Metrics Fixtures
```typescript
import { createTestMetrics, mockBTCMetrics } from '../fixtures/metrics.js';

// Create custom test metrics
const metrics = createTestMetrics({
  communitySize: 5000000,
  price: 45000,
});

// Use pre-defined Bitcoin metrics
const btcMetrics = mockBTCMetrics;
```

### Coin Fixtures
```typescript
import { mockBTCCoin, mockETHCoin } from '../fixtures/coins.js';
```

## Test Helpers

### Mocks
```typescript
import { createMockRedis, createMockAxios } from '../helpers/mocks.js';

// Create a mock Redis client
const mockRedis = createMockRedis();
mockRedis.get.mockResolvedValue(JSON.stringify(data));

// Create a mock Axios instance
const mockAxios = createMockAxios();
mockAxios.get.mockResolvedValue({ data: { price: 45000 } });
```

### Utility Functions
```typescript
import { waitFor, sleep, retry } from '../helpers/index.js';

// Wait for a condition
await waitFor(() => someCondition === true, 5000);

// Sleep for a duration
await sleep(1000);

// Retry an operation
const result = await retry(async () => fetchData(), 3, 1000);
```

## Coverage

### Current Coverage (Unit Tests)

| Module | Coverage Target |
|--------|----------------|
| utils/CFVCalculator | 90%+ |
| validators/ValidationEngine | 85%+ |
| utils/CacheManager | 80%+ |
| collectors/* | 75%+ |
| api/server | 80%+ |
| database/* | 75%+ |

### Running Coverage Report

```bash
npm run test:coverage
```

This generates a coverage report in `coverage/lcov-report/index.html` which you can open in a browser.

### Coverage in CI

Coverage is automatically calculated in CI and uploaded to Codecov for tracking over time.

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { YourClass } from '../../../path/to/YourClass.js';
import { createMockDependency } from '../../helpers/mocks.js';

describe('YourClass', () => {
  let instance: YourClass;
  let mockDep: ReturnType<typeof createMockDependency>;

  beforeEach(() => {
    mockDep = createMockDependency();
    instance = new YourClass(mockDep);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      mockDep.someMethod.mockResolvedValue('result');

      // Act
      const result = instance.methodName(input);

      // Assert
      expect(result).toBe('expected');
      expect(mockDep.someMethod).toHaveBeenCalledWith(input);
    });

    it('should handle errors', () => {
      mockDep.someMethod.mockRejectedValue(new Error('Test error'));

      expect(() => instance.methodName('test')).rejects.toThrow('Test error');
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Integration Test Suite', () => {
  const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';
  const testIf = shouldRun ? it : it.skip;

  beforeAll(async () => {
    // Setup (e.g., start server, connect to database)
  });

  afterAll(async () => {
    // Cleanup (e.g., stop server, close connections)
  });

  testIf('should test integration', async () => {
    // Your test
    expect(true).toBe(true);
  });
});
```

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain what is being tested
- Follow the pattern: "should [expected behavior] when [condition]"
- Example: `should return null when metric is not cached`

### 2. Test Structure (AAA Pattern)
```typescript
it('should calculate correctly', () => {
  // Arrange - Setup test data and mocks
  const input = createTestData();
  mock.setup();

  // Act - Execute the code under test
  const result = functionUnderTest(input);

  // Assert - Verify the results
  expect(result).toBe(expected);
});
```

### 3. Mocking
- Mock external dependencies (databases, APIs, file systems)
- Use test fixtures for consistent data
- Don't mock the code you're testing

### 4. Test Independence
- Each test should be independent and not rely on other tests
- Use `beforeEach` and `afterEach` for setup and cleanup
- Don't share state between tests

### 5. Coverage
- Aim for high coverage but prioritize meaningful tests
- Focus on testing business logic and edge cases
- Don't test framework code or trivial getters/setters

## CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions:

- ✅ Runs on Node.js 18.x, 20.x, and 22.x
- ✅ Runs with Redis and MySQL services
- ✅ Generates and uploads coverage reports
- ✅ Fails the build if tests fail or coverage drops below threshold

### Workflow File

See `.github/workflows/test.yml` for the complete CI configuration.

## Troubleshooting

### Tests Failing Locally But Passing in CI

- Check Node.js version matches CI (use `nvm` or similar)
- Ensure dependencies are up to date: `npm ci`
- Check environment variables
- Look for OS-specific issues (Windows vs. Linux)

### Memory Leaks or Timeouts

- Ensure all async operations complete
- Close database connections in `afterAll`
- Stop servers and timers
- Use `--detectOpenHandles` to find leaks:
  ```bash
  npm test -- --detectOpenHandles
  ```

### Module Resolution Errors

- Check that imports use `.js` extension for ES modules
- Verify `jest.config.js` module resolution settings
- Ensure `tsconfig.json` has proper ES module configuration

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript + Jest Guide](https://kulshekhar.github.io/ts-jest/)

## Future Enhancements

- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Add load testing with k6
- [ ] Add mutation testing
- [ ] Add contract testing for external APIs
- [ ] Expand integration test coverage
- [ ] Add performance benchmarks
