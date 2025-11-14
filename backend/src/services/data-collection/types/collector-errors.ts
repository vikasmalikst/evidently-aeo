/**
 * Structured error types for data collection failures
 */

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  API_ERROR = 'api_error',
  VALIDATION_ERROR = 'validation_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface ErrorContext {
  queryId: string;
  queryText: string;
  collectorType: string;
  attemptNumber: number;
  timestamp: string;
  brandId?: string;
  customerId?: string;
  stackTrace?: string;
  additionalContext?: Record<string, any>;
}

export class CollectorError extends Error {
  public readonly errorType: ErrorType;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;

  constructor(
    errorType: ErrorType,
    message: string,
    context: ErrorContext,
    retryable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'CollectorError';
    this.errorType = errorType;
    this.context = context;
    this.retryable = retryable;

    // Preserve original stack trace if available
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, CollectorError.prototype);
  }

  /**
   * Classify error from an exception
   */
  static fromError(
    error: any,
    context: Omit<ErrorContext, 'attemptNumber' | 'timestamp'>,
    attemptNumber: number = 0
  ): CollectorError {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;

    // Determine error type and retryability
    let errorType: ErrorType = ErrorType.UNKNOWN_ERROR;
    let retryable = false;

    const errorMessageLower = errorMessage.toLowerCase();

    // Network errors - retryable
    if (
      errorMessageLower.includes('network') ||
      errorMessageLower.includes('connection') ||
      errorMessageLower.includes('econnrefused') ||
      errorMessageLower.includes('enotfound') ||
      errorMessageLower.includes('econnreset') ||
      errorMessageLower.includes('fetch failed') ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ECONNRESET'
    ) {
      errorType = ErrorType.NETWORK_ERROR;
      retryable = true;
    }
    // Timeout errors - retryable
    else if (
      errorMessageLower.includes('timeout') ||
      errorMessageLower.includes('timed out') ||
      error?.name === 'AbortError' ||
      error?.code === 'ETIMEDOUT'
    ) {
      errorType = ErrorType.TIMEOUT_ERROR;
      retryable = true;
    }
    // Rate limit errors - retryable with backoff
    else if (
      errorMessageLower.includes('rate limit') ||
      errorMessageLower.includes('too many requests') ||
      errorMessageLower.includes('429') ||
      error?.status === 429 ||
      error?.statusCode === 429
    ) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      retryable = true;
    }
    // Auth errors - non-retryable
    else if (
      errorMessageLower.includes('unauthorized') ||
      errorMessageLower.includes('authentication') ||
      errorMessageLower.includes('invalid api key') ||
      errorMessageLower.includes('forbidden') ||
      error?.status === 401 ||
      error?.status === 403 ||
      error?.statusCode === 401 ||
      error?.statusCode === 403
    ) {
      errorType = ErrorType.AUTH_ERROR;
      retryable = false;
    }
    // Validation errors - non-retryable
    else if (
      errorMessageLower.includes('invalid') ||
      errorMessageLower.includes('validation') ||
      errorMessageLower.includes('not found') ||
      error?.status === 400 ||
      error?.status === 404 ||
      error?.statusCode === 400 ||
      error?.statusCode === 404
    ) {
      errorType = ErrorType.VALIDATION_ERROR;
      retryable = false;
    }
    // API errors - conditionally retryable (5xx are retryable)
    else if (
      error?.status >= 500 ||
      error?.statusCode >= 500 ||
      errorMessageLower.includes('internal server error') ||
      errorMessageLower.includes('service unavailable') ||
      errorMessageLower.includes('bad gateway')
    ) {
      errorType = ErrorType.API_ERROR;
      retryable = true;
    }
    // Unknown errors - default to non-retryable
    else {
      errorType = ErrorType.UNKNOWN_ERROR;
      retryable = false;
    }

    const fullContext: ErrorContext = {
      ...context,
      attemptNumber,
      timestamp: new Date().toISOString(),
      stackTrace: errorStack,
      additionalContext: {
        originalErrorName: error?.name,
        originalErrorCode: error?.code,
        originalErrorStatus: error?.status || error?.statusCode
      }
    };

    return new CollectorError(errorType, errorMessage, fullContext, retryable, error);
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): any {
    return {
      errorType: this.errorType,
      message: this.message,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack
    };
  }

  /**
   * Convert to database format
   */
  toDatabaseFormat(): {
    error_message: string;
    error_metadata: {
      error_type: string;
      retryable: boolean;
      context: ErrorContext;
    };
  } {
    return {
      error_message: this.message,
      error_metadata: {
        error_type: this.errorType,
        retryable: this.retryable,
        context: this.context
      }
    };
  }
}

