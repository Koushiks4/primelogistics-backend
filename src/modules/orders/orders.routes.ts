import { FastifyInstance } from 'fastify';
import { OrdersService } from './orders.service.js';
import {
  createOrderSchema,
  updateOrderSchema,
  updateStatusSchema,
  listOrdersQuerySchema,
} from './orders.schema.js';

export default async function ordersRoutes(fastify: FastifyInstance) {
  const service = new OrdersService(fastify.supabase);

  fastify.get('/api/admin/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid query', errors: parsed.error.flatten() });
    return service.list(parsed.data);
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/orders/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { return await service.getById(request.params.id); }
    catch { return reply.status(404).send({ message: 'Order not found' }); }
  });

  fastify.post('/api/admin/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const order = await service.create(parsed.data, request.user.id);
    fastify.notifications
      .sendOrderCreatedNotifications(order)
      .catch((err) => fastify.log.error(err, 'Failed to send order notifications'));
    return reply.status(201).send(order);
  });

  fastify.put<{ Params: { id: string } }>('/api/admin/orders/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try { return await service.update(request.params.id, parsed.data); }
    catch { return reply.status(404).send({ message: 'Order not found' }); }
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/orders/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try { return await service.updateStatus(request.params.id, parsed.data, request.user.id); }
    catch { return reply.status(404).send({ message: 'Order not found' }); }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/orders/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { await service.softDelete(request.params.id); return reply.status(204).send(); }
    catch { return reply.status(404).send({ message: 'Order not found' }); }
  });
}
