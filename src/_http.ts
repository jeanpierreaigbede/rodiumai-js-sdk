import { randomUUID as nodeRandomUUID } from 'node:crypto';
import fetch, { Response } from 'node-fetch';
import { VERSION } from './_version.js';
import {
  NetworkError,
  RateLimitError,
  RodiumAIError,
  TimeoutError,
  mapHttpStatus,
} from './errors.js';

function extractBackendError(data: unknown): { message: string | null; code: string | null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { message: null, code: null };
  }
  const record = data as Record<string, unknown>;

  if (record.type === 'error' && record.error && typeof record.error === 'object') {
    const err = record.error as Record<string, unknown>;
    return {
      message: (err.message as string) ?? null,
      code: (err.type as string) ?? null,
    };
  }

  const err = record.error;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    return {
      message: (obj.message as string) ?? null,
      code: (obj.code as string) ?? (obj.type as string) ?? null,
    };
  }
  if (typeof err === 'string') {
    return { message: err, code: null };
  }
  return { message: null, code: null };
}

interface RequestOptions {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  formFields?: Record<string, string | number | undefined | null>;
  files?: Record<string, Buffer | Blob | string>;
  timeout?: number;
  extraHeaders?: Record<string, string>;
  params?: Record<string, string | undefined>;
}

interface RequestResult {
  status: number;
  data: Record<string, unknown>;
  requestId: string;
}

export class AsyncHTTPClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private streamTimeout: number;
  private maxRetries: number;

  constructor({
    apiKey,
    baseUrl = 'https://api.rodiumai.io/v1',
    timeout = 30_000,
    streamTimeout = 600_000,
    maxRetries = 3,
  }: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    streamTimeout?: number;
    maxRetries?: number;
  }) {
    if (baseUrl.startsWith('http://') && !baseUrl.includes('localhost')) {
      throw new Error(
        'HTTPS is required for production. Use http://localhost:8001/v1 for local development only.'
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = timeout;
    this.streamTimeout = streamTimeout;
    this.maxRetries = maxRetries;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-RodiumAI-SDK': `javascript/${VERSION}`,
      'X-RodiumAI-Version': VERSION,
      'User-Agent': `RodiumAI-JS-SDK/${VERSION}`,
      ...extra,
    };
  }

  private requestId(): string {
    return typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : nodeRandomUUID();
  }

  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async doFetch(
    url: string,
    opts: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<Response> {
    try {
      return await fetch(url, { ...opts, signal });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(this.timeout / 1000);
      }
      throw new NetworkError((err as Error).message);
    }
  }

  private mapResponseError(
    status: number,
    data: unknown,
    requestId: string,
    headers: { get(name: string): string | null }
  ): RodiumAIError {
    const error = mapHttpStatus(status, requestId);
    const { message, code } = extractBackendError(data);
    if (message) error.message = message;
    if (code) error.errorCode = code;

    if (status === 429 && error instanceof RateLimitError) {
      const retryAfterStr = headers.get('Retry-After') ?? '1';
      const retryAfter = Number.parseFloat(retryAfterStr);
      error.retryAfter = Number.isFinite(retryAfter) ? retryAfter : 1;
    }
    return error;
  }

  async request(opts: RequestOptions): Promise<RequestResult> {
    const url = this.buildUrl(opts.path, opts.params);
    const headers = this.getHeaders(opts.extraHeaders);
    const rid = this.requestId();
    let retryCount = 0;
    const effectiveTimeout = opts.timeout ?? this.timeout;

    while (retryCount <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeout);

      const fetchOpts: Record<string, unknown> = {
        method: opts.method,
        headers: { ...headers },
      };

      if (opts.files) {
        const form = new FormData();
        for (const [key, value] of Object.entries(opts.files)) {
          if (Buffer.isBuffer(value)) {
            form.append(key, new Blob([value]), 'upload.bin');
          } else {
            form.append(key, value as Blob | string);
          }
        }
        if (opts.formFields) {
          for (const [key, value] of Object.entries(opts.formFields)) {
            if (value !== undefined && value !== null) {
              form.append(key, String(value));
            }
          }
        }
        delete (fetchOpts.headers as Record<string, string>)['Content-Type'];
        fetchOpts.body = form;
      } else if (opts.body) {
        (fetchOpts.headers as Record<string, string>)['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(opts.body);
      }

      try {
        const response = await this.doFetch(url, fetchOpts, controller.signal);
        clearTimeout(timer);
        const respRid = response.headers.get('X-Request-ID') ?? rid;
        const contentType = response.headers.get('content-type') ?? '';
        const text = await response.text();
        let data: Record<string, unknown> = {};
        if (text && contentType.includes('application/json')) {
          data = JSON.parse(text) as Record<string, unknown>;
        }

        if (response.status < 400) {
          return { status: response.status, data, requestId: respRid };
        }

        const error = this.mapResponseError(response.status, data, respRid, response.headers);

        if ([429, 500, 502, 503, 504].includes(response.status)) {
          if (retryCount < this.maxRetries) {
            retryCount++;
            const sleepMs = Math.pow(2, retryCount - 1) * 1000 * (0.9 + Math.random() * 0.2);
            await new Promise((r) => setTimeout(r, sleepMs));
            continue;
          }
        }

        throw error;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof RodiumAIError) {
          if (err instanceof TimeoutError || err instanceof NetworkError) {
            if (retryCount < this.maxRetries) {
              retryCount++;
              const sleepMs = Math.pow(2, retryCount - 1) * 1000 * (0.9 + Math.random() * 0.2);
              await new Promise((r) => setTimeout(r, sleepMs));
              continue;
            }
            throw err;
          }
          throw err;
        }
        throw err;
      }
    }

    throw new RodiumAIError({ message: 'Request failed after retries', code: 0 });
  }

  async requestBinary(opts: Omit<RequestOptions, 'files' | 'formFields'>): Promise<{
    content: ArrayBuffer;
    contentType: string;
  }> {
    const url = this.buildUrl(opts.path, opts.params);
    const headers = this.getHeaders({ 'Content-Type': 'application/json', ...opts.extraHeaders });
    const effectiveTimeout = opts.timeout ?? this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await this.doFetch(
        url,
        {
          method: opts.method,
          headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        },
        controller.signal
      );
      clearTimeout(timer);

      if (response.status < 400) {
        return {
          content: await response.arrayBuffer(),
          contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        };
      }

      const text = await response.text();
      const data =
        text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : {};
      const rid = response.headers.get('X-Request-ID') ?? this.requestId();
      throw this.mapResponseError(response.status, data, rid, response.headers);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(effectiveTimeout / 1000);
      }
      if (err instanceof RodiumAIError) throw err;
      throw new NetworkError((err as Error).message);
    }
  }

  async *stream(
    path: string,
    body: Record<string, unknown>,
    timeout?: number
  ): AsyncGenerator<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const effectiveTimeout = timeout ?? this.streamTimeout;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        const rid = response.headers.get('X-Request-ID') ?? this.requestId();
        throw this.mapResponseError(response.status, data, rid, response.headers);
      }

      if (!response.body) {
        throw new NetworkError('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      for await (const chunk of response.body as AsyncIterable<Buffer>) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6).trim();
            if (payload === '[DONE]') return;
            if (payload) {
              yield JSON.parse(payload);
            }
          }
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(effectiveTimeout / 1000);
      }
      if (err instanceof RodiumAIError) throw err;
      throw new NetworkError((err as Error).message);
    }
  }
}
