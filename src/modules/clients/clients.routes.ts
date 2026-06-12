import { FastifyInstance } from 'fastify';
import { ClientsService } from './clients.service.js';
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from './clients.schema.js';

export default async function clientsRoutes(fastify: FastifyInstance) {
  const service = new ClientsService(fastify.supabase);

  fastify.get('/api/admin/clients', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listClientsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid query', errors: parsed.error.flatten() });
    return service.list(parsed.data);
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/clients/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { return await service.getById(request.params.id); }
    catch { return reply.status(404).send({ message: 'Client not found' }); }
  });

  fastify.post('/api/admin/clients', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const client = await service.create(parsed.data, request.user.id);
    return reply.status(201).send(client);
  });

  fastify.put<{ Params: { id: string } }>('/api/admin/clients/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try { return await service.update(request.params.id, parsed.data); }
    catch { return reply.status(404).send({ message: 'Client not found' }); }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/clients/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { await service.delete(request.params.id); return reply.status(204).send(); }
    catch { return reply.status(404).send({ message: 'Client not found' }); }
  });
}
