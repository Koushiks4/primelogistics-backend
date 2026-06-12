import { SupabaseClient } from '@supabase/supabase-js';

export class LeadNotesService {
  constructor(private supabase: SupabaseClient) {}

  async list(leadId: string) {
    const { data, error } = await this.supabase
      .from('lead_notes')
      .select('*, profiles:created_by(full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async create(leadId: string, content: string, userId: string) {
    const { data, error } = await this.supabase
      .from('lead_notes')
      .insert({ lead_id: leadId, content, created_by: userId })
      .select('*, profiles:created_by(full_name)')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}
