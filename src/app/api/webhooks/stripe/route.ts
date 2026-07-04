import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const plan = session.metadata?.plan ?? "single";
      // In production, save the customer/subscription to a database.
      // For now, the redirect URL handles the premium state via query param.
      console.log(`[Stripe] Checkout completed — plan: ${plan}, customer: ${session.customer}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      console.log(`[Stripe] Subscription cancelled — id: ${subscription.id}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.log(`[Stripe] Payment failed — invoice: ${invoice.id}`);
      break;
    }

    default:
      // Unhandled event type — log and acknowledge
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
