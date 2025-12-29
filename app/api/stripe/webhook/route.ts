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

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const mapStatus = (status: Stripe.Subscription.Status) => {
    if (status === "active" || status === "trialing") return "active";
    if (status === "past_due" || status === "unpaid") return "past_due";
    if (status === "canceled" || status === "incomplete_expired") return "inactive";
    return "inactive";
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const clerkUserId = session.metadata?.clerk_user_id;
    const email = session.customer_details?.email || session.customer_email || null;
    const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (!clerkUserId) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    let currentPeriodEnd: string | null = null;
    if (stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
    }

    const { error } = await supabase
      .from("users")
      .upsert(
        {
          clerk_user_id: clerkUserId,
          email,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          plan_status: "active",
          plan_name: "premium",
          current_period_end: currentPeriodEnd,
          is_premium: true,
        },
        { onConflict: "clerk_user_id" }
      );

    if (error) {
      console.log("❌ Supabase upsert error:", error);
      return new Response("Supabase error", { status: 500 });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : null;
    if (stripeCustomerId) {
      const planStatus = mapStatus(sub.status);
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
      const stripeSubscriptionId = sub.id;
      const { error } = await supabase
        .from("users")
        .update({
          stripe_subscription_id: stripeSubscriptionId,
          plan_status: planStatus,
          plan_name: "premium",
          current_period_end: currentPeriodEnd,
          is_premium: planStatus === "active",
        })
        .eq("stripe_customer_id", stripeCustomerId);
      if (error) {
        console.log("❌ Supabase update error:", error);
        return new Response("Supabase error", { status: 500 });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : null;
    if (stripeCustomerId) {
      const { error } = await supabase
        .from("users")
        .update({
          plan_status: "inactive",
          current_period_end: null,
          is_premium: false,
        })
        .eq("stripe_customer_id", stripeCustomerId);
      if (error) {
        console.log("❌ Supabase update error:", error);
        return new Response("Supabase error", { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
