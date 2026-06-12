import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthUser } from '../types.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);

    // Check Redis cache first
    const cached = await fastify.redis.get(`session:${token}`);
    if (cached) {
      const user = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (!user.is_active) {
        return reply.status(403).send({ message: 'Account is deactivated' });
      }
      request.user = user as AuthUser;
      return;
    }

    // Verify with Supabase
    const { data: authData, error: authError } = await fastify.supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return reply.status(401).send({ message: 'Invalid or expired token' });
    }

    // Get profile
    const { data: profile, error: profileError } = await fastify.supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return reply.status(401).send({ message: 'User profile not found' });
    }

    if (!profile.is_active) {
      return reply.status(403).send({ message: 'Account is deactivated' });
    }

    // Cache in Redis (5 min TTL)
    await fastify.redis.set(`session:${token}`, JSON.stringify(profile), { ex: 300 });

    request.user = profile as AuthUser;
  });

  fastify.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ message: 'Admin access required' });
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['supabase', 'redis'],
});
