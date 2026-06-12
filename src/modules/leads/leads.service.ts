import { SupabaseClient } from '@supabase/supabase-js';
import type { CreateLeadInput, UpdateLeadInput, ListLeadsQuery } from './leads.schema.js';

export class LeadsService {
  constructor(private supabase: SupabaseClient) {}

  async list(query: ListLeadsQuery) {
    const { page, limit, source, status, from_date, to_date } = query;
    const offset = (page - 1) * limit;
    let q = this.supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (source) q = q.eq('source', source);
    if (status) q = q.eq('status', status);
    if (from_date) q = q.gte('created_at', from_date);
    if (to_date) q = q.lte('created_at', to_date);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.from('leads').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  async create(input: CreateLeadInput) {
    const { data, error } = await this.supabase.from('leads').insert({ ...input, status: 'new' }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, input: UpdateLeadInput) {
    const { data, error } = await this.supabase.from('leads').update(input).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listGroupedByEmail() {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .not('email', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const grouped: Record<string, typeof rows> = {};
    const ungrouped: typeof rows = [];

    for (const lead of rows) {
      if (lead.email) {
        if (!grouped[lead.email]) grouped[lead.email] = [];
        grouped[lead.email].push(lead);
      } else {
        ungrouped.push(lead);
      }
    }

    const result = Object.entries(grouped)
      .filter(([, leads]) => leads.length > 1)
      .map(([email, leads]) => ({
        email,
        name: leads[0].name,
        phone: leads[0].phone,
        count: leads.length,
        latestStatus: leads[0].status,
        latestDate: leads[0].created_at,
        leads,
      }))
      .sort((a, b) => b.count - a.count);

    const singles = Object.entries(grouped)
      .filter(([, leads]) => leads.length === 1)
      .map(([, leads]) => leads[0]);

    return { grouped: result, singles: [...singles, ...ungrouped] };
  }

  async delete(id: string) {
    const { error } = await this.supabase.from('leads').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
