import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';
import ordersRoutes from '../../src/modules/orders/orders.routes.js';

const MOCK_ORDER = {
  id: 'order-1', awb_number: 'PLS-2026-00001', shipment_type: 'domestic', status: 'booked',
  sender_name: 'John', sender_phone: '9999999999', sender_address: '123 Street',
  receiver_name: 'Jane', receiver_phone: '8888888888', receiver_address: '456 Avenue',
  origin_city: 'Bangalore', destination_city: 'Mumbai', created_at: '2026-06-12T00:00:00Z',
};
const MOCK_USER = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };

function buildApp() {
  const app = Fastify();
  const mockFrom = vi.fn();
  const mockSupabasePlugin = fp(async (f) => {
    f.decorate('supabase', {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: MOCK_USER.id } }, error: null }) },
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: 'PLS-2026-00001', error: null }),
    } as any);
  }, { name: 'supabase' });

  const mockRedisPlugin = fp(async (f) => {
    f.decorate('redis', { get: vi.fn().mockResolvedValue(JSON.stringify(MOCK_USER)), set: vi.fn().mockResolvedValue('OK') } as any);
  }, { name: 'redis' });

  const mockNotificationsPlugin = fp(async (f) => {
    f.decorate('notifications', {
      sendOrderCreatedNotifications: vi.fn().mockResolvedValue(undefined),
    } as any);
  }, { name: 'notifications' });

  app.register(mockSupabasePlugin);
  app.register(mockRedisPlugin);
  app.register(mockNotificationsPlugin);
  app.register(authPlugin);
  app.register(ordersRoutes);
  return { app, mockFrom };
}

describe('orders routes', () => {
  it('POST /api/admin/orders creates an order', async () => {
    const { app, mockFrom } = buildApp();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: MOCK_ORDER, error: null }) }) }) };
      if (table === 'order_status_history') return { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };
    });
    await app.ready();
    const response = await app.inject({
      method: 'POST', url: '/api/admin/orders', headers: { authorization: 'Bearer valid-token' },
      payload: { shipment_type: 'domestic', sender_name: 'John', sender_phone: '9999999999', sender_address: '123 Street', receiver_name: 'Jane', receiver_phone: '8888888888', receiver_address: '456 Avenue', origin_city: 'Bangalore', destination_city: 'Mumbai' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().awb_number).toBe('PLS-2026-00001');
  });

  it('rejects orders without required fields', async () => {
    const { app } = buildApp();
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/admin/orders', headers: { authorization: 'Bearer valid-token' }, payload: { shipment_type: 'domestic' } });
    expect(response.statusCode).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    const { app } = buildApp();
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/admin/orders', payload: { shipment_type: 'domestic' } });
    expect(response.statusCode).toBe(401);
  });
});
