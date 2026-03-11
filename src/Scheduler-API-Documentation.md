# Scheduler API Documentation

## Overview

This API allows you to integrate the scheduler functionality into your own applications and websites. All endpoints require an API key for authentication.

**Base URL**: `https://your-domain.com/api/v1`

---

## Authentication

All API requests must include your API key in the header:

```
X-API-Key: sk_your_api_key_here
```

### Generate an API Key

**Endpoint**: `POST /api/v1/auth/generate-key`

**Body**:
```json
{
  "adminSecret": "your_admin_secret",
  "appName": "My Website",
  "description": "API key for website integration"
}
```

**Response**:
```json
{
  "apiKey": "sk_abc123...",
  "keyId": "uuid",
  "appName": "My Website",
  "createdAt": "2025-10-01T12:00:00Z"
}
```

⚠️ **Important**: Save the `apiKey` - it's only shown once!

---

## Endpoints

### 1. Get Availability

Get available time slots for booking.

**Endpoint**: `GET /api/v1/availability`

**Headers**:
```
X-API-Key: sk_your_api_key_here
```

**Query Parameters**:
- `startDate` (optional): ISO 8601 date string. Default: current date
- `days` (optional): Number of days to check. Default: 7
- `timezone` (optional): IANA timezone. Default: UTC

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/availability?startDate=2025-10-01&days=7&timezone=America/New_York" \
  -H "X-API-Key: sk_your_api_key_here"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "busySlots": [
      {
        "start": "2025-10-01T14:00:00Z",
        "end": "2025-10-01T15:00:00Z"
      }
    ],
    "eventType": {
      "id": "uuid",
      "duration": 30,
      "buffer_time": 10
    },
    "availability": [
      {
        "day_of_week": 1,
        "start_time": "09:00",
        "end_time": "17:00"
      }
    ],
    "timezone": "America/New_York",
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-08T00:00:00Z"
  }
}
```

---

### 2. Create a Booking

Book a meeting slot.

**Endpoint**: `POST /api/v1/bookings`

**Headers**:
```
X-API-Key: sk_your_api_key_here
Content-Type: application/json
```

**Body**:
```json
{
  "startTime": "2025-10-01T14:00:00Z",
  "duration": 30,
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "notes": "Discussion about project proposal",
  "timezone": "America/New_York"
}
```

**Required Fields**:
- `startTime`: ISO 8601 datetime
- `duration`: Meeting duration in minutes
- `guestName`: Guest's full name
- `guestEmail`: Guest's email address

**Optional Fields**:
- `notes`: Additional information
- `timezone`: IANA timezone (default: UTC)

**Example Request**:
```bash
curl -X POST "https://your-domain.com/api/v1/bookings" \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2025-10-01T14:00:00Z",
    "duration": 30,
    "guestName": "John Doe",
    "guestEmail": "john@example.com",
    "notes": "Project discussion",
    "timezone": "America/New_York"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bookingId": "uuid",
    "eventId": "google_calendar_event_id",
    "meetLink": "https://meet.google.com/xxx-yyyy-zzz",
    "startTime": "2025-10-01T14:00:00Z",
    "endTime": "2025-10-01T14:30:00Z",
    "cancellationId": "uuid"
  }
}
```

---

### 3. Get Bookings

Retrieve booking information.

**Endpoint**: `GET /api/v1/bookings`

**Headers**:
```
X-API-Key: sk_your_api_key_here
```

**Query Parameters**:
- `id` (optional): Specific booking ID

**Example Request (All Bookings)**:
```bash
curl -X GET "https://your-domain.com/api/v1/bookings" \
  -H "X-API-Key: sk_your_api_key_here"
```

**Example Request (Specific Booking)**:
```bash
curl -X GET "https://your-domain.com/api/v1/bookings?id=uuid" \
  -H "X-API-Key: sk_your_api_key_here"
```

**Response (All Bookings)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "guest_name": "John Doe",
      "guest_email": "john@example.com",
      "start_time": "2025-10-01T14:00:00Z",
      "google_calendar_event_id": "event_id",
      "cancellation_id": "uuid",
      "notes": "Project discussion",
      "created_at": "2025-10-01T12:00:00Z"
    }
  ]
}
```

---

### 4. Cancel a Booking

Delete a scheduled booking.

**Endpoint**: `DELETE /api/v1/bookings/{bookingId}`

**Headers**:
```
X-API-Key: sk_your_api_key_here
```

**Example Request**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/bookings/uuid" \
  -H "X-API-Key: sk_your_api_key_here"
```

**Response**:
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes**:
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (invalid or missing API key)
- `404` - Not Found (booking doesn't exist)
- `500` - Internal Server Error

---

## Rate Limiting

- **Not currently implemented** - Consider adding rate limiting based on your needs
- Suggested: 100 requests per hour per API key

---

## Webhooks (Future Enhancement)

Consider implementing webhooks to notify your app when:
- A booking is created
- A booking is cancelled
- A booking is rescheduled

---

## Example Integration (JavaScript)

```javascript
class SchedulerAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getAvailability(startDate, days = 7, timezone = 'UTC') {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      days: days.toString(),
      timezone
    });

    const response = await fetch(
      `${this.baseUrl}/api/v1/availability?${params}`,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );

    return response.json();
  }

  async createBooking(bookingData) {
    const response = await fetch(`${this.baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });

    return response.json();
  }

  async getBookings(bookingId = null) {
    const url = bookingId
      ? `${this.baseUrl}/api/v1/bookings?id=${bookingId}`
      : `${this.baseUrl}/api/v1/bookings`;

    const response = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.json();
  }

  async cancelBooking(bookingId) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/bookings/${bookingId}`,
      {
        method: 'DELETE',
        headers: { 'X-API-Key': this.apiKey }
      }
    );

    return response.json();
  }
}

// Usage
const api = new SchedulerAPI('sk_your_api_key', 'https://your-domain.com');

// Get availability
const availability = await api.getAvailability(new Date(), 7, 'America/New_York');

// Create booking
const booking = await api.createBooking({
  startTime: '2025-10-01T14:00:00Z',
  duration: 30,
  guestName: 'John Doe',
  guestEmail: 'john@example.com',
  notes: 'Project discussion',
  timezone: 'America/New_York'
});

console.log('Booking created:', booking.data.meetLink);
```

---

## Example Integration (Python)

```python
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List

class SchedulerAPI:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'X-API-Key': api_key}
    
    def get_availability(
        self, 
        start_date: datetime, 
        days: int = 7, 
        timezone: str = 'UTC'
    ) -> Dict:
        """Get available time slots"""
        params = {
            'startDate': start_date.isoformat(),
            'days': str(days),
            'timezone': timezone
        }
        
        response = requests.get(
            f'{self.base_url}/api/v1/availability',
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def create_booking(
        self,
        start_time: datetime,
        duration: int,
        guest_name: str,
        guest_email: str,
        notes: Optional[str] = None,
        timezone: str = 'UTC'
    ) -> Dict:
        """Create a new booking"""
        data = {
            'startTime': start_time.isoformat(),
            'duration': duration,
            'guestName': guest_name,
            'guestEmail': guest_email,
            'timezone': timezone
        }
        
        if notes:
            data['notes'] = notes
        
        response = requests.post(
            f'{self.base_url}/api/v1/bookings',
            headers={**self.headers, 'Content-Type': 'application/json'},
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    def get_bookings(self, booking_id: Optional[str] = None) -> Dict:
        """Get all bookings or a specific booking"""
        url = f'{self.base_url}/api/v1/bookings'
        params = {'id': booking_id} if booking_id else {}
        
        response = requests.get(
            url,
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def cancel_booking(self, booking_id: str) -> Dict:
        """Cancel a booking"""
        response = requests.delete(
            f'{self.base_url}/api/v1/bookings/{booking_id}',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage example
api = SchedulerAPI('sk_your_api_key', 'https://your-domain.com')

# Get availability for next 7 days
availability = api.get_availability(
    start_date=datetime.now(),
    days=7,
    timezone='America/New_York'
)

# Create a booking
booking = api.create_booking(
    start_time=datetime(2025, 10, 1, 14, 0, 0),
    duration=30,
    guest_name='Jane Smith',
    guest_email='jane@example.com',
    notes='Initial consultation',
    timezone='America/New_York'
)

print(f"Booking created! Meet link: {booking['data']['meetLink']}")

# Get all bookings
all_bookings = api.get_bookings()
print(f"Total bookings: {len(all_bookings['data'])}")

# Cancel a booking
api.cancel_booking(booking['data']['bookingId'])
```

---

## Security Best Practices

1. **Store API Keys Securely**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys periodically

2. **Use HTTPS Only**
   - All API calls must be over HTTPS
   - Never send API keys over unsecured connections

3. **Validate Input**
   - Always validate dates and times
   - Check email format
   - Sanitize user input

4. **Monitor Usage**
   - Track API key usage in the `api_usage_logs` table
   - Set up alerts for unusual activity
   - Review logs regularly

5. **IP Whitelisting (Optional)**
   - Consider adding IP restrictions to API keys
   - Useful for server-to-server integrations

---

## Environment Variables

Add these to your `.env.local`:

```bash
# Admin secret for generating API keys
ADMIN_SECRET=your_secure_admin_secret_here

# Google OAuth (existing)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback/google

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Resend (existing)
RESEND_API_KEY=your_resend_api_key

# App URL (existing)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Setup Instructions

### 1. Run Database Migrations

Execute the SQL from the "API Database Schema & Setup" file in your Supabase SQL editor.

### 2. Update Settings Table

After running migrations, update the settings table with your Google refresh token:

```sql
-- Get your refresh token from the existing auth flow
-- Then update settings:
UPDATE public.settings
SET 
  google_refresh_token = 'your_refresh_token_here',
  host_email = 'your_email@domain.com',
  host_name = 'Your Name',
  email_from = 'noreply@yourdomain.com'
WHERE id = (SELECT id FROM public.settings LIMIT 1);
```

### 3. Generate Your First API Key

```bash
curl -X POST "https://your-domain.com/api/v1/auth/generate-key" \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "your_admin_secret",
    "appName": "My First App",
    "description": "Testing the API"
  }'
```

### 4. Test the API

```bash
# Test availability endpoint
curl -X GET "https://your-domain.com/api/v1/availability" \
  -H "X-API-Key: sk_your_generated_key"

# Test booking creation
curl -X POST "https://your-domain.com/api/v1/bookings" \
  -H "X-API-Key: sk_your_generated_key" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2025-10-15T14:00:00Z",
    "duration": 30,
    "guestName": "Test User",
    "guestEmail": "test@example.com"
  }'
```

---

## Troubleshooting

### "API key required" Error
- Ensure you're including the `X-API-Key` header
- Check that the key is active in the database
- Verify the key hasn't been revoked

### "Calendar not configured" Error
- Verify the `settings` table has a valid `google_refresh_token`
- Check that the refresh token hasn't expired
- Ensure Google Calendar API is enabled

### "Failed to create booking" Error
- Check that the time slot is available
- Verify the guest email is valid
- Ensure the calendar has permissions to create events

### No Available Slots
- Check `event_types` table has a record
- Verify `availabilities` table has working hours configured
- Confirm the date range includes working days

---

## Webhook Implementation (Optional)

To notify your applications of booking events, you can add webhook support:

```typescript
// src/app/api/v1/webhooks/register/route.ts
export async function POST(req: NextRequest) {
  const { webhookUrl, events } = await req.json();
  
  // Store webhook configuration
  await supabase.from('webhooks').insert({
    api_key_id: keyData.id,
    url: webhookUrl,
    events: events, // ['booking.created', 'booking.cancelled']
    is_active: true
  });
}
```

Then trigger webhooks after booking operations:

```typescript
async function triggerWebhook(event: string, data: any) {
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('is_active', true)
    .contains('events', [event]);
  
  for (const webhook of webhooks) {
    await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data })
    });
  }
}
```

---

## Rate Limiting Implementation (Recommended)

Add rate limiting to protect your API:

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map();

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/v1/')) {
    const apiKey = request.headers.get('X-API-Key');
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 100;
    
    if (apiKey) {
      const requests = rateLimit.get(apiKey) || [];
      const recentRequests = requests.filter((time: number) => now - time < windowMs);
      
      if (recentRequests.length >= maxRequests) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
      
      recentRequests.push(now);
      rateLimit.set(apiKey, recentRequests);
    }
  }
  
  return NextResponse.next();
}
```

---

## Support

For issues or questions about the API:
- Check the troubleshooting section above
- Review error messages in the response
- Check your API key usage in the dashboard
- Contact support at: support@yourdomain.com