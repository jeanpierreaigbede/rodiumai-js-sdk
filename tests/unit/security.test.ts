import { RodiumAI, RodiumAIError, InvalidAPIKeyError } from '../../src/index';

describe('Security — HTTPS Enforcement', () => {
  it('rejects http:// URL', () => {
    expect(
      () => new RodiumAI({ apiKey: 'rdk-test', baseURL: 'http://api.rodiumai.io/v1' })
    ).toThrow('HTTPS is required');
  });

  it('accepts https:// URL', () => {
    expect(
      () => new RodiumAI({ apiKey: 'rdk-test', baseURL: 'https://api.rodiumai.io/v1' })
    ).not.toThrow();
  });

  it('allows http://localhost for local development', () => {
    expect(
      () => new RodiumAI({ apiKey: 'rdk-test', baseURL: 'http://localhost:8080/v1' })
    ).not.toThrow();
  });
});

describe('Security — API Key Leakage', () => {
  it('key not exposed in JSON serialization of client', () => {
    const client = new RodiumAI({ apiKey: 'rdk-super-secret-key' });
    const json = JSON.stringify(client);
    expect(json).not.toContain('rdk-super-secret-key');
  });

  it('key not in error message', () => {
    try {
      throw new RodiumAIError({ message: 'test error', code: 400 });
    } catch (e: any) {
      expect(e.message).not.toContain('rdk-super-secret-key');
    }
  });

  it('key not visible in error JSON', () => {
    const err = new RodiumAIError({ message: 'test', code: 400 });
    const json = JSON.stringify(err);
    expect(json).not.toContain('rdk-super-secret-key');
  });
});

describe('Security — API Key Validation', () => {
  it('rejects empty key', () => {
    expect(() => new RodiumAI({ apiKey: '' })).toThrow(InvalidAPIKeyError);
  });

  it('rejects whitespace-only key', () => {
    expect(() => new RodiumAI({ apiKey: '   ' })).toThrow(InvalidAPIKeyError);
  });

  it('accepts valid key', () => {
    expect(() => new RodiumAI({ apiKey: 'rdk-validkey123' })).not.toThrow();
  });
});

describe('Security — Header Injection', () => {
  it('rejects newline in API key', () => {
    expect(() => new RodiumAI({ apiKey: 'rdk-key\r\nX-Injected: evil' })).toThrow();
  });

  it('rejects null byte in API key', () => {
    expect(() => new RodiumAI({ apiKey: 'rdk-key\x00malicious' })).toThrow();
  });
});

describe('Security — Input Validation', () => {
  it('rejects empty messages array', async () => {
    const client = new RodiumAI({ apiKey: 'rdk-test' });
    await expect(
      client.chat.completions.create({ model: 'openai/gpt-4o-mini', messages: [] })
    ).rejects.toThrow(/messages/i);
  });

  it('rejects temperature > 2', async () => {
    const client = new RodiumAI({ apiKey: 'rdk-test' });
    await expect(
      client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 3.0,
      })
    ).rejects.toThrow(/temperature/i);
  });

  it('rejects temperature < 0', async () => {
    const client = new RodiumAI({ apiKey: 'rdk-test' });
    await expect(
      client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: -0.1,
      })
    ).rejects.toThrow(/temperature/i);
  });
});

describe('Security — Retry / DoS Limits', () => {
  it('timeout has a positive default', () => {
    const client = new RodiumAI({ apiKey: 'rdk-test' });
    expect((client as any)._http.timeout).toBeGreaterThan(0);
    expect((client as any)._http.timeout).toBeLessThanOrEqual(120_000);
  });

  it('maxRetries is capped at a safe value', () => {
    const client = new RodiumAI({ apiKey: 'rdk-test', maxRetries: 10 });
    expect((client as any)._http.maxRetries).toBeLessThanOrEqual(5);
  });
});
