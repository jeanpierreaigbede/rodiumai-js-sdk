import nock from 'nock';
import { RodiumAI, InvalidAPIKeyError, InternalServerError } from '../../src/index';

const API_BASE = 'https://api.rodiumai.io';

jest.setTimeout(30000);

describe('Retry Logic', () => {
  let client: RodiumAI;

  beforeEach(() => {
    client = new RodiumAI({ apiKey: 'rdk-test-key', baseURL: `${API_BASE}/v1`, timeout: 5000 });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('does not retry on 401', async () => {
    const scope = nock(API_BASE).post('/v1/chat/completions').reply(401);
    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(InvalidAPIKeyError);
    expect(scope.isDone()).toBe(true);
  });

  it('does not retry on 404', async () => {
    const scope = nock(API_BASE).post('/v1/chat/completions').reply(404);
    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow();
    expect(scope.isDone()).toBe(true);
  });

  it('retries on 500 then succeeds', async () => {
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

    const response: any = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.id).toBe('chatcmpl-1');
  });

  it('retries 3 times on 500 then raises InternalServerError', async () => {
    const scope = nock(API_BASE).post('/v1/chat/completions').times(4).reply(500);

    await expect(
      client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(InternalServerError);

    expect(scope.isDone()).toBe(true);
  });
});
