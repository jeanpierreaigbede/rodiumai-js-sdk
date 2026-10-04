import nock from 'nock';
import {
  RodiumAI,
  InvalidAPIKeyError,
  InsufficientRODIError,
  RateLimitError,
  InternalServerError,
} from '../../src/index';

const API_BASE = 'https://api.rodiumai.io';

jest.setTimeout(30000);

describe('Error Scenarios Integration', () => {
  let client: RodiumAI;

  beforeEach(() => {
    client = new RodiumAI({ apiKey: 'rdk-test-key', baseURL: `${API_BASE}/v1` });
  });

  it('401 -> InvalidAPIKeyError', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(401, {}, { 'X-Request-ID': 'req-401' });

    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(InvalidAPIKeyError);
  });

  it('402 -> InsufficientRODIError', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(402, {}, { 'X-Request-ID': 'req-402' });

    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(InsufficientRODIError);
  });

  it('429 with Retry-After -> RateLimitError', async () => {
    nock(API_BASE)
      .post('/v1/chat/completions')
      .times(4)
      .reply(429, {}, { 'X-Request-ID': 'req-429', 'Retry-After': '2' });

    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(RateLimitError);
  });

  it('500 -> retried 3 times -> InternalServerError', async () => {
    nock(API_BASE).post('/v1/chat/completions').times(4).reply(500);

    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(InternalServerError);
  });
});
