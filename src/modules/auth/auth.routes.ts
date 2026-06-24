import { FastifyInstance } from 'fastify';
import { loginSchema, refreshSchema } from './auth.schema.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    }
    

    const { email, password } = parsed.data;
    const { data, error } = await fastify.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return reply.status(401).send({ message: 'Invalid email or password' });
    }
    console.log(data.user)

    // Get profile for role info
    const { data: profile } = await fastify.supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', data.user.id)
      .single();

    console.log(profile)

    if (!profile?.is_active) {
      return reply.status(403).send({ message: 'Account is deactivated' });
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: profile,
    };
  });

  fastify.post('/api/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid input', errors: parsed.error.flatten() });
    }

    const { data, error } = await fastify.supabase.auth.refreshSession({
      refresh_token: parsed.data.refresh_token,
    });

    if (error || !data.session) {
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
  });
}
