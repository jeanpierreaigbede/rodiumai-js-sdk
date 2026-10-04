import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Images } from '../../../src/resources/images';

const API_BASE = 'https://api.rodiumai.io';

describe('Images resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('parses image generation response with urls', async () => {
    nock(API_BASE)
      .post('/v1/images/generations')
      .reply(200, {
        created: 123,
        data: [{ url: 'https://example.com/img.png' }],
      });

    const images = new Images(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await images.generate({ prompt: 'cat' });
    expect(res.created).toBe(123);
    expect(res.data[0].url).toBe('https://example.com/img.png');
  });

  it('parses image generation response with b64_json', async () => {
    nock(API_BASE)
      .post('/v1/images/generations')
      .reply(200, {
        created: 123,
        data: [{ b64_json: 'AAAA' }],
      });

    const images = new Images(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await images.generate({ prompt: 'cat' });
    expect(res.data[0].b64_json).toBe('AAAA');
  });
});
