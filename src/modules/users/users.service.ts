import { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../../types.js';

export class UsersService {
  constructor(private supabase: SupabaseClient) {}

  async list() {
    const { data, error } = await this.supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async invite(email: string, fullName: string, role: UserRole) {
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (authError) throw new Error(authError.message);
    return { id: authData.user.id, email, full_name: fullName, role };
  }

  async update(id: string, updates: { role?: UserRole; is_active?: boolean }) {
    const { data, error } = await this.supabase.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}
