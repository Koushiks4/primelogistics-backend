import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import trackingRoutes from '../../src/modules/tracking/tracking.routes.js';

const MOCK_TRACKING = {
  id: 'order-1', awb_number: 'PLS-2026-00001', partner_name: 'Delhivery', partner_awb_number: 'DLV-12345',
  shipment_type: 'domestic', status: 'in_transit', origin_city: 'Bangalore', destination_city: 'Mumbai',
  sender_name: 'John', receiver_name: 'Jane', created_at: '2026-06-12T00:00:00Z',
  order_status_history: [
    { id: 'h-1', status: 'in_transit', location: 'Hubli Hub', remarks: 'In transit', created_at: '2026-06-12T08:00:00Z' },
    { id: 'h-2', status: 'booked', location: null, remarks: 'Order created', created_at: '2026-06-11T10:00:00Z' },
  ],
};

function buildApp(result: any) {
  const app = Fastify();
  app.register(fp(async (f) => {
    f.decorate('supabase', {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: result, error: result ? null : { message: 'Not found' } }),
              }),
            }),
          }),
        }),
      }),
    } as any);
  }));
  app.register(trackingRoutes);
  return app;
}

describe('tracking routes', () => {
  it('returns tracking info for valid AWB', async () => {
    const app = buildApp(MOCK_TRACKING);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/track/PLS-2026-00001' });
    expect(response.statusCode).toBe(200);
    expect(response.json().awb_number).toBe('PLS-2026-00001');
    expect(response.json().order_status_history).toHaveLength(2);
  });

  it('returns 404 for unknown AWB', async () => {
    const app = buildApp(null);
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/track/UNKNOWN-999' });
    expect(response.statusCode).toBe(404);
  });
});
