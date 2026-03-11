import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { google } from 'googleapis';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyApiKey } from '@/lib/apiKey';
import { randomUUID } from 'crypto';
import { logUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

const CreateSchema = z.object({
  startTime: z.string().datetime(),
  duration: z.number().int().min(5).max(240),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  notes: z.string().max(1000).optional(),
  timezone: z.string().optional().default('UTC')
});

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const endpoint = req.nextUrl.pathname;
  try {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      await logUsage({ apiKeyId: 'unknown', endpoint, method: 'POST', statusCode: 401, startedAt });
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }
    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      await logUsage({ apiKeyId: 'unknown', endpoint, method: 'POST', statusCode: 401, startedAt });
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { startTime, duration, guestName, guestEmail, notes, timezone } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: settings } = await supabase.from('settings').select('*').single();
    if (!settings?.google_refresh_token) {
      return NextResponse.json({ error: 'Calendar not configured' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: settings.google_refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Meeting with ${guestName}`,
        description: notes || 'Scheduled via API',
        start: { dateTime: start.toISOString(), timeZone: timezone },
        end: { dateTime: end.toISOString(), timeZone: timezone },
        attendees: [
          { email: guestEmail, displayName: guestName },
          { email: settings.host_email }
        ],
        conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
      }
    });

    const meetLink = event.data.hangoutLink || 'N/A';

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        guest_name: guestName,
        guest_email: guestEmail,
        start_time: start.toISOString(),
        google_calendar_event_id: event.data.id,
        notes: notes || null,
        api_key_id: keyData.id
      })
      .select()
      .single();

    if (bookingError || !booking) throw bookingError;

    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${booking.cancellation_id}`;

    try {
      await resend.emails.send({
        from: settings.email_from || 'noreply@yourdomain.com',
        to: guestEmail,
        subject: `Meeting Confirmed: ${start.toLocaleDateString()}`,
        html: `
          <h2>Your meeting has been confirmed!</h2>
          <p><strong>Date:</strong> ${start.toLocaleString()}</p>
          <p><strong>Duration:</strong> ${duration} minutes</p>
          <p><strong>Google Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          <hr />
          <p><a href="${cancelUrl}">Cancel or reschedule this meeting</a></p>
        `
      });
    } catch {}

    const res = NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        eventId: event.data.id,
        meetLink,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        cancellationId: booking.cancellation_id
      }
    });
    await logUsage({ apiKeyId: keyData.id, endpoint, method: 'POST', statusCode: 200, startedAt });
    return res;
  } catch {
    await logUsage({ apiKeyId: 'unknown', endpoint, method: 'POST', statusCode: 500, startedAt });
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const endpoint = req.nextUrl.pathname;
  try {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      await logUsage({ apiKeyId: 'unknown', endpoint, method: 'GET', statusCode: 401, startedAt });
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }
    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      await logUsage({ apiKeyId: 'unknown', endpoint, method: 'GET', statusCode: 401, startedAt });
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const { data, error } = await supabase
        .from('bookings').select('*').eq('id', id).eq('api_key_id', keyData.id).single();
      if (error || !data) {
        await logUsage({ apiKeyId: keyData.id, endpoint, method: 'GET', statusCode: 404, startedAt });
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const res = NextResponse.json({ success: true, data });
      await logUsage({ apiKeyId: keyData.id, endpoint, method: 'GET', statusCode: 200, startedAt });
      return res;
    }

    const { data, error } = await supabase
      .from('bookings').select('*').eq('api_key_id', keyData.id).order('created_at', { ascending: false });
    if (error) throw error;

    const res = NextResponse.json({ success: true, data });
    await logUsage({ apiKeyId: keyData.id, endpoint, method: 'GET', statusCode: 200, startedAt });
    return res;
  } catch {
    await logUsage({ apiKeyId: 'unknown', endpoint, method: 'GET', statusCode: 500, startedAt });
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}