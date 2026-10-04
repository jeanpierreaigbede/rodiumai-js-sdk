import nock from 'nock';
import { RodiumAI } from '../../src/index';

const API_BASE = 'https://api.rodiumai.io';

describe('Audio Integration', () => {
  let client: RodiumAI;

  beforeEach(() => {
    client = new RodiumAI({ apiKey: 'rdk-test-key', baseURL: `${API_BASE}/v1` });
  });

  it('POST /v1/audio/transcriptions returns text', async () => {
    nock(API_BASE).post('/v1/audio/transcriptions').reply(200, { text: 'Hello, world.' });

    const transcript: any = await client.audio.transcriptions.create({
      model: 'auto',
      file: Buffer.from('fake-audio'),
    });

    expect(transcript.text).toBe('Hello, world.');
  });

  it('POST /v1/audio/speech returns audio', async () => {
    nock(API_BASE)
      .post('/v1/audio/speech')
      .reply(200, Buffer.from('fake-audio-bytes'), { 'content-type': 'audio/mpeg' });

    const speech: any = await client.audio.speech.create({
      model: 'auto',
      input: 'Hello',
      voice: 'alloy',
    });

    expect(speech.contentType).toBe('audio/mpeg');
  });
});
