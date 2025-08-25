// src/app/api/availability/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { addDays, formatISO } from 'date-fns';
// 1. Import the correct function name
import { getSupabaseAdmin } from '@/lib/supabaseServer'; 

export async function POST(request: Request) {
  try {
    // 2. Call the function to get the Supabase client
    const supabaseAdmin = getSupabaseAdmin();

    const { accessToken } = await request.json();
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }
    
    const { data: eventTypeData, error: eventTypeError } = await supabaseAdmin
      .from('event_types')
      .select('*')
      .limit(1)
      .single();

    if (eventTypeError) throw new Error(eventTypeError.message);

    const { data: availabilityData, error: availabilityError } = await supabaseAdmin
      .from('availabilities')
      .select('*');
    
    if (availabilityError) throw new Error(availabilityError.message);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const today = new Date();
    const sevenDaysLater = addDays(today, 7);

    const googleResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: formatISO(today),
        timeMax: formatISO(sevenDaysLater),
        items: [{ id: 'primary' }],
      },
    });
    
    const busySlots = googleResponse.data.calendars?.primary?.busy || [];

    return NextResponse.json({ 
      busy: busySlots,
      eventType: eventTypeData,
      availability: availabilityData
    });

  } catch (error: any) {
    console.error('Error en /api/availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability', details: error.message }, { status: 500 });
  }
}