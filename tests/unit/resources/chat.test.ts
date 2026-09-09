import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Chat } from '../../../src/resources/chat';

const API_BASE = 'https://api.rodiumai.io';

describe('Chat resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('rejects empty messages', async () => {
    const chat = new Chat(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    await expect(chat.completions.create({ messages: [] as any })).rejects.toThrow(
      'messages must not be empty'
    );
  });

  it('rejects temperature out of range', async () => {
    const chat = new Chat(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    await expect(
      chat.completions.create({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 3,
      } as any)
    ).rejects.toThrow('temperature must be between 0 and 2');
  });

  it('rejects max_tokens <= 0', async () => {
    const chat = new Chat(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    await expect(
      chat.completions.create({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 0,
      } as any)
    ).rejects.toThrow('max_tokens must be greater than 0');
  });

  it('parses a normal response', async () => {
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
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });

    const chat = new Chat(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = (await chat.completions.create({
      messages: [{ role: 'user', content: 'hi' }],
    })) as any;
    expect(res.id).toBe('chatcmpl-1');
    expect(res.choices[0].message.content).toBe('ok');
    expect(res.usage.total_tokens).toBe(3);
  });

  it('parses stream chunks and skips empty choices', async () => {
    const sse =
      [
        'data: {"id":"c1","object":"chat.completion.chunk","choices":[]}',
        'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}',
        'data: [DONE]',
      ].join('\n\n') + '\n\n';

    nock(API_BASE)
      .post('/v1/chat/completions')
      .reply(200, sse, { 'Content-Type': 'text/event-stream' });

    const chat = new Chat(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const stream = (await chat.completions.create({
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })) as AsyncGenerator<any>;

    const chunks: any[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta.content).toBe('Hello');
  });
});
