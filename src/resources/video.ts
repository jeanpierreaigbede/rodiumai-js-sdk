import { AsyncHTTPClient } from '../_http.js';

export interface VideoData {
  url?: string | null;
  b64_json?: string | null;
}

export interface VideoResponse {
  created: number;
  data: VideoData[];
  raw: Record<string, unknown>;
}

export class Generations {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async create(opts: {
    model?: string;
    prompt: string;
    duration_seconds?: number;
    timeout?: number;
    [key: string]: unknown;
  }): Promise<VideoResponse> {
    const {
      timeout = 600_000,
      model = Generations.DEFAULT_MODEL,
      prompt,
      duration_seconds,
      ...rest
    } = opts;
    const body: Record<string, unknown> = { model, prompt, ...rest };
    if (duration_seconds !== undefined) body.duration_seconds = duration_seconds;

    const { data } = await this.http.request({
      method: 'POST',
      path: '/videos/generations',
      body,
      timeout,
    });

    const items: VideoData[] = ((data.data ?? []) as Record<string, unknown>[]).map((item) => ({
      url: (item.url as string) ?? null,
      b64_json: (item.b64_json as string) ?? null,
    }));

    return {
      created: (data.created as number) ?? 0,
      data: items,
      raw: data,
    };
  }
}

export type VideoResource = {
  (opts: Record<string, unknown>): Promise<VideoResponse>;
  generations: Generations;
};

export function createVideoResource(
  http: AsyncHTTPClient,
  resolveModel: () => string,
  defaultTimeout: number
): VideoResource {
  const generations = new Generations(http);
  const fn = async (opts: Record<string, unknown>) =>
    generations.create({
      model: (opts.model as string) ?? resolveModel(),
      timeout: (opts.timeout as number) ?? Math.max(defaultTimeout, 600_000),
      prompt: opts.prompt as string,
      ...opts,
    });
  return Object.assign(fn, { generations }) as VideoResource;
}
