import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import formsRoutes from '../../src/modules/forms/forms.routes.js';

function buildApp() {
  const app = Fastify();
  const mockFrom = vi.fn();
  app.register(fp(async (f) => {
    f.decorate('supabase', { from: mockFrom } as any);
    f.decorate('notifications', {
      sendNewLeadNotification: vi.fn().mockResolvedValue(undefined),
    } as any);
  }));
  app.register(formsRoutes);
  return { app, mockFrom };
}

describe('forms routes', () => {
  it('POST /api/forms/contact-us creates a lead from contact form', async () => {
    const { app, mockFrom } = buildApp();
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'lead-1', source: 'contact_us', name: 'Test' }, error: null }) }) }) });
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/forms/contact-us', payload: { name: 'Test', email: 'test@example.com', phone: '999', message: 'Hello' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().message).toContain('Thank you');
  });

  it('POST /api/forms/shipment-enquiry validates required fields', async () => {
    const { app } = buildApp();
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/forms/shipment-enquiry', payload: { name: 'Test' } });
    expect(response.statusCode).toBe(400);
  });

  it('POST /api/forms/franchise-request creates a franchise lead', async () => {
    const { app, mockFrom } = buildApp();
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'lead-2', source: 'franchise_request', name: 'Franchise Test' }, error: null }) }) }) });
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/forms/franchise-request', payload: { name: 'Franchise Test', email: 'f@test.com', phone: '888', city: 'Delhi', investment_budget: '10-20L' } });
    expect(response.statusCode).toBe(201);
  });
});
