import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { RodiumAI } from '../../../src/client';
import { Generations } from '../../../src/resources/video';

const API_BASE = 'https://api.rodiumai.io';

describe('Video resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('creates video with url response', async () => {
    nock(API_BASE)
      .post('/v1/videos/generations', {
        model: 'openai/gpt-4o',
        prompt: 'A sunset over the savannah',
      })
      .reply(200, {
        created: 1700000000,
        data: [{ url: 'https://example.com/video.mp4' }],
      });

    const http = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });
    const video = new Generations(http);
    const res = await video.create({ prompt: 'A sunset over the savannah' });

    expect(res.created).toBe(1700000000);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].url).toBe('https://example.com/video.mp4');
  });

  it('creates video with duration_seconds', async () => {
    nock(API_BASE)
      .post('/v1/videos/generations', {
        model: 'openai/gpt-4o',
        prompt: 'A dancing robot',
        duration_seconds: 5,
      })
      .reply(200, {
        created: 1700000000,
        data: [{ b64_json: 'AAAA_VIDEO_BASE64' }],
      });

    const http = new AsyncHTTPClient({
      apiKey: 'rdk-test',
      baseUrl: `${API_BASE}/v1`,
      maxRetries: 0,
    });
    const video = new Generations(http);
    const res = await video.create({ prompt: 'A dancing robot', duration_seconds: 5 });

    expect(res.data[0].b64_json).toBe('AAAA_VIDEO_BASE64');
  });

  it('calls video via client.video and client.videos shortcuts', async () => {
    nock(API_BASE)
      .post('/v1/videos/generations')
      .twice()
      .reply(200, {
        created: 1700000000,
        data: [{ url: 'https://example.com/shortcut.mp4' }],
      });

    const client = new RodiumAI({ apiKey: 'rdk-test', baseURL: `${API_BASE}/v1` });
    const res1 = await client.video({ prompt: 'Test video 1' });
    const res2 = await client.videos({ prompt: 'Test video 2' });

    expect(res1.data[0].url).toBe('https://example.com/shortcut.mp4');
    expect((res2 as any).data[0].url).toBe('https://example.com/shortcut.mp4');
  });
});
