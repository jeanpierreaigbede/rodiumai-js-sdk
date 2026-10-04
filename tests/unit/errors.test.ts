import {
  RodiumAIError,
  InvalidAPIKeyError,
  InsufficientRODIError,
  PermissionDeniedError,
  ModelNotFoundError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  TimeoutError,
  NetworkError,
  mapHttpStatus,
} from '../../src/errors';

describe('Error Hierarchy', () => {
  it('InvalidAPIKeyError has code 401 and errorCode invalid_api_key', () => {
    const err = new InvalidAPIKeyError('req-1');
    expect(err.code).toBe(401);
    expect(err.errorCode).toBe('invalid_api_key');
    expect(err.fixSuggestion).toContain('rodiumai.io');
  });

  it('InsufficientRODIError has code 402 and errorCode insufficient_balance', () => {
    const err = new InsufficientRODIError('req-2');
    expect(err.code).toBe(402);
    expect(err.errorCode).toBe('insufficient_balance');
  });

  it('PermissionDeniedError has code 403 and errorCode permission_denied', () => {
    const err = new PermissionDeniedError('req-3');
    expect(err.code).toBe(403);
    expect(err.errorCode).toBe('permission_denied');
  });

  it('ModelNotFoundError has code 404 and errorCode model_not_found', () => {
    const err = new ModelNotFoundError('req-4');
    expect(err.code).toBe(404);
    expect(err.errorCode).toBe('model_not_found');
  });

  it('RateLimitError has code 429, errorCode rate_limit_exceeded, retryAfter', () => {
    const err = new RateLimitError('req-5', 2.5);
    expect(err.code).toBe(429);
    expect(err.errorCode).toBe('rate_limit_exceeded');
    expect(err.retryAfter).toBe(2.5);
  });

  it('InternalServerError has code 500 and errorCode internal_error', () => {
    const err = new InternalServerError('req-6');
    expect(err.code).toBe(500);
    expect(err.errorCode).toBe('internal_error');
  });

  it('ServiceUnavailableError has code 503 and errorCode service_unavailable', () => {
    const err = new ServiceUnavailableError('req-7');
    expect(err.code).toBe(503);
    expect(err.errorCode).toBe('service_unavailable');
  });

  it('TimeoutError has code 408, errorCode timeout, elapsed', () => {
    const err = new TimeoutError(30.5, 'req-8');
    expect(err.code).toBe(408);
    expect(err.errorCode).toBe('timeout');
    expect(err.elapsed).toBe(30.5);
  });

  it('NetworkError has code 0 and errorCode network_error', () => {
    const err = new NetworkError();
    expect(err.code).toBe(0);
    expect(err.errorCode).toBe('network_error');
  });

  it('all errors extend RodiumAIError', () => {
    const errors = [
      new InvalidAPIKeyError(),
      new InsufficientRODIError(),
      new PermissionDeniedError(),
      new ModelNotFoundError(),
      new RateLimitError(),
      new InternalServerError(),
      new ServiceUnavailableError(),
      new TimeoutError(1),
      new NetworkError(),
    ];
    errors.forEach((e) => expect(e).toBeInstanceOf(RodiumAIError));
  });

  it('mapHttpStatus returns correct error types with errorCode', () => {
    expect(mapHttpStatus(401)).toBeInstanceOf(InvalidAPIKeyError);
    expect(mapHttpStatus(401).errorCode).toBe('invalid_api_key');
    expect(mapHttpStatus(402)).toBeInstanceOf(InsufficientRODIError);
    expect(mapHttpStatus(402).errorCode).toBe('insufficient_balance');
    expect(mapHttpStatus(403)).toBeInstanceOf(PermissionDeniedError);
    expect(mapHttpStatus(403).errorCode).toBe('permission_denied');
    expect(mapHttpStatus(404)).toBeInstanceOf(ModelNotFoundError);
    expect(mapHttpStatus(404).errorCode).toBe('model_not_found');
    expect(mapHttpStatus(429)).toBeInstanceOf(RateLimitError);
    expect(mapHttpStatus(429).errorCode).toBe('rate_limit_exceeded');
    expect(mapHttpStatus(500)).toBeInstanceOf(InternalServerError);
    expect(mapHttpStatus(500).errorCode).toBe('internal_error');
    expect(mapHttpStatus(503)).toBeInstanceOf(ServiceUnavailableError);
    expect(mapHttpStatus(503).errorCode).toBe('service_unavailable');
  });

  it('mapHttpStatus returns base error with error_418 for unknown codes', () => {
    const err = mapHttpStatus(418);
    expect(err).toBeInstanceOf(RodiumAIError);
    expect(err.errorCode).toBe('error_418');
  });
});
