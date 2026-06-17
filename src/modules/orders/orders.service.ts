import { SupabaseClient } from '@supabase/supabase-js';
import { generateAwbNumber } from './awb.service.js';
import type { CreateOrderInput, UpdateOrderInput, UpdateStatusInput, ListOrdersQuery } from './orders.schema.js';

export class OrdersService {
  constructor(private supabase: SupabaseClient) {}

  async list(query: ListOrdersQuery) {
    const { page, limit, status, shipment_type, search, from_date, to_date, client_id } = query;
    const offset = (page - 1) * limit;

    let q = this.supabase
      .from('orders')
      .select('*, order_status_history(id, status, location, remarks, created_at)', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = q.eq('status', status);
    if (shipment_type) q = q.eq('shipment_type', shipment_type);
    if (client_id) q = q.eq('client_id', client_id);
    if (from_date) q = q.gte('created_at', from_date);
    if (to_date) q = q.lte('created_at', to_date);
    if (search) {
      q = q.or(`awb_number.ilike.%${search}%,partner_awb_number.ilike.%${search}%,sender_name.ilike.%${search}%,receiver_name.ilike.%${search}%`);
    }

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_status_history(id, status, location, remarks, updated_by, created_at)')
      .eq('id', id)
      .is('deleted_at', null)
      .order('created_at', { referencedTable: 'order_status_history', ascending: false })
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async create(input: CreateOrderInput, userId: string) {
    const awbNumber = input.awb_number || (await generateAwbNumber(this.supabase));

    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        ...input,
        awb_number: awbNumber,
        status: 'booked',
        created_by: userId,
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    await this.supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'booked',
      remarks: 'Order created',
      updated_by: userId,
    });

    return order;
  }

  async update(id: string, input: UpdateOrderInput) {
    const { data, error } = await this.supabase
      .from('orders')
      .update(input)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateStatus(id: string, input: UpdateStatusInput, userId: string) {
    const { error: orderError } = await this.supabase
      .from('orders')
      .update({ status: input.status })
      .eq('id', id)
      .is('deleted_at', null);

    if (orderError) throw new Error(orderError.message);

    const { data: history, error: historyError } = await this.supabase
      .from('order_status_history')
      .insert({
        order_id: id,
        status: input.status,
        location: input.location,
        remarks: input.remarks,
        updated_by: userId,
      })
      .select()
      .single();

    if (historyError) throw new Error(historyError.message);
    return history;
  }

  async softDelete(id: string) {
    const { error } = await this.supabase
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
  }
}
