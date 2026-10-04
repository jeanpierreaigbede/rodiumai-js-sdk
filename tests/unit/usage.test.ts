import { UsageStats } from '../../src/usage';

describe('UsageStats', () => {
  it('starts empty', () => {
    const stats = new UsageStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.successfulRequests).toBe(0);
    expect(stats.failedRequests).toBe(0);
  });

  it('records successful request', () => {
    const stats = new UsageStats();
    stats.recordRequest({
      success: true,
      model: 'auto',
      endpoint: '/test',
      latencyMs: 100,
      promptTokens: 10,
      completionTokens: 20,
    });
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
    expect(stats.totalTokens).toBe(30);
  });

  it('records failed request', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: false, model: 'auto', endpoint: '/test', latencyMs: 50 });
    expect(stats.totalRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
  });

  it('calculates error rate', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 10 });
    stats.recordRequest({ success: false, model: 'auto', endpoint: '/test', latencyMs: 10 });
    expect(stats.errorRate).toBe(0.5);
  });

  it('calculates average latency', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 100 });
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 200 });
    expect(stats.averageLatencyMs).toBe(150);
  });

  it('accumulates tokens', () => {
    const stats = new UsageStats();
    stats.recordRequest({
      success: true,
      model: 'auto',
      endpoint: '/test',
      latencyMs: 10,
      promptTokens: 50,
      completionTokens: 50,
    });
    stats.recordRequest({
      success: true,
      model: 'auto',
      endpoint: '/test',
      latencyMs: 10,
      promptTokens: 100,
      completionTokens: 100,
    });
    expect(stats.totalTokens).toBe(300);
  });

  it('reset clears all stats', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 10 });
    stats.reset();
    expect(stats.totalRequests).toBe(0);
  });

  it('toJSON returns complete data', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 100 });
    const json = stats.toJSON();
    expect(json.totalRequests).toBe(1);
    expect(json.requestsByModel).toEqual({ auto: 1 });
  });

  it('tracks consecutive errors', () => {
    const stats = new UsageStats();
    expect(stats.consecutiveErrorCount).toBe(0);
    stats.recordRequest({ success: false, model: 'auto', endpoint: '/test', latencyMs: 10 });
    expect(stats.consecutiveErrorCount).toBe(1);
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 10 });
    expect(stats.consecutiveErrorCount).toBe(0);
  });

  it('tracks recent error rate', () => {
    const stats = new UsageStats();
    stats.recordRequest({ success: false, model: 'auto', endpoint: '/test', latencyMs: 10 });
    stats.recordRequest({ success: true, model: 'auto', endpoint: '/test', latencyMs: 10 });
    expect(stats.recentErrorRate).toBe(0.5);
  });
});
