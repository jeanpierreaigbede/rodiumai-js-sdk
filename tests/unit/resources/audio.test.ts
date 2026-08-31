import nock from 'nock';
import { AsyncHTTPClient } from '../../../src/_http';
import { Audio } from '../../../src/resources/audio';

const API_BASE = 'https://api.rodiumai.io';

describe('Audio resource', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('parses transcription response and accepts language', async () => {
    nock(API_BASE).post('/v1/audio/transcriptions').reply(200, { text: 'hello world' });

    const audio = new Audio(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await audio.transcriptions.create({
      file: Buffer.from('fake'),
      language: 'en',
    } as any);
    expect(res.text).toBe('hello world');
  });

  it('parses speech binary response', async () => {
    nock(API_BASE)
      .post('/v1/audio/speech')
      .reply(200, Buffer.from('fake-audio'), { 'content-type': 'audio/wav' });

    const audio = new Audio(
      new AsyncHTTPClient({ apiKey: 'rdk-test', baseUrl: `${API_BASE}/v1`, maxRetries: 0 })
    );
    const res = await audio.speech.create({ input: 'hello' });
    expect(res.contentType).toBe('audio/wav');
    expect(res.content).toBeInstanceOf(ArrayBuffer);
  });
});
