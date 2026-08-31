import { AsyncHTTPClient } from '../_http.js';

export class Messages {
  constructor(private http: AsyncHTTPClient) {}

  async create(
    opts: Record<string, unknown> & { timeout?: number }
  ): Promise<Record<string, unknown>> {
    const { timeout, anthropic_version = '2023-06-01', ...body } = opts;
    const { data } = await this.http.request({
      method: 'POST',
      path: '/messages',
      body: body as Record<string, unknown>,
      timeout,
      extraHeaders: {
        'x-api-key': this.http.getApiKey(),
        'anthropic-version': String(anthropic_version),
      },
    });
    return data;
  }
}

export type MessagesResource = Messages & {
  (opts: Record<string, unknown>): Promise<Record<string, unknown>>;
  create: Messages['create'];
};

export function createMessagesResource(http: AsyncHTTPClient): MessagesResource {
  const messages = new Messages(http);
  const fn = async (opts: Record<string, unknown>) => messages.create(opts);
  return Object.assign(fn, { create: messages.create.bind(messages) }) as MessagesResource;
}
