import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Messages, MessageStreamEvent } from '../../../src/resources/messages';

const API_BASE = 'https://api.rodiumai.io';

describe('Messages resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('sends the Anthropic auth headers and parses a normal response', async () => {
    nock(API_BASE, {
      reqheaders: {
        'x-api-key': 'rdk-test',
        'anthropic-version': '2023-06-01',
      },
    })
      .post('/v1/messages')
      .reply(200, {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'anthropic/claude',
        content: [{ type: 'text', text: 'hello' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 3 },
      });

    const messages = new Messages(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await messages.create({
      model: 'anthropic/claude',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 16,
    });

    expect(res.id).toBe('msg_1');
    expect(res.content[0].text).toBe('hello');
    expect(res.usage?.input_tokens).toBe(5);
    expect(res.raw).toBeDefined();
  });

  it('streams Anthropic events (no [DONE] sentinel)', async () => {
    const sse =
      [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}',
        'event: message_stop\ndata: {"type":"message_stop"}',
      ].join('\n\n') + '\n\n';

    nock(API_BASE).post('/v1/messages').reply(200, sse, { 'Content-Type': 'text/event-stream' });

    const messages = new Messages(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const stream = await messages.create({
      model: 'anthropic/claude',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 16,
      stream: true,
    });

    const events: MessageStreamEvent[] = [];
    for await (const event of stream) events.push(event);

    expect(events.map((e) => e.type)).toEqual([
      'message_start',
      'content_block_delta',
      'content_block_delta',
      'message_stop',
    ]);
    const text = events
      .filter((e) => e.type === 'content_block_delta')
      .map((e) => (e.delta as { text: string }).text)
      .join('');
    expect(text).toBe('Hello');
  });
});
