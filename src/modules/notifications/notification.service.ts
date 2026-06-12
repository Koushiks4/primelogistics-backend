import { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationType } from '../../types.js';

export interface NotificationPayload {
  type: NotificationType;
  recipient: string;
  subject?: string;
  content: string;
  relatedType?: string;
  relatedId?: string;
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>;
}

export class NotificationService {
  private adapters: Map<NotificationType, NotificationAdapter> = new Map();

  constructor(private supabase: SupabaseClient) {}

  registerAdapter(type: NotificationType, adapter: NotificationAdapter) {
    this.adapters.set(type, adapter);
  }

  async send(payload: NotificationPayload): Promise<void> {
    const adapter = this.adapters.get(payload.type);

    const { data: log } = await this.supabase
      .from('notification_logs')
      .insert({ type: payload.type, recipient: payload.recipient, subject: payload.subject, content: payload.content, status: 'pending', related_type: payload.relatedType, related_id: payload.relatedId })
      .select().single();

    if (!adapter) {
      if (log) {
        await this.supabase.from('notification_logs').update({ status: 'failed', error_message: `No adapter for type: ${payload.type}` }).eq('id', log.id);
      }
      return;
    }

    const result = await adapter.send(payload);

    if (log) {
      await this.supabase.from('notification_logs').update({ status: result.success ? 'sent' : 'failed', error_message: result.error }).eq('id', log.id);
    }
  }

  async sendOrderCreatedNotifications(order: {
    id: string; awb_number: string; receiver_name: string; receiver_email?: string;
    receiver_phone?: string; origin_city: string; destination_city: string; shipment_type: string;
  }) {
    const trackingUrl = `${process.env.TRACKING_BASE_URL}/${order.awb_number}`;
    const content = [
      `Your shipment has been booked!`, ``,
      `AWB: ${order.awb_number}`, `From: ${order.origin_city} → ${order.destination_city}`,
      `Type: ${order.shipment_type}`, ``, `Track your shipment:`, trackingUrl, ``, `Prime Logistic Services`,
    ].join('\n');

    if (order.receiver_phone) {
      await this.send({ type: 'whatsapp', recipient: order.receiver_phone, content, relatedType: 'order', relatedId: order.id });
    }
    if (order.receiver_email) {
      await this.send({ type: 'email', recipient: order.receiver_email, subject: `Shipment Booked — ${order.awb_number}`, content, relatedType: 'order', relatedId: order.id });
    }
  }

  async sendNewLeadNotification(lead: { id: string; name: string; source: string; email?: string; phone?: string }) {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!adminEmail) return;
    await this.send({
      type: 'email', recipient: adminEmail,
      subject: `New Lead: ${lead.name} (${lead.source})`,
      content: `A new lead has been submitted.\n\nName: ${lead.name}\nSource: ${lead.source}\nEmail: ${lead.email || 'N/A'}\nPhone: ${lead.phone || 'N/A'}`,
      relatedType: 'lead', relatedId: lead.id,
    });
  }

  async sendInvoiceEmail(invoice: { id: string; invoice_number: string; client_name: string; client_email: string; total_amount: number }) {
    await this.send({
      type: 'email', recipient: invoice.client_email,
      subject: `Invoice ${invoice.invoice_number} — Prime Logistic Services`,
      content: `Dear ${invoice.client_name},\n\nPlease find your invoice ${invoice.invoice_number} for ₹${invoice.total_amount}.\n\nThank you for choosing Prime Logistic Services.`,
      relatedType: 'invoice', relatedId: invoice.id,
    });
  }
}
