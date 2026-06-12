import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, VALID_INVOICE, type TestContext } from './helpers/setup.js';

describe('Invoices Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should create invoice as admin', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.invoice_number).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(body.status).toBe('draft');
    expect(Array.isArray(body.invoice_items)).toBe(true);
    expect(body.invoice_items.length).toBe(2);
    ctx.createdIds.invoices.push(body.id);
  });

  it('should reject invalid invoice', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: {
        client_name: 'Test Client',
        // Missing required fields
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should list invoices as admin', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should get invoice by ID as admin', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const created = createRes.json();
    ctx.createdIds.invoices.push(created.id);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/invoices/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.id);
    expect(Array.isArray(body.invoice_items)).toBe(true);
  });

  it('should update invoice status as admin', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const created = createRes.json();
    ctx.createdIds.invoices.push(created.id);

    const updateRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/admin/invoices/${created.id}`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        status: 'sent',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.status).toBe('sent');
  });

  it('should add line item as admin', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const created = createRes.json();
    ctx.createdIds.invoices.push(created.id);

    const addItemRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/invoices/${created.id}/items`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        description: 'Additional Service',
        quantity: 1,
        unit_price: 500,
        amount: 500,
      },
    });

    expect(addItemRes.statusCode).toBe(201);
    const body = addItemRes.json();
    expect(body.description).toBe('Additional Service');
  });

  it('should delete invoice as admin', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const created = createRes.json();
    ctx.createdIds.invoices.push(created.id);

    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/admin/invoices/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(deleteRes.statusCode).toBe(204);
  });

  it('should block staff from listing invoices', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.staffToken),
    });

    expect(res.statusCode).toBe(403);
  });

  it('should block staff from creating invoices', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.staffToken),
      payload: VALID_INVOICE,
    });

    expect(res.statusCode).toBe(403);
  });

  it('should download invoice PDF as admin', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/invoices',
      headers: authHeaders(ctx.adminToken),
      payload: VALID_INVOICE,
    });
    const created = createRes.json();
    ctx.createdIds.invoices.push(created.id);

    const pdfRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/invoices/${created.id}/pdf`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
  });
});
