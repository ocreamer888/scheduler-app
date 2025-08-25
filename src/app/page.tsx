'use client';

import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
import { useState } from 'react';
import axios from 'axios';
import CalendarView from './CalendarView';
import BookingForm from './BookingForm';

function Scheduler() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  // Nuevo estado para guardar toda la configuración de la BD
  const [scheduleData, setScheduleData] = useState<any>(null);
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

  const logout = () => {
    googleLogout();
    setUser(null);
    setProfile(null);
    setScheduleData(null); // Limpiamos el nuevo estado
    setSelectedSlot(null);
    setBookingConfirmed(false);
  };

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
    } catch (error: any) {
      const backendDetails = error?.response?.data?.details || error?.message || 'Error desconocido';
      console.error('Error al obtener los horarios desde nuestro backend:', error?.response?.data || error);
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

    } catch (error: any) {
      const errorDetails = error.response?.data?.details || 'Error desconocido';
      console.error(`Error al crear el evento via backend: ${errorDetails}`, error.response?.data);
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
    return (<div className="text-center"><h1 className="text-4xl font-bold text-gray-800 mb-4">Agenda una llamada</h1><p className="text-lg text-gray-600 mb-8">Usa tu cuenta de Google para ver los horarios disponibles.</p><button onClick={() => login()} className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">Iniciar Sesión con Google</button></div>);
  }

  return (
    <div className="text-center w-full relative">
      <div className="absolute top-0 right-0 flex items-center space-x-2">
        <p className="text-xs text-gray-500 hidden sm:block">{profile?.email}</p>
        <button onClick={logout} className="text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-200 px-3 py-1 rounded-md">Cerrar Sesión</button>
      </div>
      
      {bookingConfirmed ? (
        <div className="text-center"><h2 className="text-2xl font-bold text-green-600">¡Cita Agendada!</h2><p>Tú y tu invitado recibirán una confirmación por correo.</p><button onClick={resetState} className="mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">Agendar otra cita</button></div>
      ) : selectedSlot ? (
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
          <p className='text-green-600 font-semibold'>¡Sesión iniciada como {profile?.name}!</p>
          <p className='text-gray-600 my-4'>Haz clic para cargar tu disponibilidad</p>
          <button onClick={getBusyTimes} className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-700">Cargar mis horarios disponibles</button>
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