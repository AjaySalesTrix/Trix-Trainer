import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: true, opted_in: false, source: "fallback" }, { status: 200 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("users")
    .select("marketing_opt_in, email")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: true, opted_in: false, source: "fallback" }, { status: 200 });
  }

  if (data?.marketing_opt_in) {
    return NextResponse.json(
      { ok: true, opted_in: true, source: "supabase" },
      { status: 200 }
    );
  }

  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[TRIX] KIT_API_KEY missing; falling back to Supabase only");
    }
    return NextResponse.json(
      { ok: true, opted_in: false, source: "fallback" },
      { status: 200 }
    );
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user?.primaryEmailAddressId)
      ?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    data?.email ||
    null;

  if (!email) {
    return NextResponse.json(
      { ok: true, opted_in: false, source: "fallback" },
      { status: 200 }
    );
  }

  const r = await fetch(
    `https://api.kit.com/v3/subscribers?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`,
    { method: "GET" }
  );

  if (!r.ok) {
    return NextResponse.json(
      { ok: true, opted_in: false, source: "fallback" },
      { status: 200 }
    );
  }

  const statusData: any = await r.json().catch(() => null);
  const exists = !!(statusData?.subscribers && statusData.subscribers.length > 0);

  if (!exists) {
    return NextResponse.json(
      { ok: true, opted_in: false, source: "kit" },
      { status: 200 }
    );
  }

  const { error: repairError } = await supabase
    .from("users")
    .upsert(
      {
        clerk_user_id: userId,
        email,
        marketing_opt_in: true,
        marketing_opt_in_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );

  if (!repairError) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[TRIX] marketing_opt_in repaired from Kit for ${userId}`);
    }
    return NextResponse.json(
      { ok: true, opted_in: true, source: "repaired" },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { ok: true, opted_in: true, source: "kit" },
    { status: 200 }
  );
}
