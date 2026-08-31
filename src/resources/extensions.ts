import { AsyncHTTPClient } from '../_http.js';

export class Extensions {
  constructor(private http: AsyncHTTPClient) {}

  async wallet(timeout?: number): Promise<Record<string, unknown>> {
    const { data } = await this.http.request({ method: 'GET', path: '/wallet', timeout });
    return data;
  }

  async pricing(model?: string, timeout?: number): Promise<Record<string, unknown>> {
    const { data } = await this.http.request({
      method: 'GET',
      path: '/pricing',
      params: model ? { model } : undefined,
      timeout,
    });
    return data;
  }
}
