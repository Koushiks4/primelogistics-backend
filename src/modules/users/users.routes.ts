import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UsersService } from './users.service.js';
import { USER_ROLES } from '../../types.js';

const inviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(USER_ROLES).default('staff'),
});

const updateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  is_active: z.boolean().optional(),
});

export default async function usersRoutes(fastify: FastifyInstance) {
  const service = new UsersService(fastify.supabase);

  fastify.get('/api/admin/users', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async () => service.list());

  fastify.post('/api/admin/users', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = inviteUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    const user = await service.invite(parsed.data.email, parsed.data.full_name, parsed.data.role);
    return reply.status(201).send(user);
  });

  fastify.put<{ Params: { id: string } }>('/api/admin/users/:id', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request, reply) => {
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    try { return await service.update(request.params.id, parsed.data); }
    catch { return reply.status(404).send({ message: 'User not found' }); }
  });
}
