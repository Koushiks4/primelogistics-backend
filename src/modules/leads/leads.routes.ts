import { FastifyInstance } from 'fastify';
import { LeadsService } from './leads.service.js';
import { LeadNotesService } from './lead-notes.service.js';
import { createLeadSchema, updateLeadSchema, listLeadsQuerySchema } from './leads.schema.js';

export default async function leadsRoutes(fastify: FastifyInstance) {
  const service = new LeadsService(fastify.supabase);

  fastify.get('/api/admin/leads', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = listLeadsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid query', errors: parsed.error.flatten() });
    return service.list(parsed.data);
  });

  fastify.get('/api/admin/leads/grouped', { preHandler: [fastify.authenticate] }, async () => {
    return service.listGroupedByEmail();
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/leads/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { return await service.getById(request.params.id); }
    catch { return reply.status(404).send({ message: 'Lead not found' }); }
  });

  fastify.post('/api/admin/leads', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const lead = await service.create(parsed.data);
    return reply.status(201).send(lead);
  });

  fastify.put<{ Params: { id: string } }>('/api/admin/leads/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateLeadSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try { return await service.update(request.params.id, parsed.data); }
    catch { return reply.status(404).send({ message: 'Lead not found' }); }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/leads/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try { await service.delete(request.params.id); return reply.status(204).send(); }
    catch { return reply.status(404).send({ message: 'Lead not found' }); }
  });

  // Lead Notes
  const notesService = new LeadNotesService(fastify.supabase);

  fastify.get<{ Params: { id: string } }>(
    '/api/admin/leads/:id/notes',
    { preHandler: [fastify.authenticate] },
    async (request) => notesService.list(request.params.id)
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/admin/leads/:id/notes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = request.body as { content?: string };
      if (!body.content?.trim()) {
        return reply.status(400).send({ message: 'Content is required' });
      }
      const note = await notesService.create(request.params.id, body.content.trim(), request.user.id);
      return reply.status(201).send(note);
    }
  );
}
