import { AsyncHTTPClient } from '../_http.js';

export interface Transcription {
  text: string;
}

export interface SpeechResponse {
  content: ArrayBuffer;
  contentType: string;
}

export class Transcriptions {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async create({
    model = Transcriptions.DEFAULT_MODEL,
    file,
    language,
    timeout,
    ...rest
  }: {
    model?: string;
    file: Buffer | Blob;
    language?: string;
    timeout?: number;
    [key: string]: unknown;
  }): Promise<Transcription> {
    const formFields: Record<string, string | undefined> = {
      model,
      language,
      ...(rest as Record<string, string>),
    };

    const { data } = await this.http.request({
      method: 'POST',
      path: '/audio/transcriptions',
      formFields,
      files: { file: file as Buffer },
      timeout,
    });

    return { text: (data.text as string) ?? '' };
  }
}

export class Speech {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async create({
    model = Speech.DEFAULT_MODEL,
    input,
    voice = 'alloy',
    response_format,
    speed,
    timeout,
    ...rest
  }: {
    model?: string;
    input: string;
    voice?: string;
    response_format?: string;
    speed?: number;
    timeout?: number;
    [key: string]: unknown;
  }): Promise<SpeechResponse> {
    const body: Record<string, unknown> = { model, input, voice, ...rest };
    if (response_format !== undefined) body.response_format = response_format;
    if (speed !== undefined) body.speed = speed;

    const { content, contentType } = await this.http.requestBinary({
      method: 'POST',
      path: '/audio/speech',
      body,
      timeout,
    });

    return { content, contentType };
  }
}

export class Audio {
  public transcriptions: Transcriptions;
  public speech: Speech;

  constructor(http: AsyncHTTPClient) {
    this.transcriptions = new Transcriptions(http);
    this.speech = new Speech(http);
  }
}
