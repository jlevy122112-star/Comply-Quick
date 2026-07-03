// app/api/premium/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateInput, generatePremiumPacket } from '../clauseEngine';

async function verifyPayment(sessionToken: string): Promise<boolean> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is not configured');
    return false;
  }

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionToken)}`,
      {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      }
    );
    if (!res.ok) return false;
    const session = await res.json();
    return session.payment_status === 'paid';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionToken, input } = body as Record<string, unknown>;

  if (typeof sessionToken !== 'string' || !sessionToken) {
    return NextResponse.json({ error: 'Missing session token' }, { status: 401 });
  }

  const paid = await verifyPayment(sessionToken);
  if (!paid) {
    return NextResponse.json({ error: 'Payment not verified' }, { status: 403 });
  }

  if (!validateInput(input)) {
    return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
  }

  const premiumPacket = generatePremiumPacket(input);
  return NextResponse.json(premiumPacket);
}
