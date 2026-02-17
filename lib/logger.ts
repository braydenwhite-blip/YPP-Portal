import pino from "pino";

/**
 * Structured logging utility using Pino
 *
 * Provides JSON-formatted logs in production and pretty-printed logs in development.
 * Includes context tracking, error serialization, and performance monitoring.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("User logged in", { userId: "123", email: "user@example.com" });
 *   logger.error(error, "Failed to process payment", { orderId: "456" });
 */

// Determine if we're in production
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

// Configure Pino logger
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Use pretty printing in development
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
    : undefined,

  // Base context included in all logs
  base: {
    env: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
  },

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Format timestamps
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 *
 * @example
 * const userLogger = createChildLogger({ userId: "123" });
 * userLogger.info("Action performed", { action: "purchase" });
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log an HTTP request
 *
 * @example
 * logRequest("POST", "/api/upload", 201, 150, { userId: "123" });
 */
export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  context?: Record<string, unknown>
) {
  const logData = {
    method,
    path,
    status,
    durationMs,
    ...context,
  };

  if (status >= 500) {
    logger.error(logData, "HTTP request failed");
  } else if (status >= 400) {
    logger.warn(logData, "HTTP request client error");
  } else {
    logger.info(logData, "HTTP request completed");
  }
}

/**
 * Log a database query
 *
 * @example
 * logQuery("SELECT * FROM users WHERE id = $1", 45, { userId: "123" });
 */
export function logQuery(
  query: string,
  durationMs: number,
  context?: Record<string, unknown>
) {
  const logData = {
    query: query.substring(0, 200), // Truncate long queries
    durationMs,
    slow: durationMs > 1000, // Flag slow queries (>1s)
    ...context,
  };

  if (durationMs > 1000) {
    logger.warn(logData, "Slow database query detected");
  } else if (durationMs > 5000) {
    logger.error(logData, "Very slow database query detected");
  } else {
    logger.debug(logData, "Database query executed");
  }
}

/**
 * Log an authentication event
 *
 * @example
 * logAuth("login_success", { userId: "123", method: "credentials" });
 * logAuth("login_failed", { email: "user@example.com", reason: "invalid_password" });
 */
export function logAuth(
  event: "login_success" | "login_failed" | "logout" | "signup" | "password_reset",
  context: Record<string, unknown>
) {
  const logData = {
    event,
    ...context,
  };

  if (event === "login_failed") {
    logger.warn(logData, `Authentication failed: ${event}`);
  } else {
    logger.info(logData, `Authentication event: ${event}`);
  }
}

/**
 * Log a security event
 *
 * @example
 * logSecurity("rate_limit_exceeded", { ip: "192.168.1.1", endpoint: "/api/login" });
 * logSecurity("unauthorized_access", { userId: "123", resource: "/admin" });
 */
export function logSecurity(
  event: string,
  severity: "low" | "medium" | "high" | "critical",
  context: Record<string, unknown>
) {
  const logData = {
    event,
    severity,
    security: true,
    ...context,
  };

  if (severity === "critical" || severity === "high") {
    logger.error(logData, `Security event: ${event}`);
  } else if (severity === "medium") {
    logger.warn(logData, `Security event: ${event}`);
  } else {
    logger.info(logData, `Security event: ${event}`);
  }
}

/**
 * Log a business metric
 *
 * @example
 * logMetric("file_uploaded", { size: 1024000, contentType: "image/jpeg" });
 * logMetric("course_completed", { courseId: "123", userId: "456" });
 */
export function logMetric(
  metric: string,
  value: number | Record<string, unknown>,
  context?: Record<string, unknown>
) {
  const logData = {
    metric,
    value: typeof value === "number" ? value : undefined,
    ...context,
    ...(typeof value === "object" ? value : {}),
  };

  logger.info(logData, `Metric: ${metric}`);
}

/**
 * Log an error with full context
 *
 * @example
 * try {
 *   await doSomething();
 * } catch (error) {
 *   logError(error, "Failed to do something", { userId: "123" });
 * }
 */
export function logError(
  error: Error | unknown,
  message: string,
  context?: Record<string, unknown>
) {
  const logData = {
    err: error,
    ...context,
  };

  logger.error(logData, message);
}

/**
 * Create a performance timer
 *
 * @example
 * const timer = startTimer();
 * await doExpensiveOperation();
 * const durationMs = timer.end();
 * logger.info({ durationMs }, "Operation completed");
 */
export function startTimer() {
  const start = Date.now();

  return {
    end: () => Date.now() - start,
  };
}

// Export logger as default for convenience
export default logger;
