// src/app/api/book/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { formatISO, addMinutes, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Resend } from 'resend';
import { EmailTemplate } from '@/components/EmailTemplate';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import * as React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { accessToken, selectedSlot, details, profile, duration } = await request.json();

    if (!accessToken || !selectedSlot || !details || !profile || !duration) {
      return NextResponse.json({ error: 'Faltan datos para crear el evento' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const eventStartTime = new Date(selectedSlot);
    const eventEndTime = addMinutes(eventStartTime, duration);

    const event = {
      summary: `Llamada con ${details.name}`,
      description: details.notes || 'Llamada agendada desde el sitio web.',
      start: { dateTime: formatISO(eventStartTime), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: formatISO(eventEndTime), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      organizer: { email: profile.email },
      attendees: [{ email: details.email }],
      conferenceData: { createRequest: { requestId: `meet-${Date.now()}` } },
    };

    const calendarResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendNotifications: true,
    });

    const googleCalendarEventId = calendarResponse.data.id;
    const googleMeetLink = calendarResponse.data.hangoutLink;

    if (!googleCalendarEventId || !googleMeetLink) {
      throw new Error("El evento se creó en Google, pero no se obtuvieron todos los detalles necesarios.");
    }

    // Guardamos la cita en la BD y recuperamos la fila creada con .select().single()
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        guest_name: details.name,
        guest_email: details.email,
        start_time: formatISO(eventStartTime),
        google_calendar_event_id: googleCalendarEventId,
      })
      .select()
      .single();

    if (bookingError || !bookingData) {
      await calendar.events.delete({ calendarId: 'primary', eventId: googleCalendarEventId });
      throw new Error(`Error al guardar en la base de datos: ${bookingError?.message}`);
    }

    // Construimos el enlace de cancelación único
    const cancellationLink = `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${bookingData.cancellation_id}`;
    
    // Enviamos el correo de confirmación personalizado con el nuevo enlace
    try {
      const formattedMeetingTime = format(eventStartTime, "eeee, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
      await resend.emails.send({
        from: 'MedDeFi <onboarding@resend.dev>',
        to: [details.email],
        subject: `Cita confirmada: Llamada con ${profile.name}`,
        react: React.createElement(EmailTemplate, {
          guestName: details.name,
          meetingTime: formattedMeetingTime,
          googleMeetLink: googleMeetLink,
          cancellationLink: cancellationLink,
        }),
      });
    } catch (emailError) {
      console.error("Error al enviar correo de confirmación:", emailError);
    }

    return NextResponse.json({ message: 'Evento creado y guardado', data: calendarResponse.data });

  } catch (error: any) {
    console.error('Error en /api/book:', error);
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  }
}