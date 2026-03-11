import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyApiKey } from '@/lib/apiKey';
import { logUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const startedAt = Date.now();
    const endpoint = req.nextUrl.pathname;
    try {
      const apiKey = req.headers.get('X-API-Key');
      if (!apiKey) {
        await logUsage({ apiKeyId: 'unknown', endpoint, method: 'DELETE', statusCode: 401, startedAt });
        return NextResponse.json({ error: 'API key required' }, { status: 401 });
      }
      const keyData = await verifyApiKey(apiKey);
      if (!keyData) {
        await logUsage({ apiKeyId: 'unknown', endpoint, method: 'DELETE', statusCode: 401, startedAt });
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      const supabase = getSupabaseAdmin();
      const { data: booking } = await supabase
        .from('bookings').select('*').eq('id', id).eq('api_key_id', keyData.id).single();
      if (!booking) {
        await logUsage({ apiKeyId: keyData.id, endpoint, method: 'DELETE', statusCode: 404, startedAt });
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const { data: settings } = await supabase.from('settings').select('google_refresh_token').single();
  
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: settings?.google_refresh_token });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
      await calendar.events.delete({ calendarId: 'primary', eventId: booking.google_calendar_event_id });
      await supabase.from('bookings').delete().eq('id', id);
  
      await logUsage({ apiKeyId: keyData.id, endpoint, method: 'DELETE', statusCode: 200, startedAt });
      return NextResponse.json({ success: true, message: 'Booking cancelled successfully' });
    } catch {
      await logUsage({ apiKeyId: 'unknown', endpoint, method: 'DELETE', statusCode: 500, startedAt });
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
    }
  }