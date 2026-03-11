// src/app/api/v1/auth/generate-key/route.ts
// Generate API keys for external apps
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { adminSecret, appName, description } = await req.json();

    // Verify admin secret (set this in your env vars)
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Store in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        key_hash: hashedKey,
        app_name: appName,
        description: description,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      apiKey, // Only shown once!
      keyId: data.id,
      appName: data.app_name,
      createdAt: data.created_at
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}

// src/app/api/v1/availability/route.ts
// Public endpoint to get available time slots
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { addDays, startOfDay, endOfDay } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to verify API key
async function verifyApiKey(apiKey: string) {
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hashedKey)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  
  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

export async function GET(req: NextRequest) {
  try {
    // Verify API key from header
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date().toISOString();
    const days = parseInt(searchParams.get('days') || '7');
    const timezone = searchParams.get('timezone') || 'UTC';

    // Get event types and availability from database
    const [eventTypeResult, availabilityResult] = await Promise.all([
      supabase.from('event_types').select('*').single(),
      supabase.from('availabilities').select('*')
    ]);

    if (eventTypeResult.error) throw eventTypeResult.error;
    if (availabilityResult.error) throw availabilityResult.error;

    // Get host's Google Calendar access token from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('google_refresh_token')
      .single();

    if (!settings?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Calendar not configured' },
        { status: 500 }
      );
    }

    // Get fresh access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: settings.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Query FreeBusy
    const timeMin = new Date(startDate);
    const timeMax = addDays(timeMin, days);

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }]
      }
    });

    const busySlots = freeBusyResponse.data.calendars?.primary?.busy || [];

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

// src/app/api/v1/bookings/route.ts
// Create a booking via API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { Resend } from 'resend';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function verifyApiKey(apiKey: string) {
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hashedKey)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

export async function POST(req: NextRequest) {
  try {
    // Verify API key
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const {
      startTime,
      duration,
      guestName,
      guestEmail,
      notes,
      timezone = 'UTC'
    } = body;

    // Validate required fields
    if (!startTime || !duration || !guestName || !guestEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: startTime, duration, guestName, guestEmail' },
        { status: 400 }
      );
    }

    // Get host settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Calendar not configured' },
        { status: 500 }
      );
    }

    // Setup Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: settings.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calculate end time
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // Create calendar event
    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Meeting with ${guestName}`,
        description: notes || 'Scheduled via API',
        start: {
          dateTime: start.toISOString(),
          timeZone: timezone
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: timezone
        },
        attendees: [
          { email: guestEmail, displayName: guestName },
          { email: settings.host_email }
        ],
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      }
    });

    // Store booking in database
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        guest_name: guestName,
        guest_email: guestEmail,
        start_time: start.toISOString(),
        google_calendar_event_id: event.data.id,
        notes: notes || null,
        api_key_id: keyData.id // Track which API key created this
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Send confirmation email
    const meetLink = event.data.hangoutLink || 'N/A';
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
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

// Get booking details
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const bookingId = searchParams.get('id');

    if (bookingId) {
      // Get specific booking
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    } else {
      // Get all bookings for this API key
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('api_key_id', keyData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// src/app/api/v1/bookings/[id]/route.ts
// Cancel or update a specific booking
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyApiKey(apiKey: string) {
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hashedKey)
    .eq('is_active', true)
    .single();
  return data;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyData = await verifyApiKey(apiKey);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Get settings for Google auth
    const { data: settings } = await supabase
      .from('settings')
      .select('google_refresh_token')
      .single();

    // Delete from Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: settings.google_refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: booking.google_calendar_event_id
    });

    // Delete from database
    await supabase
      .from('bookings')
      .delete()
      .eq('id', params.id);

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}