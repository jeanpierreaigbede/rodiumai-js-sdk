import { AsyncHTTPClient } from './_http.js';
import { VERSION } from './_version.js';
import { InvalidAPIKeyError } from './errors.js';
import { RodiumAILogger } from './logger.js';
import { Audio } from './resources/audio.js';
import { ChatCompletion, Completions } from './resources/chat.js';
import { createEmbeddingsResource, EmbeddingsResource } from './resources/embeddings.js';
import { Extensions } from './resources/extensions.js';
import { createImagesResource, ImagesResource } from './resources/images.js';
import { createMessagesResource, MessagesResource } from './resources/messages.js';
import { createModelsResource, ModelsResource } from './resources/models.js';
import { createVideoResource, VideoResource } from './resources/video.js';
import { UsageStats } from './usage.js';

export interface RodiumAIOptions {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  streamTimeout?: number;
  maxRetries?: number;
  logLevel?: string;
  defaultModel?: string;
}

export type ChatResource = {
  (
    messages: string | Array<{ role: string; content: string | unknown }>,
    options?: Record<string, unknown>
  ): Promise<ChatCompletion>;
  completions: Completions;
};

const MAX_RETRIES_LIMIT = 5;
export const DEFAULT_MODEL = 'openai/gpt-4o';

export class RodiumAI {
  public chat: ChatResource;
  public embeddings: EmbeddingsResource;
  public images: ImagesResource;
  public audio: Audio;
  public video: VideoResource;
  public models: ModelsResource;
  public messages: MessagesResource;

  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private streamTimeout: number;
  private maxRetries: number;
  private defaultModel: string;
  private logLevel?: string;
  private _logger: RodiumAILogger;
  private _usage: UsageStats;
  private _http: AsyncHTTPClient;
  private _extensions: Extensions;

  private pendingModel?: string;
  private pendingTemperature?: number;
  private pendingTopP?: number;
  private pendingMaxTokens?: number;
  private pendingSystemPrompt?: string;

  constructor(opts: RodiumAIOptions = {}) {
    const resolvedKey =
      opts.apiKey ?? (typeof process !== 'undefined' ? process.env.RODIUMAI_API_KEY : '') ?? '';

    if (!resolvedKey || !resolvedKey.trim()) {
      throw new InvalidAPIKeyError();
    }

    if (/[\r\n\x00]/.test(resolvedKey)) {
      throw new Error('API key contains invalid characters.');
    }

    this.apiKey = resolvedKey;
    this.baseURL = opts.baseURL ?? 'https://api.rodiumai.io/v1';
    this.timeout = opts.timeout ?? 30_000;
    this.streamTimeout = opts.streamTimeout ?? 600_000;
    this.maxRetries = Math.min(opts.maxRetries ?? 3, MAX_RETRIES_LIMIT);
    this.defaultModel =
      opts.defaultModel ??
      (typeof process !== 'undefined' ? process.env.RODIUMAI_DEFAULT_MODEL : undefined) ??
      DEFAULT_MODEL;
    this.logLevel = opts.logLevel;

    this._logger = new RodiumAILogger(this.logLevel);
    this._usage = new UsageStats();

    if (!/^[A-Za-z0-9@._-]+$/.test(this.apiKey)) {
      this._logger.logAlert(
        'invalid_api_key_format',
        'API key format is invalid. Expected format: rd_sk_... or rdk-...',
        { sdkVersion: VERSION }
      );
    }

    this._http = new AsyncHTTPClient({
      apiKey: this.apiKey,
      baseUrl: this.baseURL,
      timeout: this.timeout,
      streamTimeout: this.streamTimeout,
      maxRetries: this.maxRetries,
    });

    this._extensions = new Extensions(this._http);
    this.embeddings = createEmbeddingsResource(this._http, () => this.resolveModel());
    this.images = createImagesResource(this._http, () => this.resolveModel());
    this.audio = new Audio(this._http);
    this.video = createVideoResource(this._http, () => this.resolveModel(), this.timeout);
    this.models = createModelsResource(this._http);
    this.messages = createMessagesResource(this._http);

    const completions = new Completions(this._http);
    const flatChat = async (
      messages: string | Array<{ role: string; content: string | unknown }>,
      options: Record<string, unknown> = {}
    ) => this.flatChat(messages, options);
    this.chat = Object.assign(flatChat, { completions }) as ChatResource;
  }

  get usage(): UsageStats {
    return this._usage;
  }

  get logger(): RodiumAILogger {
    return this._logger;
  }

  resolveModel(): string {
    return this.pendingModel ?? this.defaultModel;
  }

  model(model: string): RodiumAI {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as RodiumAI;
    clone.pendingModel = model;
    return clone;
  }

  temperature(temperature: number): RodiumAI {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as RodiumAI;
    clone.pendingTemperature = temperature;
    return clone;
  }

  topP(topP: number): RodiumAI {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as RodiumAI;
    clone.pendingTopP = topP;
    return clone;
  }

  maxTokens(maxTokens: number): RodiumAI {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as RodiumAI;
    clone.pendingMaxTokens = maxTokens;
    return clone;
  }

  systemPrompt(prompt: string): RodiumAI {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as RodiumAI;
    clone.pendingSystemPrompt = prompt;
    return clone;
  }

  async flatChat(
    messages: string | Array<{ role: string; content: string | unknown }>,
    options: Record<string, unknown> = {}
  ): Promise<ChatCompletion> {
    const built = this.buildMessages(messages);
    const kwargs = this.chatKwargs(options);
    const result = await this.chat.completions.create({ messages: built, ...kwargs });
    return result as ChatCompletion;
  }

  async *stream(
    messages: string | Array<{ role: string; content: string | unknown }>,
    options: Record<string, unknown> = {}
  ): AsyncGenerator<string> {
    const built = this.buildMessages(messages);
    const kwargs = this.chatKwargs({ ...options, stream: true });
    const stream = (await this.chat.completions.create({
      messages: built,
      ...kwargs,
    })) as AsyncGenerator<{ choices: Array<{ delta: { content?: string | null } }> }>;

    for await (const chunk of stream) {
      for (const choice of chunk.choices) {
        if (choice.delta.content) {
          yield choice.delta.content;
        }
      }
    }
  }

  async modelInfo(
    modelId: string,
    options: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    return this.models.retrieve(modelId, options.timeout as number | undefined);
  }

  async codingModels(options: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.models.listCoding(options.timeout as number | undefined);
  }

  async videos(options: Record<string, unknown> & { prompt: string }): Promise<unknown> {
    return this.video(options);
  }

  async transcribe(
    file: Buffer | Blob | string,
    options: Record<string, unknown> = {}
  ): Promise<{ text: string }> {
    const { model, timeout, ...rest } = options;
    let upload: Buffer | Blob = file as Buffer;
    if (typeof file === 'string') {
      const fs = await import('node:fs/promises');
      upload = await fs.readFile(file);
    }
    return this.audio.transcriptions.create({
      model: (model as string) ?? this.resolveModel(),
      file: upload,
      timeout: timeout as number | undefined,
      ...rest,
    });
  }

  async speech(options: Record<string, unknown> & { input: string }): Promise<ArrayBuffer> {
    const { model, timeout, input, ...rest } = options;
    const result = await this.audio.speech.create({
      model: (model as string) ?? this.resolveModel(),
      timeout: timeout as number | undefined,
      input,
      ...rest,
    });
    return result.content;
  }

  async wallet(options: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this._extensions.wallet(options.timeout as number | undefined);
  }

  async pricing(
    model?: string,
    options: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    return this._extensions.pricing(model, options.timeout as number | undefined);
  }

  private buildMessages(
    messages: string | Array<{ role: string; content: string | unknown }>
  ): Array<{ role: string; content: string | unknown }> {
    const built =
      typeof messages === 'string' ? [{ role: 'user', content: messages }] : [...messages];
    if (this.pendingSystemPrompt) {
      return [{ role: 'system', content: this.pendingSystemPrompt }, ...built];
    }
    return built;
  }

  private chatKwargs(options: Record<string, unknown>): Record<string, unknown> {
    const { timeout, model, temperature, top_p, max_tokens, stream, ...rest } = options;
    return {
      model: (model as string) ?? this.resolveModel(),
      temperature: temperature ?? this.pendingTemperature,
      top_p: top_p ?? this.pendingTopP,
      max_tokens: max_tokens ?? this.pendingMaxTokens,
      stream: stream ?? false,
      timeout: timeout as number | undefined,
      ...rest,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      streamTimeout: this.streamTimeout,
      maxRetries: this.maxRetries,
      apiKey: '****',
    };
  }
}
