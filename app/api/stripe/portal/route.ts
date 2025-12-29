export const runtime = "nodejs";

import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let returnUrl = "";
  try {
    const body = await req.json();
    if (body && typeof body.returnUrl === "string") {
      returnUrl = body.returnUrl;
    }
  } catch (_) {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const baseReturnUrl = returnUrl
    ? returnUrl.startsWith("http")
      ? returnUrl
      : `${appUrl}${returnUrl.startsWith("/") ? "" : "/"}${returnUrl}`
    : `${appUrl}/trainer`;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: userRow, error } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error || !userRow?.stripe_customer_id) {
    return Response.json({ error: "NO_STRIPE_CUSTOMER" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: userRow.stripe_customer_id,
    return_url: baseReturnUrl,
  });

  return Response.json({ url: session.url });
}
