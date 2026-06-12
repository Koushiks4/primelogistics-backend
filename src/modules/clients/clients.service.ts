import { SupabaseClient } from '@supabase/supabase-js';
import type { CreateClientInput, UpdateClientInput, ListClientsQuery } from './clients.schema.js';

export class ClientsService {
  constructor(private supabase: SupabaseClient) {}

  async list(query: ListClientsQuery) {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;
    let q = this.supabase.from('clients').select('*', { count: 'exact' }).order('name', { ascending: true }).range(offset, offset + limit - 1);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.from('clients').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  async create(input: CreateClientInput, userId: string) {
    const { data, error } = await this.supabase.from('clients').insert({ ...input, created_by: userId }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, input: UpdateClientInput) {
    const { data, error } = await this.supabase.from('clients').update(input).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
