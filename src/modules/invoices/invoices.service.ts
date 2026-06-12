import { SupabaseClient } from '@supabase/supabase-js';
import type { CreateInvoiceInput, UpdateInvoiceInput, ListInvoicesQuery } from './invoices.schema.js';

export class InvoicesService {
  constructor(private supabase: SupabaseClient) {}

  async list(query: ListInvoicesQuery) {
    const { page, limit, status, from_date, to_date } = query;
    const offset = (page - 1) * limit;
    let q = this.supabase.from('invoices').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (status) q = q.eq('status', status);
    if (from_date) q = q.gte('invoice_date', from_date);
    if (to_date) q = q.lte('invoice_date', to_date);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.from('invoices').select('*, invoice_items(*)').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  async create(input: CreateInvoiceInput, userId: string) {
    const { items, ...invoiceData } = input;
    const { data: invoiceNumber, error: rpcError } = await this.supabase.rpc('generate_invoice_number');
    if (rpcError) throw new Error(rpcError.message);

    const { data: invoice, error: invoiceError } = await this.supabase
      .from('invoices').insert({ ...invoiceData, invoice_number: invoiceNumber, status: 'draft', created_by: userId }).select().single();
    if (invoiceError) throw new Error(invoiceError.message);

    const itemsWithId = items.map((item) => ({ ...item, invoice_id: invoice.id }));
    const { error: itemsError } = await this.supabase.from('invoice_items').insert(itemsWithId);
    if (itemsError) throw new Error(itemsError.message);

    return this.getById(invoice.id);
  }

  async update(id: string, input: UpdateInvoiceInput) {
    const { data, error } = await this.supabase.from('invoices').update(input).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async addItem(invoiceId: string, item: { description: string; quantity: number; unit_price: number; amount: number }) {
    const { data, error } = await this.supabase.from('invoice_items').insert({ ...item, invoice_id: invoiceId }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.from('invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
