import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';

async function corsPlugin(fastify: FastifyInstance) {
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || [
    'http://localhost:3000',
  ];

  await fastify.register(cors, {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

export default fp(corsPlugin, { name: 'cors' });
