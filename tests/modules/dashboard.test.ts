import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';
import dashboardRoutes from '../../src/modules/dashboard/dashboard.routes.js';

const ADMIN_USER = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };
const STAFF_USER = { id: 'user-2', email: 'staff@test.com', full_name: 'Staff', role: 'staff', is_active: true };

function buildApp(user: any) {
  const app = Fastify();
  const mockSupabasePlugin = fp(async (f) => {
    f.decorate('supabase', {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: user.id } }, error: null }) },
      from: vi.fn().mockImplementation((table: string) => {
        const chain = { select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis() };
        if (table === 'orders') return { ...chain, then: (resolve: Function) => resolve({ data: [{ status: 'booked', shipment_type: 'domestic' }], count: 1 }) };
        if (table === 'leads') return { ...chain, then: (resolve: Function) => resolve({ data: [{ source: 'contact_us', status: 'new' }], count: 1 }) };
        if (table === 'invoices') return { ...chain, then: (resolve: Function) => resolve({ data: [{ total_amount: 1000, status: 'paid' }] }) };
        return chain;
      }),
    } as any);
  }, { name: 'supabase' });
  const mockRedisPlugin = fp(async (f) => {
    f.decorate('redis', {
      get: vi.fn().mockImplementation((key: string) => key.startsWith('session:') ? JSON.stringify(user) : null),
      set: vi.fn().mockResolvedValue('OK'),
    } as any);
  }, { name: 'redis' });
  app.register(mockSupabasePlugin);
  app.register(mockRedisPlugin);
  app.register(authPlugin);
  app.register(dashboardRoutes);
  return app;
}

describe('dashboard routes', () => {
  it('returns stats with revenue for admin', async () => {
    const app = buildApp(ADMIN_USER);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/admin/dashboard/stats', headers: { authorization: 'Bearer valid-token' } });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.orders).toBeDefined();
    expect(json.leads).toBeDefined();
    expect(json.revenue).toBeDefined();
  });

  it('returns stats without revenue for staff', async () => {
    const app = buildApp(STAFF_USER);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/admin/dashboard/stats', headers: { authorization: 'Bearer valid-token' } });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.orders).toBeDefined();
    expect(json.leads).toBeDefined();
    expect(json.revenue).toBeUndefined();
  });
});
