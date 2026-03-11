// src/lib/usage.ts
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function logUsage(opts: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  startedAt: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('api_usage_logs').insert({
      api_key_id: opts.apiKeyId,
      endpoint: opts.endpoint,
      method: opts.method,
      status_code: opts.statusCode,
      response_time_ms: Date.now() - opts.startedAt,
    });
  } catch {
    // best-effort; do not throw
  }
}