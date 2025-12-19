// app/api/stripe/checkout/route.ts
export const runtime = "nodejs";

import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST() {
  const { userId } = await auth(); // ✅ FIX

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

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: 14700,
          product_data: { name: "TRIX Cold Call Trainer — Premium" },
        },
        quantity: 1,
      },
    ],
    return_url: `${appUrl}/trainer?paid=1`,
    metadata: {
      clerk_user_id: userId,
      email: email ?? "",
    },
  });

  return Response.json({
    client_secret: session.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}