import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import rateLimitPlugin from '../../src/plugins/rate-limit.js';

async function buildTestApp() {
  const app = Fastify();

  const mockRateLimit = {
    limit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
  };

  await app.register(
    fp(async (fastify) => {
      fastify.decorate('redis', {} as any);
    }, { name: 'redis' })
  );

  await app.register(rateLimitPlugin, { ratelimit: mockRateLimit as any });

  await app.register(async (fastify) => {
    fastify.get('/test', { config: { rateLimit: true } }, async () => ({ ok: true }));
  });

  await app.ready();

  return { app, mockRateLimit };
}

describe('rate-limit plugin', () => {
  it('allows requests within limit', async () => {
    const { app } = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
  });

  it('blocks requests over limit', async () => {
    const { app, mockRateLimit } = await buildTestApp();
    mockRateLimit.limit.mockResolvedValue({ success: false, remaining: 0 });

    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(429);
  });
});
