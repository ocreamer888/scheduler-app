// src/app/api/v1/auth/keys/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  app_name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).nullable().optional(),
});

function unauthorized(req: NextRequest) {
  const adminSecret = req.headers.get('X-Admin-Secret');
  return !adminSecret || adminSecret !== process.env.ADMIN_SECRET;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (unauthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('api_keys')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update key' }, { status: 500 });
  return NextResponse.json({ key: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (unauthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('api_keys').delete().eq('id', id);

  if (error) {
    // 23503 = foreign_key_violation
    const pgError = error as { code?: string };
    const status = pgError.code === '23503' ? 409 : 500;
    const message = pgError.code === '23503'
      ? 'Cannot delete key with dependent records. Deactivate it instead.'
      : 'Failed to delete key';
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ success: true });
}