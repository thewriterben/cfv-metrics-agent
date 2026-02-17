import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Structured Logging with Winston
 * 
 * Provides comprehensive logging with:
 * - Multiple log levels (debug, info, warn, error)
 * - Structured JSON logging for machine parsing
 * - File rotation to manage disk space
 * - Separate error logs for critical issues
 * - Colorized console output for development
 */

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logs directory if it doesn't exist
const LOG_DIR = process.env.LOG_DIR || 'logs';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cfv-metrics-agent' },
  transports: [
    // Error logs - rotated daily
    new DailyRotateFile({
      filename: `${LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '5d',
      zippedArchive: true
    }),
    // Combined logs - rotated daily
    new DailyRotateFile({
      filename: `${LOG_DIR}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '10d',
      zippedArchive: true
    }),
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: `${LOG_DIR}/exceptions-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '5d',
      zippedArchive: true
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: `${LOG_DIR}/rejections-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '5d',
      zippedArchive: true
    })
  ]
});

// Create a stream for Morgan or other HTTP loggers
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;
