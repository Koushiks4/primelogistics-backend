import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import authPlugin from '../../src/plugins/auth.js';
import leadsRoutes from '../../src/modules/leads/leads.routes.js';

const MOCK_LEAD = { id: 'lead-1', source: 'contact_us', status: 'new', name: 'Test User', email: 'test@example.com', phone: '9999999999', message: 'Interested in shipping', created_at: '2026-06-12T00:00:00Z' };
const MOCK_USER = { id: 'user-1', email: 'admin@test.com', full_name: 'Admin', role: 'admin', is_active: true };

function buildApp() {
  const app = Fastify();
  const mockFrom = vi.fn();
  const mockSupabasePlugin = fp(async (f) => {
    f.decorate('supabase', { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: MOCK_USER.id } }, error: null }) }, from: mockFrom } as any);
  }, { name: 'supabase' });

  const mockRedisPlugin = fp(async (f) => {
    f.decorate('redis', { get: vi.fn().mockResolvedValue(JSON.stringify(MOCK_USER)), set: vi.fn().mockResolvedValue('OK') } as any);
  }, { name: 'redis' });

  app.register(mockSupabasePlugin);
  app.register(mockRedisPlugin);
  app.register(authPlugin);
  app.register(leadsRoutes);
  return { app, mockFrom };
}

describe('leads routes', () => {
  it('POST /api/admin/leads creates a lead', async () => {
    const { app, mockFrom } = buildApp();
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: MOCK_LEAD, error: null }) }) }) });
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/admin/leads', headers: { authorization: 'Bearer valid-token' }, payload: { source: 'contact_us', name: 'Test User', email: 'test@example.com' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Test User');
  });

  it('rejects leads without name', async () => {
    const { app } = buildApp();
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/admin/leads', headers: { authorization: 'Bearer valid-token' }, payload: { source: 'contact_us' } });
    expect(response.statusCode).toBe(400);
  });
});
