import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const serverKey = process.env.SCHEDULER_API_KEY;
  if (!serverKey) {
    return NextResponse.json({ error: 'Server API key not configured' }, { status: 500 });
  }

  const incomingUrl = new URL(req.url);
  const targetUrl = new URL('/api/v1/availability', req.url);
  targetUrl.search = incomingUrl.search; // preserve original query params

  const res = await fetch(targetUrl, {
    headers: { 'X-API-Key': serverKey },
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}