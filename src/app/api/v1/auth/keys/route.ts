// src/app/api/v1/auth/keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

interface ApiKeyRow {
  id: string;
  app_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number | null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makePreview(id: string) {
  const clean = id.replace(/-/g, '');
  return `sk_${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get('X-Admin-Secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, app_name, description, is_active, created_at, last_used_at, usage_count')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load keys' }, { status: 500 });

  const keys = (data || []).map((k: ApiKeyRow) => ({
    id: k.id,
    app_name: k.app_name,
    description: k.description,
    key_preview: makePreview(k.id),
    is_active: k.is_active,
    created_at: k.created_at,
    last_used_at: k.last_used_at,
    usage_count: k.usage_count ?? 0,
  }));

  return NextResponse.json({ keys });
}