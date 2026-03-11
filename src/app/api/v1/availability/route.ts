import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { google } from 'googleapis';
import { addDays } from 'date-fns';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyApiKey } from '@/lib/apiKey';
import { logUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(31).optional().default(7),
  timezone: z.string().optional().default('UTC')
});

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const endpoint = req.nextUrl.pathname;
  try {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const parsed = QuerySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      days: searchParams.get('days') ?? undefined,
      timezone: searchParams.get('timezone') ?? undefined
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const { startDate, days, timezone } = parsed.data;

    const supabase = getSupabaseAdmin();

    const [eventTypeResult, availabilityResult, settingsResult] = await Promise.all([
      supabase.from('event_types').select('*').single(),
      supabase.from('availabilities').select('*'),
      supabase.from('settings').select('google_refresh_token').single()
    ]);

    if (eventTypeResult.error) throw eventTypeResult.error;
    if (availabilityResult.error) throw availabilityResult.error;

    const refreshToken = settingsResult.data?.google_refresh_token;
    if (!refreshToken) {
      return NextResponse.json({ error: 'Calendar not configured' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const timeMin = startDate ? new Date(startDate) : new Date();
    const timeMax = addDays(timeMin, days);

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }]
      }
    });

    const busySlots = freeBusyResponse.data.calendars?.primary?.busy || [];

    const res = NextResponse.json({
      success: true,
      data: {
        busySlots,
        eventType: eventTypeResult.data,
        availability: availabilityResult.data,
        timezone,
        startDate: timeMin.toISOString(),
        endDate: timeMax.toISOString()
      }
    });
    logUsage({ apiKeyId: keyData.id, endpoint, method: 'GET', statusCode: 200, startedAt });
    return res;
  } catch {
    logUsage({ apiKeyId: 'unknown', endpoint, method: 'GET', statusCode: 500, startedAt });
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}