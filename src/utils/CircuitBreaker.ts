/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascade failures from external APIs by automatically
 * stopping requests when a threshold of failures is reached.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  threshold: number;        // Number of failures before opening
  timeout: number;          // Time circuit stays open (ms)
  resetTimeout: number;     // Time to wait before testing recovery (ms)
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttempt = 0;
  
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.threshold = config?.threshold || 5;
    this.timeout = config?.timeout || 60000;      // 1 minute
    this.resetTimeout = config?.resetTimeout || 30000;  // 30 seconds
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        console.log('[CircuitBreaker] Entering HALF_OPEN state');
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      console.log('[CircuitBreaker] Service recovered, closing circuit');
      this.reset();
    } else if (this.state === 'CLOSED') {
      // Gradually decrease failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.warn(`[CircuitBreaker] Failure count: ${this.failureCount}/${this.threshold}`);

    if (this.state === 'HALF_OPEN') {
      console.log('[CircuitBreaker] Service still failing, reopening circuit');
      this.open();
    } else if (this.failureCount >= this.threshold) {
      console.log('[CircuitBreaker] Threshold reached, opening circuit');
      this.open();
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.timeout;
    console.log(`[CircuitBreaker] Circuit OPEN until ${new Date(this.nextAttempt).toISOString()}`);
  }

  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    nextAttempt: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    };
  }

  /**
   * Manually force circuit open (for testing or maintenance)
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Manually reset circuit (for testing or recovery)
   */
  forceReset(): void {
    this.reset();
  }
}
