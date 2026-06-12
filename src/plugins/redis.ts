import fp from 'fastify-plugin';
import { Redis } from '@upstash/redis';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(fastify: FastifyInstance) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
  }

  const redis = new Redis({ url, token });
  fastify.decorate('redis', redis);
}

export default fp(redisPlugin, { name: 'redis' });
