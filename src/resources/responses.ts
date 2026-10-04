import { AsyncHTTPClient } from '../_http.js';

export interface ResponseOutputContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface ResponseOutputItem {
  type: string;
  role?: string;
  content?: ResponseOutputContent[];
  [key: string]: unknown;
}

export interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  [key: string]: unknown;
}

/** OpenAI-shaped `/v1/responses` result (non-streaming). */
export interface ResponsesResponse {
  id: string;
  object: string;
  created_at?: number;
  model: string;
  status?: string | null;
  output: ResponseOutputItem[];
  /** Convenience aggregation of every `output_text` block. */
  output_text: string;
  usage?: ResponsesUsage | null;
  cost_rodi?: number | null;
  routing?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
}

/**
 * A single event from the Responses streaming protocol — most notably
 * `response.output_text.delta` (with a `delta` string). There is no `[DONE]`
 * sentinel; the generator ends when the upstream closes the stream.
 */
export interface ResponseStreamEvent {
  type: string;
  delta?: string;
  [key: string]: unknown;
}

export interface ResponseCreateParams {
  model: string;
  input?: string | unknown[];
  instructions?: string;
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  timeout?: number;
  [key: string]: unknown;
}

function aggregateOutputText(output: ResponseOutputItem[]): string {
  const parts: string[] = [];
  for (const item of output) {
    for (const block of item.content ?? []) {
      if (block.type === 'output_text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
    }
  }
  return parts.join('');
}

export class Responses {
  constructor(private http: AsyncHTTPClient) {}

  async create(opts: ResponseCreateParams & { stream?: false }): Promise<ResponsesResponse>;
  async create(
    opts: ResponseCreateParams & { stream: true }
  ): Promise<AsyncGenerator<ResponseStreamEvent>>;
  async create(
    opts: ResponseCreateParams
  ): Promise<ResponsesResponse | AsyncGenerator<ResponseStreamEvent>>;
  async create(
    opts: ResponseCreateParams
  ): Promise<ResponsesResponse | AsyncGenerator<ResponseStreamEvent>> {
    if (!opts.model) {
      throw new Error('model is required for responses.create');
    }

    const { timeout, stream, ...body } = opts;

    if (stream) {
      return this.streamCreate({ ...body, stream: true }, timeout);
    }

    const { data } = await this.http.request({
      method: 'POST',
      path: '/responses',
      body: { ...body, stream: false },
      timeout,
    });

    const output = ((data.output as ResponseOutputItem[]) ?? []) as ResponseOutputItem[];
    const outputText =
      typeof data.output_text === 'string'
        ? (data.output_text as string)
        : aggregateOutputText(output);

    const usageData = data.usage as Record<string, number> | undefined;

    let costRodi = data.cost_rodi as number | undefined;
    if (costRodi === undefined && data.rodiumai && typeof data.rodiumai === 'object') {
      costRodi = (data.rodiumai as Record<string, unknown>).cost_rodi as number | undefined;
    }

    return {
      id: (data.id as string) ?? '',
      object: (data.object as string) ?? 'response',
      created_at: data.created_at as number | undefined,
      model: (data.model as string) ?? String(opts.model),
      status: (data.status as string) ?? null,
      output,
      output_text: outputText,
      usage: usageData
        ? {
            input_tokens: usageData.input_tokens ?? 0,
            output_tokens: usageData.output_tokens ?? 0,
            total_tokens: usageData.total_tokens ?? 0,
            ...usageData,
          }
        : null,
      cost_rodi: costRodi ?? null,
      routing: (data.routing as Record<string, unknown>) ?? null,
      raw: data,
    };
  }

  private async *streamCreate(
    body: Record<string, unknown>,
    timeout?: number
  ): AsyncGenerator<ResponseStreamEvent> {
    const gen = this.http.stream('/responses', body, timeout);
    for await (const event of gen) {
      yield event as ResponseStreamEvent;
    }
  }
}

export type ResponsesResource = Responses & {
  (opts: ResponseCreateParams & { stream?: false }): Promise<ResponsesResponse>;
  (opts: ResponseCreateParams & { stream: true }): Promise<AsyncGenerator<ResponseStreamEvent>>;
  (opts: ResponseCreateParams): Promise<ResponsesResponse | AsyncGenerator<ResponseStreamEvent>>;
  create: Responses['create'];
};

export function createResponsesResource(http: AsyncHTTPClient): ResponsesResource {
  const responses = new Responses(http);
  const fn = (opts: ResponseCreateParams) => responses.create(opts);
  return Object.assign(fn, { create: responses.create.bind(responses) }) as ResponsesResource;
}
