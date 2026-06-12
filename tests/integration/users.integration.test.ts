import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, type TestContext } from './helpers/setup.js';

describe('Users Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should list users as admin', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: authHeaders(ctx.adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);

    const adminUser = body.find((u: any) => u.id === ctx.adminUser.id);
    const staffUser = body.find((u: any) => u.id === ctx.staffUser.id);

    expect(adminUser).toBeDefined();
    expect(staffUser).toBeDefined();
  });

  it('should block staff from listing users', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: authHeaders(ctx.staffToken),
    });

    expect(res.statusCode).toBe(403);
  });

  it('should block staff from creating users', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: authHeaders(ctx.staffToken),
      payload: {
        email: 'newuser@test.com',
        password: 'password123',
        full_name: 'New User',
        role: 'staff',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should update user as admin', async () => {
    const originalActive = ctx.staffUser.is_active;
    const newActive = !originalActive;

    const updateRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/admin/users/${ctx.staffUser.id}`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        is_active: newActive,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.is_active).toBe(newActive);

    // Revert the change
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/admin/users/${ctx.staffUser.id}`,
      headers: authHeaders(ctx.adminToken),
      payload: {
        is_active: originalActive,
      },
    });
  });
});
