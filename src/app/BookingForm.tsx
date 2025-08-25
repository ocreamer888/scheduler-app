// src/app/BookingForm.tsx
'use client';

import { format } from 'date-fns';
import { FormEvent } from 'react';

interface BookingFormProps {
  selectedSlot: Date;
  onFormSubmit: (details: { name: string; email: string; notes: string }) => void;
  onCancel: () => void;
  duration: number; // <-- LÍNEA AÑADIDA
}

export default function BookingForm({ selectedSlot, onFormSubmit, onCancel, duration }: BookingFormProps) {
  
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const details = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      notes: formData.get('notes') as string,
    };
    onFormSubmit(details);
  };

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-2">Confirmar Cita</h2>
      {/* Mejora: Muestra la duración de la cita */}
      <p className="text-center text-gray-600 mb-6">
        Estás agendando una cita de <span className="font-semibold">{duration} minutos</span> para el <span className="font-semibold">{format(selectedSlot, "eeee d 'de' MMMM 'a las' HH:mm")}</span>
      </p>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">Nombre Completo</label>
          <input type="text" id="name" name="name" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-semibold mb-2">Correo Electrónico</label>
          <input type="email" id="email" name="email" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
        </div>
        <div className="mb-6">
          <label htmlFor="notes" className="block text-gray-700 font-semibold mb-2">Motivo de la llamada (Opcional)</label>
          <textarea id="notes" name="notes" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"></textarea>
        </div>
        <div className="flex justify-between items-center">
          <button type="button" onClick={onCancel} className="text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">Confirmar Cita</button>
        </div>
      </form>
    </div>
  );
}