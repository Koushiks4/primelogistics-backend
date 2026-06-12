import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestContext, teardownTestContext, authHeaders, type TestContext } from './helpers/setup.js';

describe('Forms Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(ctx);
  });

  it('should submit contact us form', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/contact-us',
      payload: {
        name: 'Contact Test User',
        email: 'contact@test.com',
        phone: '9876543210',
        message: 'This is a test contact message',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toContain('Thank you');

    // Find and track the created lead
    const leadsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads?source=contact_form',
      headers: authHeaders(ctx.adminToken),
    });
    if (leadsRes.statusCode === 200) {
      const leads = leadsRes.json();
      const createdLead = leads.data?.find((l: any) => l.email === 'contact@test.com');
      if (createdLead) {
        ctx.createdIds.leads.push(createdLead.id);
      }
    }
  });

  it('should reject contact us without message', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/contact-us',
      payload: {
        name: 'Contact Test User',
        email: 'contact@test.com',
        phone: '9876543210',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should submit shipment enquiry form', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/shipment-enquiry',
      payload: {
        name: 'Shipment Test User',
        email: 'shipment@test.com',
        phone: '9876543211',
        origin_city: 'Bangalore',
        destination_city: 'Mumbai',
        shipment_type: 'domestic',
        weight: '10',
        dimensions: '10x10x10',
        message: 'Need quote for shipment',
      },
    });

    expect(res.statusCode).toBe(201);

    // Find and track the created lead
    const leadsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads?source=shipment_enquiry',
      headers: authHeaders(ctx.adminToken),
    });
    if (leadsRes.statusCode === 200) {
      const leads = leadsRes.json();
      const createdLead = leads.data?.find((l: any) => l.email === 'shipment@test.com');
      if (createdLead) {
        ctx.createdIds.leads.push(createdLead.id);
      }
    }
  });

  it('should reject shipment enquiry without origin_city', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/shipment-enquiry',
      payload: {
        name: 'Shipment Test User',
        email: 'shipment@test.com',
        phone: '9876543211',
        destination_city: 'Mumbai',
        shipment_type: 'domestic',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should submit franchise request form', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/franchise-request',
      payload: {
        name: 'Franchise Test User',
        email: 'franchise@test.com',
        phone: '9876543212',
        city: 'Delhi',
        investment_budget: '10-25 lakhs',
        experience: 'Yes, 5 years in logistics',
        message: 'Interested in franchise opportunity',
      },
    });

    expect(res.statusCode).toBe(201);

    // Find and track the created lead
    const leadsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/leads?source=franchise_request',
      headers: authHeaders(ctx.adminToken),
    });
    if (leadsRes.statusCode === 200) {
      const leads = leadsRes.json();
      const createdLead = leads.data?.find((l: any) => l.email === 'franchise@test.com');
      if (createdLead) {
        ctx.createdIds.leads.push(createdLead.id);
      }
    }
  });

  it('should reject franchise request without investment_budget', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/forms/franchise-request',
      payload: {
        name: 'Franchise Test User',
        email: 'franchise@test.com',
        phone: '9876543212',
        city: 'Delhi',
        experience: 'Yes',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
