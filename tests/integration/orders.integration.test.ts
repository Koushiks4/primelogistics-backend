import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, VALID_ORDER, type TestContext } from './helpers/setup.js';

describe('Orders Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should create order with auto AWB', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.awb_number).toMatch(/^PLS-\d{4}-\d{5}$/);
    expect(body.status).toBe('booked');
    ctx.createdIds.orders.push(body.id);
  });

  it('should create order with manual AWB', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: {
        ...VALID_ORDER,
        awb_number: 'MANUAL-123456',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.awb_number).toBe('MANUAL-123456');
    ctx.createdIds.orders.push(body.id);
  });

  it('should create order with partner AWB', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: {
        ...VALID_ORDER,
        partner_name: 'Delhivery',
        partner_awb_number: 'DLVY-987654321',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.partner_name).toBe('Delhivery');
    expect(body.partner_awb_number).toBe('DLVY-987654321');
    ctx.createdIds.orders.push(body.id);
  });

  it('should reject invalid order payload', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: {
        shipment_type: 'domestic',
        sender_name: 'Test',
        // Missing required fields
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should list orders', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(ctx.createdIds.orders.length);
  });

  it('should filter orders by status', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders?status=booked',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((order: any) => {
      expect(order.status).toBe('booked');
    });
  });

  it('should search orders by AWB', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const searchRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/orders?search=${created.awb_number}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(searchRes.statusCode).toBe(200);
    const body = searchRes.json();
    const found = body.data.find((o: any) => o.id === created.id);
    expect(found).toBeDefined();
  });

  it('should paginate orders', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders?page=1&limit=5',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  it('should get order by ID', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/orders/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.id);
    expect(Array.isArray(body.order_status_history)).toBe(true);
  });

  it('should update order', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const updateRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/admin/orders/${created.id}`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        receiver_name: 'Updated Receiver Name',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.receiver_name).toBe('Updated Receiver Name');
  });

  it('should update order status', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const statusRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${created.id}/status`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        status: 'in_transit',
        location: 'Mumbai Hub',
        notes: 'Package picked up',
      },
    });

    expect(statusRes.statusCode).toBe(200);
    const body = statusRes.json();
    expect(body.status).toBe('in_transit');
  });

  it('should soft delete order', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_ORDER,
    });
    const created = createRes.json();
    ctx.createdIds.orders.push(created.id);

    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/admin/orders/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(deleteRes.statusCode).toBe(204);

    const getRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/orders/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(getRes.statusCode).toBe(404);
  });

  it('should create order with client_id', async () => {
    const clientRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/clients',
      headers: authHeaders(ctx.adminToken),
      payload: { name: 'Order Client Test' },
    });
    const client = clientRes.json();
    ctx.createdIds.clients.push(client.id);

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: { ...VALID_ORDER, client_id: client.id },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.client_id).toBe(client.id);
    ctx.createdIds.orders.push(body.id);
  });

  it('should filter orders by client_id', async () => {
    const clientRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/clients',
      headers: authHeaders(ctx.adminToken),
      payload: { name: 'Filter Client Test' },
    });
    const client = clientRes.json();
    ctx.createdIds.clients.push(client.id);

    const orderRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/orders',
      headers: authHeaders(ctx.adminToken),
      payload: { ...VALID_ORDER, client_id: client.id },
    });
    ctx.createdIds.orders.push(orderRes.json().id);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/orders?client_id=${client.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((order: any) => {
      expect(order.client_id).toBe(client.id);
    });
  });

  it('should export orders as Excel', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders/export/excel',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="orders-export-.*\.xlsx"/);
  });

  it('should export orders as PDF', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders/export/pdf',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="orders-export-.*\.pdf"/);
  });

  it('should export filtered orders as Excel', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders/export/excel?status=booked',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
