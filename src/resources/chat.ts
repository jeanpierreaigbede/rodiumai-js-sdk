import { AsyncHTTPClient } from '../_http.js';

export interface Delta {
  role?: string | null;
  content?: string | null;
}

export interface ChunkChoice {
  index: number;
  delta: Delta;
  finish_reason?: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChunkChoice[];
}

export interface Message {
  role: string;
  content: string | null;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason?: string | null;
}

export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: CompletionUsage | null;
  cost_rodi?: number | null;
  routing?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
}

export class Completions {
  static DEFAULT_MODEL = 'openai/gpt-4o';

  constructor(private http: AsyncHTTPClient) {}

  async create(opts: {
    model?: string;
    messages: Array<{ role: string; content: string | unknown }>;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string | string[];
    timeout?: number;
    [key: string]: unknown;
  }): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>> {
    if (!opts.messages || opts.messages.length === 0) {
      throw new Error('messages must not be empty');
    }

    const {
      stream,
      timeout,
      model = Completions.DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens,
      top_p,
      stop,
      ...rest
    } = opts;

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: stream ?? false,
      ...rest,
    };

    if (temperature !== undefined) {
      if (temperature < 0 || temperature > 2) {
        throw new Error('temperature must be between 0 and 2');
      }
      body.temperature = temperature;
    }
    if (max_tokens !== undefined) {
      if (max_tokens <= 0) throw new Error('max_tokens must be greater than 0');
      body.max_tokens = max_tokens;
    }
    if (top_p !== undefined) body.top_p = top_p;
    if (stop !== undefined) body.stop = stop;

    if (stream) {
      return this.streamCreate(body, timeout);
    }

    const { data } = await this.http.request({
      method: 'POST',
      path: '/chat/completions',
      body,
      timeout,
    });

    const choices: Choice[] = ((data.choices as Record<string, unknown>[]) ?? []).map((c) => ({
      index: (c.index as number) ?? 0,
      message: {
        role: ((c.message as Record<string, unknown>)?.role as string) ?? '',
        content: ((c.message as Record<string, unknown>)?.content as string) ?? null,
      },
      finish_reason: (c.finish_reason as string) ?? null,
    }));

    const usageData = data.usage as Record<string, number> | undefined;
    const usage: CompletionUsage | undefined = usageData
      ? {
          prompt_tokens: usageData.prompt_tokens ?? 0,
          completion_tokens: usageData.completion_tokens ?? 0,
          total_tokens: usageData.total_tokens ?? 0,
        }
      : undefined;

    let costRodi = data.cost_rodi as number | undefined;
    if (costRodi === undefined && data.rodiumai && typeof data.rodiumai === 'object') {
      costRodi = (data.rodiumai as Record<string, unknown>).cost_rodi as number | undefined;
    }

    return {
      id: (data.id as string) ?? '',
      object: (data.object as string) ?? 'chat.completion',
      created: (data.created as number) ?? 0,
      model: (data.model as string) ?? model,
      choices,
      usage,
      cost_rodi: costRodi ?? null,
      routing: (data.routing as Record<string, unknown>) ?? null,
      raw: data,
    };
  }

  private async *streamCreate(
    body: Record<string, unknown>,
    timeout?: number
  ): AsyncGenerator<ChatCompletionChunk> {
    const gen = this.http.stream('/chat/completions', body, timeout);
    for await (const chunk of gen) {
      const rawChoices = (chunk.choices as Record<string, unknown>[]) ?? [];
      if (rawChoices.length === 0) continue;
      const choices: ChunkChoice[] = rawChoices.map((c) => ({
        index: (c.index as number) ?? 0,
        delta: {
          role: ((c.delta as Record<string, unknown>)?.role as string) ?? null,
          content: ((c.delta as Record<string, unknown>)?.content as string) ?? null,
        },
        finish_reason: (c.finish_reason as string) ?? null,
      }));

      yield {
        id: (chunk.id as string) ?? '',
        object: (chunk.object as string) ?? 'chat.completion.chunk',
        created: (chunk.created as number) ?? 0,
        model: (chunk.model as string) ?? '',
        choices,
      };
    }
  }
}

export type ChatResource = {
  (
    messages: string | Array<{ role: string; content: string | unknown }>,
    options?: Record<string, unknown>
  ): Promise<ChatCompletion>;
  completions: Completions;
};

export function createChatResource(http: AsyncHTTPClient, flatChat: ChatResource): ChatResource {
  const completions = new Completions(http);
  return Object.assign(flatChat, { completions }) as ChatResource;
}

export class Chat {
  public completions: Completions;

  constructor(http: AsyncHTTPClient) {
    this.completions = new Completions(http);
  }
}
