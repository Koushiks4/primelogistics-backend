import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, type TestContext } from './helpers/setup.js';

describe('Leads Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should create lead', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        name: 'Integration Test Lead',
        phone: '9876543210',
        email: 'lead@test.com',
        source: 'manual',
        notes: 'Created from integration test',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('new');
    expect(body.source).toBe('manual');
    ctx.createdIds.leads.push(body.id);
  });

  it('should reject lead without name', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        phone: '9876543210',
        email: 'lead@test.com',
        source: 'manual',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should list leads', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should filter leads by source', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads?source=manual',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((lead: any) => {
      expect(lead.source).toBe('manual');
    });
  });

  it('should get lead by ID', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        name: 'Test Lead for Get',
        phone: '9876543211',
        email: 'getlead@test.com',
        source: 'manual',
      },
    });
    const created = createRes.json();
    ctx.createdIds.leads.push(created.id);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/leads/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.id);
  });

  it('should return 404 for random UUID', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads/00000000-0000-0000-0000-000000000000',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('should update lead status', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        name: 'Test Lead for Update',
        phone: '9876543212',
        email: 'updatelead@test.com',
        source: 'manual',
      },
    });
    const created = createRes.json();
    ctx.createdIds.leads.push(created.id);

    const updateRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/admin/leads/${created.id}`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        status: 'contacted',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.status).toBe('contacted');
  });

  it('should delete lead', async () => {
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leads',
      headers: authHeaders(ctx.adminToken),
      payload: {
        name: 'Test Lead for Delete',
        phone: '9876543213',
        email: 'deletelead@test.com',
        source: 'manual',
      },
    });
    const created = createRes.json();
    ctx.createdIds.leads.push(created.id);

    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/admin/leads/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(deleteRes.statusCode).toBe(204);

    const getRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/leads/${created.id}`,
      headers: authHeaders(ctx.adminToken),
    });

    expect(getRes.statusCode).toBe(404);
  });
});
