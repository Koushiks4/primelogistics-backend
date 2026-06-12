import { FastifyInstance } from 'fastify';

export default async function partnerSyncRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/sync/logs', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async () => {
    return fastify.partnerSync.getSyncLogs(100);
  });

  fastify.post('/api/admin/sync/trigger', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async () => {
    const result = await fastify.partnerSync.pollDelhiveryOrders();
    return { message: 'Sync triggered', ...result };
  });
}
