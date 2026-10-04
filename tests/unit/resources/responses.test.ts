import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Responses, ResponseStreamEvent } from '../../../src/resources/responses';

const API_BASE = 'https://api.rodiumai.io';

describe('Responses resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('requires a model', async () => {
    const responses = new Responses(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    await expect(responses.create({ input: 'hi' } as any)).rejects.toThrow('model is required');
  });

  it('parses a normal response and aggregates output_text', async () => {
    nock(API_BASE)
      .post('/v1/responses')
      .reply(200, {
        id: 'resp_1',
        object: 'response',
        model: 'openai/gpt-4o',
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'Hel' },
              { type: 'output_text', text: 'lo' },
            ],
          },
        ],
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      });

    const responses = new Responses(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await responses.create({ model: 'openai/gpt-4o', input: 'hi' });

    expect(res.id).toBe('resp_1');
    expect(res.output_text).toBe('Hello');
    expect(res.usage?.total_tokens).toBe(6);
  });

  it('streams response.output_text.delta events', async () => {
    const sse =
      [
        'data: {"type":"response.created","response":{"id":"resp_1"}}',
        'data: {"type":"response.output_text.delta","delta":"Hel"}',
        'data: {"type":"response.output_text.delta","delta":"lo"}',
        'data: {"type":"response.completed"}',
      ].join('\n\n') + '\n\n';

    nock(API_BASE).post('/v1/responses').reply(200, sse, { 'Content-Type': 'text/event-stream' });

    const responses = new Responses(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const stream = await responses.create({ model: 'openai/gpt-4o', input: 'hi', stream: true });

    const events: ResponseStreamEvent[] = [];
    for await (const event of stream) events.push(event);

    const text = events
      .filter((e) => e.type === 'response.output_text.delta')
      .map((e) => e.delta ?? '')
      .join('');
    expect(text).toBe('Hello');
    expect(events[events.length - 1].type).toBe('response.completed');
  });
});
