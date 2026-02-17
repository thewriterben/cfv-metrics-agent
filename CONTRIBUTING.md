# Contributing to CFV Metrics Agent

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18.x, 20.x, or 22.x
- npm 9.x or later
- Git
- MySQL 8.x (for integration tests)
- Redis 7.x (for caching and integration tests)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/thewriterben/cfv-metrics-agent.git
   cd cfv-metrics-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Run tests to verify setup**
   ```bash
   npm test
   ```

## Development Workflow

### 1. Create a Branch

Create a feature branch from `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test additions or modifications
- `refactor/` - Code refactoring

### 2. Make Changes

Follow these guidelines:

#### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (enforced by TypeScript compiler)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

#### Testing Requirements ⚠️

**All code changes must include tests!**

- **Unit tests**: Required for all new functions and classes
- **Integration tests**: Required for API endpoints and external integrations
- **Coverage**: Maintain or improve overall coverage (target: 70%+)

**Before submitting a PR:**

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Check coverage
npm run test:coverage

# Run type checking
npm run type-check

# Run linting
npm run lint
```

### 3. Write Tests

See [TESTING.md](./TESTING.md) for comprehensive testing guidelines.

#### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { YourClass } from '../path/to/YourClass.js';

describe('YourClass', () => {
  describe('yourMethod', () => {
    it('should handle valid input', () => {
      const instance = new YourClass();
      const result = instance.yourMethod('valid');
      
      expect(result).toBe('expected');
    });

    it('should handle edge cases', () => {
      const instance = new YourClass();
      
      expect(() => instance.yourMethod(null)).toThrow();
    });
  });
});
```

#### Integration Test Example

For integration tests that require external services, use the skip pattern:

```typescript
const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';
const testIf = shouldRun ? it : it.skip;

testIf('should integrate with external service', async () => {
  // Your integration test
});
```

### 4. Commit Changes

Use conventional commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/modifications
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

Example:
```bash
git commit -m "feat(calculator): add support for multiple currencies

- Adds currency conversion logic
- Updates CFVCalculator to handle currency parameter
- Includes unit tests for currency conversion"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub:

1. Go to the repository
2. Click "New Pull Request"
3. Select your branch
4. Fill in the PR template
5. Link any related issues

## Pull Request Guidelines

### PR Checklist

Before submitting, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Coverage is maintained or improved
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is documented (JSDoc comments for public APIs)
- [ ] TESTING.md is updated if adding new test utilities
- [ ] README.md is updated if adding new features
- [ ] No sensitive data (API keys, credentials) is committed

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Coverage
- Current coverage: X%
- Coverage after changes: Y%

## Checklist
- [ ] Tests pass locally
- [ ] Code follows project style
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
```

### Review Process

1. **Automated Checks**: CI will run all tests and checks
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, PR will be merged

## Testing Standards

### Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Core utilities (CFVCalculator, etc.) | 90% |
| Validators | 85% |
| Cache management | 80% |
| Collectors | 75% |
| API endpoints | 80% |
| Database operations | 75% |

### Test Organization

Place tests in appropriate directories:

```
src/
  __tests__/
    unit/          # Fast, isolated tests
    integration/   # Tests with external dependencies
    fixtures/      # Test data
    helpers/       # Test utilities
```

### Running Tests in CI

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Multiple Node.js versions (18.x, 20.x, 22.x)

## Code Review Guidelines

### For Contributors

- Keep PRs focused and small (< 500 lines when possible)
- Respond to feedback promptly
- Be open to suggestions
- Test edge cases
- Document complex logic

### For Reviewers

- Be respectful and constructive
- Check for test coverage
- Verify documentation is updated
- Look for security issues
- Consider performance implications

## Common Issues

### Tests Failing in CI But Passing Locally

1. Check Node.js version matches CI
2. Run `npm ci` instead of `npm install`
3. Check environment variables
4. Look for OS-specific issues

### Coverage Below Threshold

1. Add missing tests for uncovered code
2. Remove dead code
3. Test edge cases and error paths

### Type Errors

1. Ensure all imports use `.js` extension for ES modules
2. Check `tsconfig.json` configuration
3. Update type definitions if needed

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email the maintainers directly
3. Provide details about the vulnerability
4. Allow time for a fix before public disclosure

### Security Best Practices

- Never commit API keys or credentials
- Use environment variables for secrets
- Validate all user input
- Keep dependencies updated
- Follow OWASP security guidelines

## Additional Resources

- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [README.md](./README.md) - Project overview
- [Jest Documentation](https://jestjs.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Questions?

- Open an issue for general questions
- Check existing issues and PRs
- Review documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).

---

Thank you for contributing to the CFV Metrics Agent! 🚀
