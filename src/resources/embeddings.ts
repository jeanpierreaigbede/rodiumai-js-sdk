import { AsyncHTTPClient } from '../_http.js';

export interface EmbeddingObject {
  object: string;
  index: number;
  embedding: number[];
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingsResponse {
  object: string;
  data: EmbeddingObject[];
  model: string;
  usage?: EmbeddingUsage | null;
}

export class Embeddings {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async create({
    model = Embeddings.DEFAULT_MODEL,
    input,
    timeout,
    ...rest
  }: {
    model?: string;
    input: string | string[];
    timeout?: number;
    [key: string]: unknown;
  }): Promise<EmbeddingsResponse> {
    const { data } = await this.http.request({
      method: 'POST',
      path: '/embeddings',
      body: { model, input, ...rest },
      timeout,
    });

    const embeddings: EmbeddingObject[] = ((data.data ?? []) as Record<string, unknown>[]).map(
      (item) => ({
        object: (item.object as string) ?? 'embedding',
        index: (item.index as number) ?? 0,
        embedding: (item.embedding as number[]) ?? [],
      })
    );

    const usageData = data.usage as Record<string, number> | undefined;
    const usage: EmbeddingUsage | undefined = usageData
      ? {
          prompt_tokens: usageData.prompt_tokens ?? 0,
          total_tokens: usageData.total_tokens ?? 0,
        }
      : undefined;

    return {
      object: (data.object as string) ?? 'list',
      data: embeddings,
      model: (data.model as string) ?? model,
      usage,
    };
  }
}

export type EmbeddingsResource = Embeddings & {
  (input: string | string[], options?: Record<string, unknown>): Promise<EmbeddingsResponse>;
  create: Embeddings['create'];
};

export function createEmbeddingsResource(
  http: AsyncHTTPClient,
  resolveModel: () => string
): EmbeddingsResource {
  const embeddings = new Embeddings(http);
  const fn = async (input: string | string[], options: Record<string, unknown> = {}) => {
    const { model, timeout, ...rest } = options;
    return embeddings.create({
      model: (model as string) ?? resolveModel(),
      input,
      timeout: timeout as number | undefined,
      ...rest,
    });
  };
  return Object.assign(fn, { create: embeddings.create.bind(embeddings) }) as EmbeddingsResource;
}
