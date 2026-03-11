import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const serverKey = process.env.SCHEDULER_API_KEY;
  if (!serverKey) {
    return NextResponse.json({ error: 'Server API key not configured' }, { status: 500 });
  }

  const targetUrl = new URL('/api/v1/bookings', req.url);
  const body = await req.json();

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'X-API-Key': serverKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}