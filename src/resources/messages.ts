import { AsyncHTTPClient } from '../_http.js';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

export interface MessageContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  [key: string]: unknown;
}

/** Anthropic-shaped `/v1/messages` response (non-streaming). */
export interface MessageResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: MessageContentBlock[];
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: MessageUsage | null;
  cost_rodi?: number | null;
  routing?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
}

/**
 * A single Server-Sent Event from the Anthropic streaming protocol
 * (`message_start`, `content_block_start`, `content_block_delta`,
 * `content_block_stop`, `message_delta`, `message_stop`). Unlike the OpenAI
 * chat stream there is no `[DONE]` sentinel — the generator ends when the
 * upstream closes the stream.
 */
export interface MessageStreamEvent {
  type: string;
  index?: number;
  delta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MessageCreateParams {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  max_tokens?: number;
  system?: string | unknown[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  metadata?: Record<string, unknown>;
  tools?: unknown[];
  tool_choice?: unknown;
  anthropic_version?: string;
  timeout?: number;
  [key: string]: unknown;
}

export class Messages {
  constructor(private http: AsyncHTTPClient) {}

  async create(opts: MessageCreateParams & { stream?: false }): Promise<MessageResponse>;
  async create(
    opts: MessageCreateParams & { stream: true }
  ): Promise<AsyncGenerator<MessageStreamEvent>>;
  async create(
    opts: MessageCreateParams
  ): Promise<MessageResponse | AsyncGenerator<MessageStreamEvent>>;
  async create(
    opts: MessageCreateParams
  ): Promise<MessageResponse | AsyncGenerator<MessageStreamEvent>> {
    const { timeout, anthropic_version = DEFAULT_ANTHROPIC_VERSION, stream, ...body } = opts;
    const extraHeaders = {
      'x-api-key': this.http.getApiKey(),
      'anthropic-version': String(anthropic_version),
    };

    if (stream) {
      return this.streamCreate({ ...body, stream: true }, timeout, extraHeaders);
    }

    const { data } = await this.http.request({
      method: 'POST',
      path: '/messages',
      body: { ...body, stream: false },
      timeout,
      extraHeaders,
    });

    const content = ((data.content as Record<string, unknown>[]) ?? []).map((block) => ({
      ...block,
      type: (block.type as string) ?? 'text',
    })) as MessageContentBlock[];

    const usageData = data.usage as Record<string, number> | undefined;

    let costRodi = data.cost_rodi as number | undefined;
    if (costRodi === undefined && data.rodiumai && typeof data.rodiumai === 'object') {
      costRodi = (data.rodiumai as Record<string, unknown>).cost_rodi as number | undefined;
    }

    return {
      id: (data.id as string) ?? '',
      type: (data.type as string) ?? 'message',
      role: (data.role as string) ?? 'assistant',
      model: (data.model as string) ?? String(opts.model ?? ''),
      content,
      stop_reason: (data.stop_reason as string) ?? null,
      stop_sequence: (data.stop_sequence as string) ?? null,
      usage: usageData
        ? {
            input_tokens: usageData.input_tokens ?? 0,
            output_tokens: usageData.output_tokens ?? 0,
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
    timeout: number | undefined,
    extraHeaders: Record<string, string>
  ): AsyncGenerator<MessageStreamEvent> {
    const gen = this.http.stream('/messages', body, timeout, extraHeaders);
    for await (const event of gen) {
      yield event as MessageStreamEvent;
    }
  }
}

export type MessagesResource = Messages & {
  (opts: MessageCreateParams & { stream?: false }): Promise<MessageResponse>;
  (opts: MessageCreateParams & { stream: true }): Promise<AsyncGenerator<MessageStreamEvent>>;
  (opts: MessageCreateParams): Promise<MessageResponse | AsyncGenerator<MessageStreamEvent>>;
  create: Messages['create'];
};

export function createMessagesResource(http: AsyncHTTPClient): MessagesResource {
  const messages = new Messages(http);
  const fn = (opts: MessageCreateParams) => messages.create(opts);
  return Object.assign(fn, { create: messages.create.bind(messages) }) as MessagesResource;
}
