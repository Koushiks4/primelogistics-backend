import { SupabaseClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { DelhiveryService } from './delhivery.service.js';
import type { OrderStatus } from '../../types.js';

const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'returned', 'cancelled'];

export class PartnerSyncService {
  private delhivery: DelhiveryService;

  constructor(
    private supabase: SupabaseClient,
    private redis: Redis
  ) {
    this.delhivery = new DelhiveryService();
  }

  async processStatusUpdate(
    partnerAwb: string,
    newStatus: OrderStatus,
    location: string | null,
    remarks: string | null,
    source: 'webhook' | 'poll',
    rawResponse?: any
  ): Promise<{ updated: boolean; orderId?: string; oldStatus?: string }> {
    // Find order by partner AWB
    const { data: order, error: findError } = await this.supabase
      .from('orders')
      .select('id, status, partner_name, partner_awb_number')
      .eq('partner_awb_number', partnerAwb)
      .is('deleted_at', null)
      .single();

    if (findError || !order) {
      await this.logSync(null, 'Delhivery', partnerAwb, null, newStatus, source, rawResponse, false, `Order not found for AWB: ${partnerAwb}`);
      return { updated: false };
    }

    // Skip if status unchanged
    if (order.status === newStatus) {
      return { updated: false, orderId: order.id, oldStatus: order.status };
    }

    const oldStatus = order.status;

    // Update order status
    await this.supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    // Create status history entry
    await this.supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        status: newStatus,
        location: location || undefined,
        remarks: remarks ? `[Delhivery] ${remarks}` : `[Delhivery] Status updated via ${source}`,
        updated_by: null,
      });

    // Log successful sync
    await this.logSync(order.id, 'Delhivery', partnerAwb, oldStatus, newStatus, source, rawResponse, true, null);

    return { updated: true, orderId: order.id, oldStatus };
  }

  async pollDelhiveryOrders(): Promise<{ total: number; updated: number; errors: number }> {
    // Acquire Redis lock
    const lockKey = 'sync:delhivery:lock';
    const locked = await this.redis.set(lockKey, '1', { nx: true, ex: 300 });
    if (!locked) {
      return { total: 0, updated: 0, errors: 0 };
    }

    try {
      // Fetch active Delhivery orders
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('id, partner_awb_number, status')
        .ilike('partner_name', '%delhivery%')
        .not('partner_awb_number', 'is', null)
        .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
        .is('deleted_at', null);

      if (error || !orders) {
        return { total: 0, updated: 0, errors: 1 };
      }

      let updated = 0;
      let errors = 0;

      for (const order of orders) {
        try {
          const tracking = await this.delhivery.fetchTrackingStatus(order.partner_awb_number!);
          if (tracking.status) {
            const result = await this.processStatusUpdate(
              order.partner_awb_number!,
              tracking.status,
              tracking.location,
              tracking.remarks,
              'poll',
              tracking.rawResponse
            );
            if (result.updated) updated++;
          }
        } catch (err) {
          errors++;
          await this.logSync(order.id, 'Delhivery', order.partner_awb_number!, null, null, 'poll', null, false, err instanceof Error ? err.message : 'Unknown error');
        }
      }

      return { total: orders.length, updated, errors };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async getSyncLogs(limit = 50) {
    const { data, error } = await this.supabase
      .from('partner_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  private async logSync(
    orderId: string | null,
    partnerName: string,
    partnerAwb: string,
    oldStatus: string | null,
    newStatus: string | OrderStatus | null,
    source: string,
    rawResponse: any,
    success: boolean,
    errorMessage: string | null
  ) {
    await this.supabase.from('partner_sync_logs').insert({
      order_id: orderId,
      partner_name: partnerName,
      partner_awb: partnerAwb,
      old_status: oldStatus,
      new_status: newStatus,
      source,
      raw_response: rawResponse ? JSON.parse(JSON.stringify(rawResponse)) : null,
      success,
      error_message: errorMessage,
    });
  }
}
