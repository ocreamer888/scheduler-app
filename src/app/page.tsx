'use client';

import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import axios from 'axios';
import CalendarView from './CalendarView';
import BookingForm from './BookingForm';
import Image from 'next/image';

interface GoogleUser {
  access_token: string;
}

interface GoogleProfile {
  name: string;
  email: string;
  picture?: string;
}

interface ScheduleData {
  busy: Array<{ start: string; end: string }>;
  eventType: { duration: number; buffer_time: number };
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>;
}

function Scheduler() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  // Nuevo estado para guardar toda la configuración de la BD
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setUser(tokenResponse);
      try {
        const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        setProfile(profileResponse.data);
        console.log("✅ Perfil de usuario cargado:", profileResponse.data);
      } catch (error) {
        console.error("Error al obtener el perfil del usuario:", error);
      }
    },
    onError: () => console.log('Login Failed'),
    scope: 'https://www.googleapis.com/auth/calendar',
  });

  const getBusyTimes = async () => {
    if (!user) {
      alert('Debes iniciar sesión primero');
      return;
    }
    try {
      // La llamada al backend ahora devuelve toda la configuración
      const response = await axios.post('/api/availability', {
        accessToken: user.access_token,
      });
      setScheduleData(response.data); // Guardamos toda la respuesta
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { details?: string } }; message?: string };
      const backendDetails = axiosError?.response?.data?.details || axiosError?.message || 'Error desconocido';
      console.error('Error al obtener los horarios desde nuestro backend:', axiosError?.response?.data || error);
      alert(`Hubo un error al consultar la disponibilidad: ${backendDetails}`);
    }
  };

  const createCalendarEvent = async (details: { name: string; email: string; notes: string }) => {
    if (!user || !selectedSlot || !profile || !scheduleData?.eventType) {
      alert("Error: Faltan datos para crear el evento.");
      return;
    }
    try {
      const response = await axios.post('/api/book', {
        accessToken: user.access_token,
        selectedSlot: selectedSlot,
        details: details,
        profile: profile,
        // Enviamos la duración dinámica que obtuvimos de la BD
        duration: scheduleData.eventType.duration,
      });

      console.log("✅ Respuesta de nuestro backend (/api/book):", response.data);
      setBookingConfirmed(true);

    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { details?: string } } };
      const errorDetails = axiosError?.response?.data?.details || 'Error desconocido';
      console.error(`Error al crear el evento via backend: ${errorDetails}`, axiosError?.response?.data);
      alert(`Hubo un error al crear el evento: ${errorDetails}`);
    }
  };

  const resetState = () => {
    setScheduleData(null); // Limpiamos el nuevo estado
    setSelectedSlot(null);
    setBookingConfirmed(false);
  };

  const handleSlotSelect = (slot: Date) => {
    console.log("Horario seleccionado en la página principal:", slot);
    setSelectedSlot(slot);
  };

  if (!user) {
    return (<div className="text-center bg-gray-700/80 backdrop-blur-lg shadow-lg p-12 rounded-3xl flex flex-col items-center justify-center">
      <Image src="/MedDeFi logotype for dark.svg" alt="MedDeFi" width={100} height={100} className="mb-8" />
      <h1 className="text-4xl font-bold text-white mb-4">Agenda una llamada</h1>
      <p className="text-lg text-gray-100 mb-8">Usa tu cuenta de Google para ver los horarios disponibles.</p>
      <button onClick={() => login()} className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 mb-4">Iniciar Sesión con Google</button>
      </div>);
  }

  return (
    <div className="text-center bg-gray-700/80 backdrop-blur-lg shadow-lg p-12 rounded-3xl flex flex-col items-center justify-center">
      
      {bookingConfirmed ? (
        <div className="text-center"><h2 className="text-2xl font-bold text-gray-100">¡Cita Agendada!</h2>
        <p className='text-gray-100 my-4'>Recibirás una confirmación por correo. </p>
        <button onClick={resetState} className="mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-700">Agendar otra cita</button>
        </div>
      ) : selectedSlot && scheduleData ? (
        <BookingForm selectedSlot={selectedSlot} onFormSubmit={createCalendarEvent} duration={scheduleData.eventType.duration} onCancel={() => setSelectedSlot(null)} />
      ) : scheduleData ? (
        <CalendarView 
          busyTimes={scheduleData.busy} 
          eventType={scheduleData.eventType}
          availability={scheduleData.availability}
          onSlotSelect={handleSlotSelect} 
        />
      ) : (
        <div className='flex flex-col items-center w-full'>
          <p className='text-gray-100 text-3xl font-semibold'>¡Sesión iniciada como {profile?.name}!</p>
          <p className='text-gray-100 my-4'>Haz clic para cargar tu disponibilidad</p>
          <button onClick={getBusyTimes} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-700">Cargar mis horarios disponibles</button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-50"><Scheduler /></main>
    </GoogleOAuthProvider>
  );
}