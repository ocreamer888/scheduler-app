import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { generateSecretKey, hashKey } from '@/lib/apiKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  adminSecret: z.string().min(1),
  appName: z.string().min(1).max(128),
  description: z.string().max(512).optional()
});

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, appName, description } = BodySchema.parse(await req.json());

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = generateSecretKey();
    const keyHash = hashKey(apiKey);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        key_hash: keyHash,
        app_name: appName,
        description: description ?? null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      apiKey,
      keyId: data.id,
      appName: data.app_name,
      createdAt: data.created_at
    });
  } catch (err: unknown) {
    const isZod = err instanceof Error && 'issues' in err && Array.isArray((err as { issues?: unknown[] }).issues);
    return NextResponse.json(
      { error: isZod ? 'Invalid request body' : 'Failed to generate API key' },
      { status: isZod ? 400 : 500 }
    );
  }
}