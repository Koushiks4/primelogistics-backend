import { SupabaseClient } from '@supabase/supabase-js';

export class TrackingService {
  constructor(private supabase: SupabaseClient) {}

  async trackByAwb(awbNumber: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id, awb_number, partner_name, partner_awb_number, shipment_type, status, origin_city, destination_city, sender_name, receiver_name, created_at, order_status_history(id, status, location, remarks, created_at)')
      .is('deleted_at', null)
      .or(`awb_number.eq.${awbNumber},partner_awb_number.eq.${awbNumber}`)
      .order('created_at', { referencedTable: 'order_status_history', ascending: false })
      .single();

    if (error || !data) return null;
    return data;
  }

  async getOrdersBySenderEmail(email: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id, awb_number, partner_name, partner_awb_number, shipment_type, status, origin_city, destination_city, receiver_name, created_at, order_status_history(id, status, location, remarks, created_at)')
      .eq('sender_email', email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'order_status_history', ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
