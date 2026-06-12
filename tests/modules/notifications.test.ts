import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '../../src/modules/notifications/notification.service.js';
import type { NotificationAdapter } from '../../src/modules/notifications/notification.service.js';

function buildService() {
  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  } as any;
  return { service: new NotificationService(mockSupabase), mockSupabase };
}

describe('NotificationService', () => {
  it('sends notification via registered adapter', async () => {
    const { service } = buildService();
    const mockAdapter: NotificationAdapter = { send: vi.fn().mockResolvedValue({ success: true }) };
    service.registerAdapter('email', mockAdapter);
    await service.send({ type: 'email', recipient: 'test@example.com', subject: 'Test', content: 'Hello' });
    expect(mockAdapter.send).toHaveBeenCalledOnce();
  });

  it('logs failed notification when no adapter exists', async () => {
    const { service, mockSupabase } = buildService();
    await service.send({ type: 'whatsapp', recipient: '+919999999999', content: 'Hello' });
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_logs');
  });

  it('sends order created notifications to receiver', async () => {
    const { service } = buildService();
    const emailAdapter: NotificationAdapter = { send: vi.fn().mockResolvedValue({ success: true }) };
    const whatsappAdapter: NotificationAdapter = { send: vi.fn().mockResolvedValue({ success: true }) };
    service.registerAdapter('email', emailAdapter);
    service.registerAdapter('whatsapp', whatsappAdapter);
    process.env.TRACKING_BASE_URL = 'https://admin.primelogistic.com/track';
    await service.sendOrderCreatedNotifications({
      id: 'order-1', awb_number: 'PLS-2026-00001', receiver_name: 'Jane',
      receiver_email: 'jane@test.com', receiver_phone: '+919999999999',
      origin_city: 'Bangalore', destination_city: 'Mumbai', shipment_type: 'domestic',
    });
    expect(whatsappAdapter.send).toHaveBeenCalledOnce();
    expect(emailAdapter.send).toHaveBeenCalledOnce();
  });
});
