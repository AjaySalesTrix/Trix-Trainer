import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const PHASES = new Set(["phase1", "phase2", "phase2_preview"]);
const REASONS = new Set(["not_covered", "lost_control", "disengaged"]);
const SOURCES = new Set(["trainer_html_iframe", "trainer_route"]);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      {
        ok: false,
        error: "SUPABASE_NOT_CONFIGURED",
        hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 500 }
    );
  }

  let payload: {
    phase?: string;
    nodeId?: string | null;
    path?: unknown;
    reason?: string;
    note?: string | null;
    source?: string;
  } = {};

  try {
    payload = await req.json();
  } catch (_) {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const phase = payload.phase;
  const reason = payload.reason;
  const source = payload.source;

  if (!phase || !PHASES.has(phase)) {
    return Response.json({ ok: false, error: "INVALID_PHASE" }, { status: 400 });
  }

  if (!reason || !REASONS.has(reason)) {
    return Response.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  if (!source || !SOURCES.has(source)) {
    return Response.json({ ok: false, error: "INVALID_SOURCE" }, { status: 400 });
  }

  if (!Array.isArray(payload.path)) {
    return Response.json({ ok: false, error: "INVALID_PATH" }, { status: 400 });
  }

  const note = payload.note ?? null;
  if (note && note.length > 500) {
    return Response.json({ ok: false, error: "NOTE_TOO_LONG" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    null;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase.from("call_ended_events").insert({
    user_id: userId,
    email,
    name,
    phase,
    node_id: payload.nodeId || null,
    path: payload.path,
    reason,
    note,
    source,
    user_agent: req.headers.get("user-agent"),
  });

  if (error) {
    const isDev = process.env.NODE_ENV !== "production";
    console.error("[/api/call-ended] Supabase insert failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return Response.json(
      {
        ok: false,
        error: "SUPABASE_INSERT_FAILED",
        hint: isDev ? error.message : undefined,
      },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
