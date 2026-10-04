import nock from 'nock';
import { RodiumAI } from '../../src/index';

const API_BASE = 'https://api.rodiumai.io';

jest.setTimeout(30000);

describe('Chat Integration', () => {
  let client: RodiumAI;

  beforeEach(() => {
    client = new RodiumAI({ apiKey: 'rdk-test-key', baseURL: `${API_BASE}/v1` });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('POST /v1/chat/completions returns parsed response', async () => {
    const scope = nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(200, {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1715000000,
        model: 'auto',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

    const response: any = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.id).toBe('chatcmpl-123');
    expect(response.choices[0].message.content).toBe('Hello!');
    expect(response.usage.total_tokens).toBe(30);
    expect(scope.isDone()).toBe(true);
  });

  it('request headers validated', async () => {
    const scope = nock(API_BASE)
      .post('/v1/chat/completions', (body) => {
        expect(body.model).toBe('auto');
        return true;
      })
      .reply(200, {
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1,
        model: 'auto',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
        ],
      });

    await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(scope.isDone()).toBe(true);
  });

  it('streaming SSE parsed chunk by chunk', async () => {
    const sseData =
      [
        'data: {"id":"chunk-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
        'data: {"id":"chunk-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}',
        'data: [DONE]',
      ].join('\n\n') + '\n\n';

    nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(200, sseData, { 'Content-Type': 'text/event-stream' });

    const stream: any = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });

    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0].choices[0].delta.content).toBe('Hello');
    expect(chunks[1].choices[0].delta.content).toBe(' world');
  });

  it('invalid model returns error', async () => {
    nock(API_BASE).post('/v1/chat/completions').reply(404, {}, { 'X-Request-ID': 'req-404' });

    await expect(
      client.chat.completions.create({
        model: 'unknown',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow();
  });
});
