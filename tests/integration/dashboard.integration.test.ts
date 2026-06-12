import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, VALID_ORDER, VALID_INVOICE, type TestContext } from './helpers/setup.js';

describe('Dashboard Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();

    // Create test data for dashboard stats
    const orderRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const order = orderRes.json();
    ctx.createdIds.orders.push(order.id);

    const leadRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        name: 'Dashboard Test Lead',
        phone: '9876543210',
        email: 'dashboardlead@test.com',
        source: 'manual',
      },
    });
    const lead = leadRes.json();
    ctx.createdIds.leads.push(lead.id);

    const invoiceRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const invoice = invoiceRes.json();
    ctx.createdIds.invoices.push(invoice.id);
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should get stats with revenue as admin', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/stats',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('orders');
    expect(body).toHaveProperty('leads');
    expect(body).toHaveProperty('revenue');
  });

  it('should get stats without revenue as staff', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/stats',
      headers: authHeaders(ctx.staffToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('orders');
    expect(body).toHaveProperty('leads');
    expect(body).not.toHaveProperty('revenue');
  });

  it('should return valid stats structure', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/stats',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.orders.total).toBe('number');
    expect(body.orders.byStatus).toBeDefined();
    expect(body.orders.byType).toBeDefined();
  });

  it('should reject unauthenticated access', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/dashboard/stats',
    });

    expect(res.statusCode).toBe(401);
  });
});
