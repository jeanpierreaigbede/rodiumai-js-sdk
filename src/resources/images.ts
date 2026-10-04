import { AsyncHTTPClient } from '../_http.js';

export interface ImageData {
  url?: string | null;
  b64_json?: string | null;
}

export interface ImagesResponse {
  created: number;
  data: ImageData[];
}

export class Images {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async generate({
    model = Images.DEFAULT_MODEL,
    prompt,
    n = 1,
    size = '1024x1024',
    quality,
    timeout,
    ...rest
  }: {
    model?: string;
    prompt: string;
    n?: number;
    size?: string;
    quality?: string;
    timeout?: number;
    [key: string]: unknown;
  }): Promise<ImagesResponse> {
    const body: Record<string, unknown> = { model, prompt, n, size, ...rest };
    if (quality !== undefined) body.quality = quality;

    const { data } = await this.http.request({
      method: 'POST',
      path: '/images/generations',
      body,
      timeout,
    });

    const images: ImageData[] = ((data.data ?? []) as Record<string, unknown>[]).map((item) => ({
      url: (item.url as string) ?? null,
      b64_json: (item.b64_json as string) ?? null,
    }));

    return {
      created: (data.created as number) ?? 0,
      data: images,
    };
  }
}

export type ImagesResource = Images & {
  (options: Record<string, unknown> & { prompt: string }): Promise<ImagesResponse>;
  generate: Images['generate'];
};

export function createImagesResource(
  http: AsyncHTTPClient,
  resolveModel: () => string
): ImagesResource {
  const images = new Images(http);
  const fn = async (options: Record<string, unknown> & { prompt: string }) => {
    const { model, timeout, prompt, ...rest } = options;
    return images.generate({
      model: (model as string) ?? resolveModel(),
      timeout: timeout as number | undefined,
      prompt,
      ...rest,
    });
  };
  return Object.assign(fn, { generate: images.generate.bind(images) }) as ImagesResource;
}
