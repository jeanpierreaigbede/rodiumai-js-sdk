import nock from 'nock';
import { AsyncHTTPClient } from '../../src/_http';
import {
  InternalServerError,
  InvalidAPIKeyError,
  NetworkError,
  ServiceUnavailableError,
} from '../../src/errors';

const API_BASE = 'https://api.rodiumai.io';

describe('AsyncHTTPClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('rejects http:// baseUrl', () => {
    expect(
      () => new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: 'http://api.rodiumai.io/v1' })
    ).toThrow('HTTPS is required');
  });

  it('returns successful JSON response', async () => {
    nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(200, { ok: true }, { 'X-Request-ID': 'req-ok' });

    const client = new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1` });
    const res = await client.request({ method: 'POST', path: '/chat/completions', body: { a: 1 } });

    expect(res.status).toBe(200);
    expect(res.requestId).toBe('req-ok');
    expect(res.data.ok).toBe(true);
  });

  it('maps 401 to InvalidAPIKeyError', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(401, {}, { 'X-Request-ID': 'req-401' });
    const client = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });

    await expect(client.request({ method: 'POST', path: '/chat/completions' })).rejects.toThrow(
      InvalidAPIKeyError
    );
  });

  it('maps 500 to InternalServerError', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(500, {}, { 'X-Request-ID': 'req-500' });
    const client = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });

    await expect(client.request({ method: 'POST', path: '/chat/completions' })).rejects.toThrow(
      InternalServerError
    );
  });

  it('maps 503 to ServiceUnavailableError', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(503, {}, { 'X-Request-ID': 'req-503' });
    const client = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });

    await expect(client.request({ method: 'POST', path: '/chat/completions' })).rejects.toThrow(
      ServiceUnavailableError
    );
  });

  it('throws NetworkError on transport failure', async () => {
    nock(API_BASE).post('/v1/chat/completions').replyWithError('socket hang up');
    const client = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });

    await expect(client.request({ method: 'POST', path: '/chat/completions' })).rejects.toThrow(
      NetworkError
    );
  });

  it('retries 500 then succeeds', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(500);
    nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(200, {
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1,
        model: 'auto',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
        ],
      });

    const client = new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1` });
    const response = await client.request({ method: 'POST', path: '/chat/completions' });

    expect(response.data.id).toBe('chatcmpl-1');
  });

  it('extracts backend error message', async () => {
    nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(400, { error: { message: 'Bad input' } }, { 'X-Request-ID': 'req-400' });
    const client = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });

    await expect(client.request({ method: 'POST', path: '/chat/completions' })).rejects.toThrow(
      'Bad input'
    );
  });
});
