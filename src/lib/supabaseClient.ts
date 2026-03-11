'use client';
// src/lib/supabaseClient.ts
// Reserved for future client-side use: realtime subscriptions, RLS-backed reads, or Supabase Auth.
// Normal data access goes through API routes using getSupabaseAdmin() (service role).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);