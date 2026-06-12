import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, type TestContext } from './helpers/setup.js';

describe('Auth Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should login with valid admin credentials', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
    expect(body.user.role).toBe('admin');
  });

  it('should login with valid staff credentials', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.TEST_STAFF_EMAIL,
        password: process.env.TEST_STAFF_PASSWORD,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('access_token');
    expect(body.user.role).toBe('staff');
  });

  it('should reject login with wrong password', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: 'wrongpassword123',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject login with missing fields', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.TEST_ADMIN_EMAIL,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should refresh token successfully', async () => {
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
      },
    });

    const loginBody = loginRes.json();

    const refreshRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refresh_token: loginBody.refresh_token,
      },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json();
    expect(refreshBody).toHaveProperty('access_token');
    expect(refreshBody).toHaveProperty('refresh_token');
  });

  it('should reject refresh with invalid token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refresh_token: 'invalid-token-12345',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject protected route without auth header', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/orders',
    });

    expect(res.statusCode).toBe(401);
  });
});
