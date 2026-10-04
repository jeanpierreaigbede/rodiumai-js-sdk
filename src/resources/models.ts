import { AsyncHTTPClient } from '../_http.js';

export class Models {
  constructor(private http: AsyncHTTPClient) {}

  async list(timeout?: number): Promise<Record<string, unknown>> {
    const { data } = await this.http.request({ method: 'GET', path: '/models', timeout });
    return data;
  }

  async retrieve(modelId: string, timeout?: number): Promise<Record<string, unknown>> {
    const { data } = await this.http.request({
      method: 'GET',
      path: `/models/${encodeURIComponent(modelId)}`,
      timeout,
    });
    return data;
  }

  async listCoding(timeout?: number): Promise<Record<string, unknown>> {
    const { data } = await this.http.request({ method: 'GET', path: '/models/coding', timeout });
    return data;
  }
}

export type ModelsResource = Models & {
  (): Promise<Record<string, unknown>>;
  list: Models['list'];
  retrieve: Models['retrieve'];
  listCoding: Models['listCoding'];
};

export function createModelsResource(http: AsyncHTTPClient): ModelsResource {
  const models = new Models(http);
  const fn = async () => models.list();
  return Object.assign(fn, {
    list: models.list.bind(models),
    retrieve: models.retrieve.bind(models),
    listCoding: models.listCoding.bind(models),
  }) as ModelsResource;
}
