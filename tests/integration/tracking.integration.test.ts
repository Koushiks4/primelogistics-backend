import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, VALID_ORDER, type TestContext } from './helpers/setup.js';

describe('Tracking Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should track by company AWB', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const trackRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/track/${created.awb_number}`,
    });

    expect(trackRes.statusCode).toBe(200);
    const body = trackRes.json();
    expect(body.awb_number).toBe(created.awb_number);
    expect(Array.isArray(body.order_status_history)).toBe(true);
  });

  it('should track by partner AWB', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: {
        ...VALID_ORDER,
        partner_name: 'BlueDart',
        partner_awb_number: 'BD-123456789',
      },
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const trackRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/track/BD-123456789',
    });

    expect(trackRes.statusCode).toBe(200);
    const body = trackRes.json();
    expect(body.partner_awb_number).toBe('BD-123456789');
  });

  it('should return 404 for unknown AWB', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/track/UNKNOWN-AWB-12345',
    });

    expect(res.statusCode).toBe(404);
  });

  it('should allow tracking without authentication', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const trackRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/track/${created.awb_number}`,
      // No headers - unauthenticated request
    });

    expect(trackRes.statusCode).toBe(200);
    const body = trackRes.json();
    expect(body.awb_number).toBe(created.awb_number);
  });
});
