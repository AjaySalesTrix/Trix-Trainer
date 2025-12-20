// app/api/marketing/opt-in/route.ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    if (!process.env.KIT_FORM_ID || !process.env.KIT_API_KEY) {
      console.log("❌ Missing KIT env", {
        hasFormId: !!process.env.KIT_FORM_ID,
        hasApiKey: !!process.env.KIT_API_KEY,
      });
      return NextResponse.json(
        { error: "Missing KIT env vars" },
        { status: 500 }
      );
    }

    // BODY EMAIL (optional fallback)
    const body = await req.json().catch(() => ({}));
    let email: string | undefined = body?.email;

    // CLERK EMAIL (preferred)
    if (!email) {
      const { userId } = await auth(); // ✅ IMPORTANT in route handlers
      if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const user = await currentUser();
      email =
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        undefined;

      if (!email) {
        console.log("❌ Clerk user has no email", {
          userId,
          emailCount: user?.emailAddresses?.length ?? null,
          primaryId: user?.primaryEmailAddressId ?? null,
        });
      }
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const firstName = clerkUser?.firstName || null;
    const lastName = clerkUser?.lastName || null;
    const fullName =
      clerkUser?.fullName ||
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
      null;

    const res = await fetch(
      `https://api.convertkit.com/v3/forms/${process.env.KIT_FORM_ID}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.KIT_API_KEY,
          email,
          tags: ["trainer", "prospect-gpt", "free"],
        }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("❌ Kit error:", data);
      return NextResponse.json(
        { error: "Kit failed", details: data },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: upsertError } = await supabase
      .from("users")
      .upsert(
        {
          clerk_user_id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          marketing_opt_in: true,
          marketing_opt_in_at: new Date().toISOString(),
        },
        { onConflict: "clerk_user_id" }
      );

    if (upsertError) {
      console.error("MARKETING_OPT_IN_DB_FAIL", {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      return NextResponse.json(
        { success: false, error: "SUPABASE_MARKETING_OPTIN_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, dbUpdated: true, kitUpdated: true });
  } catch (err) {
    console.error("❌ Opt-in route crashed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
