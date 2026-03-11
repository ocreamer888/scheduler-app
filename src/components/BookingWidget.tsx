import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Mail, User, CheckCircle, Loader } from 'lucide-react';

type BusySlot = { start: string; end: string };
type EventType = { duration: number; buffer_time?: number };
type AvailabilityWindow = { day_of_week: number; start_time: string; end_time: string };
type AvailabilityResponse = {
  busySlots: BusySlot[];
  eventType: EventType;
  availability: AvailabilityWindow[];
  startDate: string;
  endDate: string;
  timezone: string;
};

type BookingComplete = {
  startTime: string;
  meetLink?: string;
};

function getDateKeyTz(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date); // YYYY-MM-DD
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aEnd > bStart && aStart < bEnd;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

// Create a Date representing the instant when the local clock in `timeZone` shows `dateKey` + `hm`
function makeZonedDate(dateKey: string, hm: string, timeZone: string) {
  const [h, m] = hm.split(':').map(Number);
  const local = new Date(`${dateKey}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  const tzAsLocal = new Date(
    local.toLocaleString('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  );
  const diff = local.getTime() - tzAsLocal.getTime();
  return new Date(local.getTime() + diff);
}

function computeAvailableSlots(data: AvailabilityResponse) {
  const tz = data.timezone || 'UTC';
  const duration = data.eventType.duration;
  const buffer = data.eventType.buffer_time ?? 0;

  const blocked: Array<{ start: Date; end: Date }> = (data.busySlots || []).map(b => ({
    start: addMinutes(new Date(b.start), -buffer),
    end: addMinutes(new Date(b.end), buffer),
  }));

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  const days: Array<{ dateKey: string; date: Date; slots: Date[] }> = [];
  const seenKeys = new Set<string>();
  const now = new Date();

  // Iterate by UTC days; derive keys and weekday in target tz
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateKey = getDateKeyTz(d, tz);
    if (seenKeys.has(dateKey)) continue;
    seenKeys.add(dateKey);

    const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
    const weekdayIndexMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const jsDow = weekdayIndexMap[weekdayShort];

    const matchingWindows = (data.availability || []).filter(w => {
      const wDow = w.day_of_week;
      return wDow === jsDow || wDow === (jsDow === 0 ? 7 : jsDow); // support 0..6 or 1..7
    });

    const daySlots: Date[] = [];

    for (const win of matchingWindows) {
      const winStart = makeZonedDate(dateKey, win.start_time, tz);
      const winEnd = makeZonedDate(dateKey, win.end_time, tz);

      for (let s = new Date(winStart); addMinutes(s, duration) <= winEnd; s = addMinutes(s, duration)) {
        const e = addMinutes(s, duration);
        if (e <= now) continue;
        const isBlocked = blocked.some(b => overlaps(s, e, b.start, b.end));
        if (!isBlocked) daySlots.push(new Date(s));
      }
    }

    if (daySlots.length > 0) {
      const displayDate = makeZonedDate(dateKey, '12:00', tz);
      days.push({ dateKey, date: displayDate, slots: daySlots });
    }
  }

  return days;
}

export default function BookingWidget() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [bookingComplete, setBookingComplete] = useState<BookingComplete | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    notes: ''
  });

  const API_BASE = '/api/public';

  const slotsByDay = useMemo(
    () => (availability ? computeAvailableSlots(availability) : []),
    [availability]
  );

  useEffect(() => {
    if (step === 1) {
      fetchAvailability();
    }
  }, [step]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const startDate = new Date().toISOString();
      const response = await fetch(
        `${API_BASE}/availability?startDate=${startDate}&days=7&timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        setAvailability(result.data);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      alert('Failed to load availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createBooking = async () => {
    if (!formData.name || !formData.email || !selectedSlot || !availability) {
      alert('Please select a time and fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: selectedSlot.toISOString(),
          duration: availability.eventType.duration,
          guestName: formData.name,
          guestEmail: formData.email,
          notes: formData.notes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const result = await response.json();

      if (result.success) {
        setBookingComplete(result.data);
        setStep(3);
      } else {
        alert('Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading && !availability) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading available times...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Schedule a Meeting</h1>
            <p className="text-indigo-100">Book a 30-minute consultation</p>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  1
                </div>
                <div className={`w-20 h-1 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
                <div className={`w-20 h-1 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  3
                </div>
              </div>
            </div>

            {step === 1 && availability && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Select a Time</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {slotsByDay.slice(0, 4).map((day) => (
                    <div 
                      key={day.dateKey}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                        selectedDate === day.dateKey 
                          ? 'border-indigo-600 bg-indigo-50' 
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                      onClick={() => setSelectedDate(day.dateKey)}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <span className="font-semibold text-gray-800">
                          {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {day.slots.length} slots available
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDate && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Times</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {slotsByDay
                        .find(d => d.dateKey === selectedDate)?.slots.slice(0, 9).map((slot) => (
                          <button
                            key={slot.toISOString()}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep(2);
                            }}
                            className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition"
                          >
                            {formatTime(slot)}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && availability && selectedSlot && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Enter Your Details</h2>
                
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-indigo-800 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Selected Time</span>
                  </div>
                  <p className="text-indigo-700">
                    {formatDate(selectedSlot)} at {formatTime(selectedSlot)}
                  </p>
                  <p className="text-sm text-indigo-600 mt-1">
                    Duration: {availability.eventType.duration} minutes
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="What would you like to discuss?"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={createBooking}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && bookingComplete && availability && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Booking Confirmed!</h2>
                <p className="text-gray-600 mb-8">
                  Your meeting has been scheduled successfully
                </p>

                <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left max-w-md mx-auto">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Date & Time</p>
                      <p className="font-semibold text-gray-800">
                        {formatDate(new Date(bookingComplete.startTime))} at {formatTime(new Date(bookingComplete.startTime))}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Duration</p>
                      <p className="font-semibold text-gray-800">
                        {availability.eventType.duration} minutes
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Guest</p>
                      <p className="font-semibold text-gray-800">{formData.name}</p>
                      <p className="text-sm text-gray-600">{formData.email}</p>
                    </div>

                    {bookingComplete.meetLink && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Google Meet Link</p>
                        <a
                          href={bookingComplete.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Join Meeting
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                  <p className="text-sm text-blue-800">
                    📧 A confirmation email has been sent to <strong>{formData.email}</strong> with all the meeting details and a link to manage your booking.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedDate(null);
                    setSelectedSlot(null);
                    setFormData({ name: '', email: '', notes: '' });
                    setBookingComplete(null);
                    fetchAvailability();
                  }}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
                >
                  Schedule Another Meeting
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Integration Code</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm">
{`// Example: Using the Scheduler API

const API_KEY = 'sk_your_api_key_here';
const API_BASE = 'https://your-domain.com/api/v1';

// 1. Get availability
const response = await fetch(
  \`\${API_BASE}/availability?startDate=\${new Date().toISOString()}&days=7\`,
  { headers: { 'X-API-Key': API_KEY } }
);
const { data } = await response.json();

// 2. Create booking
const booking = await fetch(\`\${API_BASE}/bookings\`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    startTime: '2025-10-15T14:00:00Z',
    duration: 30,
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    notes: 'Project discussion'
  })
});

const result = await booking.json();
console.log('Meet Link:', result.data.meetLink);`}
            </pre>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-xl font-semibold mb-3">🎉 Easy Integration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl mb-2">🔑</div>
              <h4 className="font-semibold mb-1">Secure API Keys</h4>
              <p className="text-sm text-indigo-100">
                Generate and manage API keys with fine-grained access control
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold mb-1">Real-time Sync</h4>
              <p className="text-sm text-indigo-100">
                Automatically syncs with Google Calendar and sends confirmation emails
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl mb-2">🌍</div>
              <h4 className="font-semibold mb-1">Timezone Aware</h4>
              <p className="text-sm text-indigo-100">
                Handles timezones automatically for global scheduling
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}