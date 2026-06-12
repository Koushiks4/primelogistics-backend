import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';
import invoicesRoutes from '../../src/modules/invoices/invoices.routes.js';

const MOCK_INVOICE = { id: 'inv-1', invoice_number: 'INV-2026-00001', client_name: 'Acme Corp', subtotal: 1000, tax_amount: 180, discount_amount: 0, total_amount: 1180, status: 'draft', invoice_items: [{ id: 'item-1', description: 'Freight charges', quantity: 1, unit_price: 1000, amount: 1000 }] };
const ADMIN_USER = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };
const STAFF_USER = { id: 'user-2', email: 'staff@test.com', full_name: 'Staff', role: 'staff', is_active: true };

function buildApp(user: any) {
  const app = Fastify();
  const mockFrom = vi.fn();
  const mockSupabasePlugin = fp(async (f) => {
    f.decorate('supabase', {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: user.id } }, error: null }) },
      from: mockFrom, rpc: vi.fn().mockResolvedValue({ data: 'INV-2026-00001', error: null }),
    } as any);
  }, { name: 'supabase' });
  const mockRedisPlugin = fp(async (f) => {
    f.decorate('redis', { get: vi.fn().mockResolvedValue(JSON.stringify(user)), set: vi.fn().mockResolvedValue('OK') } as any);
  }, { name: 'redis' });
  app.register(mockSupabasePlugin);
  app.register(mockRedisPlugin);
  app.register(authPlugin);
  app.register(invoicesRoutes);
  return { app, mockFrom };
}

describe('invoices routes', () => {
  it('blocks staff from accessing invoices', async () => {
    const { app } = buildApp(STAFF_USER);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { authorization: 'Bearer valid-token' } });
    expect(response.statusCode).toBe(403);
  });

  it('allows admin to create invoice', async () => {
    const { app, mockFrom } = buildApp(ADMIN_USER);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'invoices') return {
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: MOCK_INVOICE, error: null }) }) }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: MOCK_INVOICE, error: null }) }) }),
      };
      if (table === 'invoice_items') return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    await app.ready();
    const response = await app.inject({
      method: 'POST', url: '/api/admin/invoices', headers: { authorization: 'Bearer valid-token' },
      payload: { client_name: 'Acme Corp', invoice_date: '2026-06-12', subtotal: 1000, tax_amount: 180, total_amount: 1180, items: [{ description: 'Freight charges', quantity: 1, unit_price: 1000, amount: 1000 }] },
    });
    expect(response.statusCode).toBe(201);
  });
});
