import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';

async function buildTestApp(mockUser: any | null) {
  const app = Fastify();

  // Mock supabase plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('supabase', {
        auth: {
          getUser: vi.fn().mockResolvedValue(
            mockUser
              ? { data: { user: { id: mockUser.id } }, error: null }
              : { data: { user: null }, error: { message: 'Invalid token' } }
          ),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                mockUser
                  ? { data: mockUser, error: null }
                  : { data: null, error: { message: 'Not found' } }
              ),
            }),
          }),
        }),
      } as any);
    }, { name: 'supabase' })
  );

  // Mock redis plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('redis', {
        get: vi.fn().mockResolvedValue(mockUser ? JSON.stringify(mockUser) : null),
        set: vi.fn().mockResolvedValue('OK'),
      } as any);
    }, { name: 'redis' })
  );

  await app.register(authPlugin);

  // Test routes - add before ready, use fastify instance from register context
  await app.register(async (fastify) => {
    // Test route that requires auth
    fastify.get('/test-auth', { preHandler: [fastify.authenticate] }, async (request) => ({
      user: request.user,
    }));

    // Test route that requires admin
    fastify.get('/test-admin', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, async (request) => ({
      user: request.user,
    }));
  });

  await app.ready();

  return app;
}

describe('auth plugin', () => {
  it('rejects requests without Authorization header', async () => {
    const app = await buildTestApp(null);

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Missing authorization header');
  });

  it('authenticates valid token and attaches user', async () => {
    const mockUser = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };
    const app = await buildTestApp(mockUser);

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('admin@test.com');
  });

  it('blocks inactive users', async () => {
    const mockUser = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: false };
    const app = await buildTestApp(mockUser);

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('blocks staff from admin-only routes', async () => {
    const mockUser = { id: 'user-1', email: 'staff@test.com', full_name: 'Staff', role: 'staff', is_active: true };
    const app = await buildTestApp(mockUser);

    const response = await app.inject({
      method: 'GET',
      url: '/test-admin',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows admin to access admin-only routes', async () => {
    const mockUser = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };
    const app = await buildTestApp(mockUser);

    const response = await app.inject({
      method: 'GET',
      url: '/test-admin',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
  });
});
