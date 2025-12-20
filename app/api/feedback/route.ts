export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth, currentUser, getAuth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";


export async function POST(req: Request) {
  try {
    // Try the App Router helper first
    const { userId: authUserId } = await auth();
    let userId = authUserId;

    // Fallback: if middleware isn’t running for this route (e.g. marked public),
    // getAuth can still resolve the session directly from the Request.
    if (!userId) {
      try {
        const ga = getAuth(req as any);
        userId = ga.userId;
      } catch (e) {
        // ignore
      }
    }

    if (!userId) {
      // Helpful debug signal (safe to keep during dev)
      console.warn("🔒 /api/feedback: Not authenticated", {
        hasCookie: !!req.headers.get("cookie"),
        referer: req.headers.get("referer"),
      });
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const hardestPart = String(body?.hardestPart || "").trim();
    const details = String(body?.details || "").trim();
    const source = String(body?.source || "trainer").trim();

    if (!hardestPart) {
      return NextResponse.json({ error: "hardestPart is required" }, { status: 400 });
    }

    console.log("📝 Feedback received", {
      userId,
      hardestPart,
      hasDetails: !!details,
      source,
    });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || null;
    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      null;

    const pagePath = req.headers.get("referer") || req.url;
    const userAgent = req.headers.get("user-agent");

    const { error } = await supabase.from("trix_feedback").insert({
      user_id: userId,
      email,
      name,
      hardest_part: hardestPart,
      details: details || null,
      source,
      page_path: pagePath,
      user_agent: userAgent,
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ /api/feedback crashed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
