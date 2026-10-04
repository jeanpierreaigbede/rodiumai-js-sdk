import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Embeddings } from '../../../src/resources/embeddings';

const API_BASE = 'https://api.rodiumai.io';

describe('Embeddings resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('parses a single embedding response', async () => {
    nock(API_BASE)
      .post('/v1/embeddings')
      .reply(200, {
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
        model: 'auto',
        usage: { prompt_tokens: 3, total_tokens: 3 },
      });

    const embeddings = new Embeddings(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await embeddings.create({ input: 'hello' });
    expect(res.data[0].index).toBe(0);
    expect(res.data[0].embedding).toEqual([0.1, 0.2]);
    expect(res.usage?.prompt_tokens).toBe(3);
  });

  it('parses a batch embedding response', async () => {
    nock(API_BASE)
      .post('/v1/embeddings')
      .reply(200, {
        object: 'list',
        data: [
          { object: 'embedding', index: 0, embedding: [0.1] },
          { object: 'embedding', index: 1, embedding: [0.2] },
        ],
        model: 'auto',
      });

    const embeddings = new Embeddings(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await embeddings.create({ input: ['a', 'b'] });
    expect(res.data).toHaveLength(2);
    expect(res.data[1].index).toBe(1);
  });
});
