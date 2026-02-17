import { jest } from '@jest/globals';
import type Redis from 'ioredis';

/**
 * Create a mock Redis client
 */
export function createMockRedis(): jest.Mocked<Redis> {
  const mockRedis = {
    get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
    set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    setex: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    del: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    keys: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    dbsize: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    info: jest.fn<() => Promise<string>>().mockResolvedValue(''),
    ping: jest.fn<() => Promise<string>>().mockResolvedValue('PONG'),
    quit: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    disconnect: jest.fn<() => void>(),
    on: jest.fn<() => void>(),
    once: jest.fn<() => void>(),
    off: jest.fn<() => void>(),
  } as any;

  return mockRedis;
}

/**
 * Create a mock axios instance
 */
export function createMockAxios() {
  return {
    get: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
    post: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
    put: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
    delete: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
    request: jest.fn<() => Promise<any>>().mockResolvedValue({ data: {} }),
    defaults: {
      headers: {
        common: {},
      },
    },
    interceptors: {
      request: {
        use: jest.fn<() => void>(),
        eject: jest.fn<() => void>(),
      },
      response: {
        use: jest.fn<() => void>(),
        eject: jest.fn<() => void>(),
      },
    },
  };
}

/**
 * Create a mock database connection
 */
export function createMockDbConnection() {
  return {
    query: jest.fn<() => Promise<any>>().mockResolvedValue([[], []]),
    execute: jest.fn<() => Promise<any>>().mockResolvedValue([[], []]),
    beginTransaction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    commit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    rollback: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    release: jest.fn<() => void>(),
    end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock database pool
 */
export function createMockDbPool() {
  return {
    getConnection: jest.fn<() => Promise<any>>().mockResolvedValue(createMockDbConnection()),
    query: jest.fn<() => Promise<any>>().mockResolvedValue([[], []]),
    execute: jest.fn<() => Promise<any>>().mockResolvedValue([[], []]),
    end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    on: jest.fn<() => void>(),
  };
}
