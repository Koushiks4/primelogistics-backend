import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PartnerSyncService } from './partner-sync.service.js';

async function partnerSyncPlugin(fastify: FastifyInstance) {
  const syncService = new PartnerSyncService(fastify.supabase, fastify.redis);

  // Decorate so routes can access it
  fastify.decorate('partnerSync', syncService);

  // Start hourly polling
  const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour

  const poll = async () => {
    try {
      const result = await syncService.pollDelhiveryOrders();
      if (result.total > 0) {
        fastify.log.info(result, 'Delhivery sync completed');
      }
    } catch (err) {
      fastify.log.error(err, 'Delhivery sync failed');
    }
  };

  const timer = setInterval(poll, POLL_INTERVAL);

  fastify.addHook('onClose', () => {
    clearInterval(timer);
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    partnerSync: PartnerSyncService;
  }
}

export default fp(partnerSyncPlugin, {
  name: 'partner-sync',
  dependencies: ['supabase', 'redis'],
});
