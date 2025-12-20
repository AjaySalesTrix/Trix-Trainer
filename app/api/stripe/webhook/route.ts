export const runtime = "nodejs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover",
  });

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

if (event.type === "checkout.session.completed") {
  const session = event.data.object as Stripe.Checkout.Session;

  const clerkUserId = session.metadata?.clerk_user_id;
  const email = session.customer_details?.email || session.customer_email || null;

  console.log("✅ checkout.session.completed", { clerkUserId, email });

  if (!clerkUserId) {
    console.log("⚠️ No clerk_user_id in metadata — cannot upgrade.");
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("users")
    .upsert(
      { clerk_user_id: clerkUserId, email, is_premium: true },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    console.log("❌ Supabase upsert error:", error);
    return new Response("Supabase error", { status: 500 });
  }

  console.log("✅ Supabase upgraded user to premium");
}

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
