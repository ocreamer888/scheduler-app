'use client';

import { useState, useMemo } from 'react';
import { 
  addDays, format, startOfDay, eachDayOfInterval, isEqual, parseISO, 
  areIntervalsOverlapping, addMinutes, getDay, setHours, setMinutes 
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Interfaces para tipado
interface BusySlot { 
  start: string; 
  end: string; 
}

interface EventType {
  duration: number;
  buffer_time: number;
}

interface Availability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface CalendarViewProps {
  busyTimes: BusySlot[];
  eventType: EventType;
  availability: Availability[];
  onSlotSelect: (slot: Date) => void;
}

export default function CalendarView({ busyTimes, eventType, availability, onSlotSelect }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const week = useMemo(() => eachDayOfInterval({
    start: startOfDay(new Date()),
    end: addDays(new Date(), 6),
  }), []);

  const availableSlots = useMemo(() => {
    if (!eventType || !availability) return [];

    const dayOfWeek = getDay(selectedDate);
    const dayAvailability = availability.find(a => a.day_of_week === dayOfWeek);

    if (!dayAvailability) return [];

    const busyIntervals = busyTimes.map(slot => ({
      start: toZonedTime(parseISO(slot.start), userTimeZone),
      end: addMinutes(toZonedTime(parseISO(slot.end), userTimeZone), eventType.buffer_time),
    }));

    const slots = [];
    const [startHour, startMinute] = dayAvailability.start_time.split(':').map(Number);
    const [endHour, endMinute] = dayAvailability.end_time.split(':').map(Number);

    let potentialSlot = setMinutes(setHours(startOfDay(selectedDate), startHour), startMinute);
    const endTime = setMinutes(setHours(startOfDay(selectedDate), endHour), endMinute);

    while (potentialSlot < endTime) {
      const slotEnd = addMinutes(potentialSlot, eventType.duration);
      if (slotEnd > endTime) break;

      const slotInterval = { start: potentialSlot, end: slotEnd };

      const isOverlapping = busyIntervals.some(busyInterval =>
        areIntervalsOverlapping(slotInterval, busyInterval, { inclusive: true })
      );

      if (!isOverlapping) {
        slots.push(new Date(potentialSlot));
      }
      
      potentialSlot = addMinutes(potentialSlot, eventType.duration);
    }
    return slots;
  }, [selectedDate, busyTimes, eventType, availability, userTimeZone]);

  return (
    <div className="w-full max-w-2xl mt-8">
      <h2 className="text-2xl font-bold text-center mb-4">Elige un día</h2>
      <div className="grid grid-cols-7 gap-2 mb-6">
        {week.map(day => (
          <button
            key={day.toString()}
            onClick={() => setSelectedDate(day)}
            className={`p-2 rounded-lg text-center ${
              isEqual(day, selectedDate)
                ? 'bg-blue-100/50 text-white'
                : 'bg-gray-900/20 hover:bg-blue-900/20'
            }`}
          >
            <p className="font-semibold">{format(day, 'E')}</p>
            <p className="text-sm">{format(day, 'd')}</p>
          </button>
        ))}
      </div>

      <h3 className="text-xl font-bold text-center mb-4">
        Horarios disponibles para {format(selectedDate, 'EEEE, d \'de\' MMMM')}
      </h3>
      <p className="text-center text-sm text-gray-100 mb-4">
        Zona horaria: {userTimeZone}
      </p>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {availableSlots.length > 0 ? (
          availableSlots.map(slot => (
            <button
              key={slot.toString()}
              onClick={() => onSlotSelect(slot)}
              className="p-3 bg-gray-500 text-gray-100 rounded-lg hover:bg-blue-500"
            >
              {format(slot, 'HH:mm')}
            </button>
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500">
            No hay horarios disponibles para este día.
          </p>
        )}
      </div>
    </div>
  );
}
