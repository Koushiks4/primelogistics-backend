import { FastifyInstance } from 'fastify';
import { OrdersService } from './orders.service.js';
import { OrdersExportService } from './orders-export.service.js';
import { OrdersLabelsService } from './orders-labels.service.js';
import {
  createOrderSchema,
  updateOrderSchema,
  updateStatusSchema,
  listOrdersQuerySchema,
} from './orders.schema.js';

export default async function ordersRoutes(fastify: FastifyInstance) {
  const service = new OrdersService(fastify.supabase);
  const exportService = new OrdersExportService(fastify.supabase);
  const labelsService = new OrdersLabelsService(fastify.supabase);

  fastify.get('/api/admin/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid query', errors: parsed.error.flatten() });
    return service.list(parsed.data);
  });

  // Export routes — MUST be before /:id to avoid path conflict
  fastify.get('/api/admin/orders/export/excel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    const filters = parsed.success ? parsed.data : {};
    const buffer = await exportService.generateExcel(filters);
    const date = new Date().toISOString().split('T')[0];
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="orders-export-${date}.xlsx"`)
      .send(buffer);
  });

  fastify.get('/api/admin/orders/export/pdf', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    const filters = parsed.success ? parsed.data : {};
    const buffer = await exportService.generatePdf(filters);
    const date = new Date().toISOString().split('T')[0];
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="orders-export-${date}.pdf"`)
      .send(buffer);
  });

  fastify.get<{ Params: { id: string }; Querystring: { boxes?: string } }>('/api/admin/orders/:id/labels', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const boxes = Math.min(Math.max(parseInt(request.query.boxes ?? '1', 10) || 1, 1), 500);
    try {
      const { buffer, awb } = await labelsService.generateLabels(request.params.id, boxes);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="labels-${awb}.pdf"`)
        .send(buffer);
    } catch {
      return reply.status(404).send({ message: 'Order not found' });
    }
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
