import { SupabaseClient } from '@supabase/supabase-js';

export async function generateAwbNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('generate_awb_number');

  if (error) {
    throw new Error(`Failed to generate AWB number: ${error.message}`);
  }

  return data as string;
}
