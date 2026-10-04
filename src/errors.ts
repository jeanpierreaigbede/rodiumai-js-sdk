export class RodiumAIError extends Error {
  public code: number;
  public errorCode: string;
  public requestId: string | null;
  public fixSuggestion: string | null;
  public docsUrl: string | null;

  constructor({
    message,
    code = 0,
    errorCode = 'unknown_error',
    requestId = null,
    fixSuggestion = null,
    docsUrl = null,
  }: {
    message: string;
    code?: number;
    errorCode?: string;
    requestId?: string | null;
    fixSuggestion?: string | null;
    docsUrl?: string | null;
  }) {
    super(message);
    this.message = message;
    this.name = this.constructor.name;
    this.code = code;
    this.errorCode = errorCode;
    this.requestId = requestId;
    this.fixSuggestion = fixSuggestion;
    this.docsUrl = docsUrl;
  }

  toJSON(): Record<string, unknown> {
    return {
      message: this.message,
      code: this.code,
      errorCode: this.errorCode,
      requestId: this.requestId,
      fixSuggestion: this.fixSuggestion,
      docsUrl: this.docsUrl,
    };
  }
}

export class InvalidAPIKeyError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'Invalid or missing API key. Provide a valid RodiumAI API key.',
      code: 401,
      errorCode: 'invalid_api_key',
      requestId: requestId ?? null,
      fixSuggestion: 'Check your API key at https://rodiumai.io/dashboard',
      docsUrl: 'https://docs.rodiumai.io/api-keys',
    });
  }
}

export class InsufficientRODIError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'You do not have enough RODI credits to complete this request.',
      code: 402,
      errorCode: 'insufficient_balance',
      requestId: requestId ?? null,
      fixSuggestion: 'Top up your wallet at https://rodiumai.io/wallet',
      docsUrl: 'https://docs.rodiumai.io/billing',
    });
  }
}

export class PermissionDeniedError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'You do not have permission to perform this action.',
      code: 403,
      errorCode: 'permission_denied',
      requestId: requestId ?? null,
      fixSuggestion:
        'Verify your API key has the required permissions at https://rodiumai.io/dashboard',
      docsUrl: 'https://docs.rodiumai.io/permissions',
    });
  }
}

export class ModelNotFoundError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'The requested model was not found or is not available.',
      code: 404,
      errorCode: 'model_not_found',
      requestId: requestId ?? null,
      fixSuggestion: 'Check available models at https://docs.rodiumai.io/models',
      docsUrl: 'https://docs.rodiumai.io/models',
    });
  }
}

export class RateLimitError extends RodiumAIError {
  public retryAfter: number | null;

  constructor(requestId?: string, retryAfter?: number) {
    super({
      message: 'Rate limit exceeded. Too many requests.',
      code: 429,
      errorCode: 'rate_limit_exceeded',
      requestId: requestId ?? null,
      fixSuggestion:
        'Retry after the suggested delay. Consider upgrading your plan at https://rodiumai.io/pricing',
      docsUrl: 'https://docs.rodiumai.io/rate-limits',
    });
    this.retryAfter = retryAfter ?? null;
  }
}

export class InternalServerError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'Internal server error. Our team has been notified.',
      code: 500,
      errorCode: 'internal_error',
      requestId: requestId ?? null,
      fixSuggestion:
        'Retry your request. If the problem persists, contact support at https://rodiumai.io/support',
      docsUrl: 'https://docs.rodiumai.io/troubleshooting',
    });
  }
}

export class ServiceUnavailableError extends RodiumAIError {
  constructor(requestId?: string) {
    super({
      message: 'Service is temporarily unavailable. Please try again later.',
      code: 503,
      errorCode: 'service_unavailable',
      requestId: requestId ?? null,
      fixSuggestion: 'Retry after a few seconds. Check https://status.rodiumai.io for outages.',
      docsUrl: 'https://status.rodiumai.io',
    });
  }
}

export class TimeoutError extends RodiumAIError {
  public elapsed: number;

  constructor(elapsed: number, requestId?: string) {
    super({
      message: `Request timed out after ${elapsed.toFixed(1)}s.`,
      code: 408,
      errorCode: 'timeout',
      requestId: requestId ?? null,
      fixSuggestion: 'Check your network connection or increase the timeout.',
      docsUrl: 'https://docs.rodiumai.io/timeouts',
    });
    this.elapsed = elapsed;
  }
}

export class NetworkError extends RodiumAIError {
  constructor(message = 'Network connection failed.') {
    super({
      message,
      code: 0,
      errorCode: 'network_error',
      fixSuggestion: 'Check your internet connection and firewall settings.',
      docsUrl: 'https://docs.rodiumai.io/troubleshooting',
    });
  }
}

const HTTP_STATUS_TO_ERROR: Record<number, new (...args: any[]) => RodiumAIError> = {
  401: InvalidAPIKeyError,
  402: InsufficientRODIError,
  403: PermissionDeniedError,
  404: ModelNotFoundError,
  429: RateLimitError,
  500: InternalServerError,
  503: ServiceUnavailableError,
};

const GENERIC_ERRORS: Record<
  number,
  { errorCode: string; message: string; fixSuggestion: string }
> = {
  400: {
    errorCode: 'invalid_request',
    message: 'Invalid request. Check the parameters and try again.',
    fixSuggestion: 'Verify your request body parameters match the API documentation.',
  },
  422: {
    errorCode: 'validation_error',
    message: 'Request validation failed.',
    fixSuggestion: 'Check that all required fields are present and correctly formatted.',
  },
};

export function mapHttpStatus(status: number, requestId?: string): RodiumAIError {
  const Cls = HTTP_STATUS_TO_ERROR[status];
  if (!Cls) {
    const generic = GENERIC_ERRORS[status];
    if (generic) {
      return new RodiumAIError({
        message: generic.message,
        code: status,
        errorCode: generic.errorCode,
        requestId: requestId ?? null,
        fixSuggestion: generic.fixSuggestion,
        docsUrl: 'https://docs.rodiumai.io/api-reference',
      });
    }
    return new RodiumAIError({
      message: `Unexpected error (code ${status}). Please try again or contact support.`,
      code: status,
      errorCode: `error_${status}`,
      requestId: requestId ?? null,
      fixSuggestion: 'If the problem persists, contact support at https://rodiumai.io/support',
      docsUrl: 'https://docs.rodiumai.io/troubleshooting',
    });
  }
  if (Cls === RateLimitError) {
    return new Cls(requestId);
  }
  return new (Cls as new (requestId?: string) => RodiumAIError)(requestId);
}

export { InsufficientRODIError as InsufficientBalanceError };
