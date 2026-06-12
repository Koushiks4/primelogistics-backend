import { FastifyInstance } from 'fastify';
import { PartnerSyncService } from './partner-sync.service.js';
import { DelhiveryService } from './delhivery.service.js';

export default async function webhookRoutes(fastify: FastifyInstance) {
  const syncService = new PartnerSyncService(fastify.supabase, fastify.redis);
  const delhivery = new DelhiveryService();

  fastify.post('/api/webhooks/delhivery', { config: { rateLimit: true } }, async (request, reply) => {
    try {
      const body = request.body as any;

      // Validate webhook secret if configured
      const webhookSecret = process.env.DELHIVERY_WEBHOOK_SECRET;
      if (webhookSecret) {
        const headerSecret = request.headers['x-delhivery-secret'] || request.headers['authorization'];
        if (headerSecret !== webhookSecret && headerSecret !== `Bearer ${webhookSecret}`) {
          return reply.status(401).send({ message: 'Invalid webhook secret' });
        }
      }

      const waybill = body.waybill || body.awb;
      const statusCode = body.current_status_type || '';
      const statusLabel = body.current_status_body || body.status || '';
      const location = body.current_status_location || body.location || null;
      const remarks = body.current_status_body || body.remarks || null;

      if (!waybill) {
        return reply.status(400).send({ message: 'Missing waybill in payload' });
      }

      const mappedStatus = delhivery.mapStatusCode(statusCode) || delhivery.mapStatusLabel(statusLabel);

      if (!mappedStatus) {
        fastify.log.warn({ statusCode, statusLabel, waybill }, 'Could not map Delhivery status');
        return reply.status(200).send({ message: 'Status not mappable', received: true });
      }

      const result = await syncService.processStatusUpdate(waybill, mappedStatus, location, remarks, 'webhook', body);

      return { received: true, updated: result.updated, orderId: result.orderId };
    } catch (err) {
      fastify.log.error(err, 'Webhook processing error');
      return reply.status(200).send({ received: true, error: 'Processing failed' });
    }
  });
}
