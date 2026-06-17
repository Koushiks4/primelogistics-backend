import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DashboardService } from './dashboard.service.js';

const dashboardQuerySchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  client_id: z.string().uuid().optional(),
});

export default async function dashboardRoutes(fastify: FastifyInstance) {
  const service = new DashboardService(fastify.supabase, fastify.redis);

  fastify.get('/api/admin/dashboard/stats', { preHandler: [fastify.authenticate] }, async (request) => {
    const parsed = dashboardQuerySchema.safeParse(request.query);
    const query = parsed.success ? parsed.data : {};
    return service.getStats(query, request.user.role);
  });
}
