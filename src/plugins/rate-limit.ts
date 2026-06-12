import fp from 'fastify-plugin';
import { Ratelimit } from '@upstash/ratelimit';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitOpts {
  ratelimit?: Ratelimit;
}

async function rateLimitPlugin(fastify: FastifyInstance, opts: RateLimitOpts) {
  const ratelimit =
    opts.ratelimit ??
    new Ratelimit({
      redis: fastify.redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'ratelimit',
    });

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const routeConfig = request.routeOptions?.config as unknown as Record<string, unknown> | undefined;
    if (!routeConfig?.rateLimit) return;

    const identifier = request.ip;
    const { success, remaining } = await ratelimit.limit(identifier);

    reply.header('X-RateLimit-Remaining', remaining);

    if (!success) {
      return reply.status(429).send({ message: 'Too many requests, please try again later' });
    }
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis'],
});
