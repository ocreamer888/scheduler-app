import { createHash, randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export function hashKey(k: string) {
  return createHash('sha256').update(k).digest('hex');
}

export function generateSecretKey() {
  return `sk_${randomBytes(32).toString('hex')}`;
}

export async function verifyApiKey(apiKey: string) {
  const supabase = getSupabaseAdmin();
  const keyHash = hashKey(apiKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}