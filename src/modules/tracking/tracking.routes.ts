import { FastifyInstance } from 'fastify';
import { TrackingService } from './tracking.service.js';

export default async function trackingRoutes(fastify: FastifyInstance) {
  const service = new TrackingService(fastify.supabase);

  fastify.get<{ Params: { awbNumber: string } }>('/api/track/:awbNumber', { config: { rateLimit: true } }, async (request, reply) => {
    const result = await service.trackByAwb(request.params.awbNumber);
    if (!result) return reply.status(404).send({ message: 'No shipment found with this tracking number' });
    return result;
  });

  fastify.post('/api/track/my-orders', { config: { rateLimit: true } }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: authData, error: authError } = await fastify.supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return reply.status(401).send({ message: 'Invalid or expired token' });
    }

    const verifiedEmail = authData.user.email;
    if (!verifiedEmail) {
      return reply.status(400).send({ message: 'No email associated with this account' });
    }

    const orders = await service.getOrdersBySenderEmail(verifiedEmail);
    return { orders, email: verifiedEmail };
  });
}
