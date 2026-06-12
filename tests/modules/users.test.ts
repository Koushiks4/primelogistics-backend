import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';
import usersRoutes from '../../src/modules/users/users.routes.js';

const ADMIN_USER = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };
const STAFF_USER = { id: 'user-2', email: 'staff@test.com', full_name: 'Staff', role: 'staff', is_active: true };

function buildApp(user: any) {
  const app = Fastify();
  const mockSupabasePlugin = fp(async (f) => {
    f.decorate('supabase', {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: user.id } }, error: null }),
        admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }) },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [ADMIN_USER, STAFF_USER], error: null }) }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: STAFF_USER, error: null }) }) }) }),
      }),
    } as any);
  }, { name: 'supabase' });
  const mockRedisPlugin = fp(async (f) => {
    f.decorate('redis', { get: vi.fn().mockResolvedValue(JSON.stringify(user)), set: vi.fn().mockResolvedValue('OK') } as any);
  }, { name: 'redis' });
  app.register(mockSupabasePlugin);
  app.register(mockRedisPlugin);
  app.register(authPlugin);
  app.register(usersRoutes);
  return app;
}

describe('users routes', () => {
  it('blocks staff from listing users', async () => {
    const app = buildApp(STAFF_USER);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { authorization: 'Bearer valid-token' } });
    expect(response.statusCode).toBe(403);
  });

  it('allows admin to list users', async () => {
    const app = buildApp(ADMIN_USER);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { authorization: 'Bearer valid-token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('allows admin to invite a user', async () => {
    const app = buildApp(ADMIN_USER);
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/admin/users', headers: { authorization: 'Bearer valid-token' }, payload: { email: 'new@test.com', full_name: 'New User', role: 'staff' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().email).toBe('new@test.com');
  });
});
