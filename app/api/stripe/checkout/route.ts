// app/api/stripe/checkout/route.ts
export const runtime = "nodejs";

import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  const { userId } = await auth();

  console.log("CHECKOUT ROUTE userId =", userId);

  if (!userId) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const user = await currentUser(); // ✅ keep awaited
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const priceId = process.env.STRIPE_PRICE_ID_PREMIUM;
  if (!priceId) {
    return Response.json({ error: "MISSING_STRIPE_PRICE_ID" }, { status: 500 });
  }

  let returnUrl = "";
  try {
    const body = await req.json();
    if (body && typeof body.returnUrl === "string") {
      returnUrl = body.returnUrl;
    }
  } catch (_) {}

  const baseReturnUrl = returnUrl
    ? returnUrl.startsWith("http")
      ? returnUrl
      : `${appUrl}${returnUrl.startsWith("/") ? "" : "/"}${returnUrl}`
    : `${appUrl}/trainer`;

  const successUrl = baseReturnUrl.includes("?")
    ? `${baseReturnUrl}&success=1`
    : `${baseReturnUrl}?success=1`;
  const cancelUrl = baseReturnUrl.includes("?")
    ? `${baseReturnUrl}&canceled=1`
    : `${baseReturnUrl}?canceled=1`;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existingUser } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: existingUser?.stripe_customer_id ? undefined : email,
    customer: existingUser?.stripe_customer_id || undefined,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      clerk_user_id: userId,
      email: email ?? "",
    },
  });

  return Response.json({
    url: session.url,
  });
}
