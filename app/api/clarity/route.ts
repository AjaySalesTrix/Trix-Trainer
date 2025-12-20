import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

type RowPayload = {
  id?: string;
  symptom?: string;
  impact?: string;
  root_cause?: string;
  case_study_company?: string;
  case_study_challenge?: string;
  case_study_solution?: string;
  case_study_result?: string;
};

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function toText(value: unknown) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "SUPABASE_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("problem_lab_rows")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json(
      { ok: false, error: "SUPABASE_QUERY_FAILED" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, rows: data || [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "SUPABASE_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  let body: RowPayload = {};
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const symptom = toText(body.symptom);
  const rootCause = toText(body.root_cause);

  if (!symptom) {
    return Response.json({ ok: false, error: "SYMPTOM_REQUIRED" }, { status: 400 });
  }
  if (!rootCause) {
    return Response.json({ ok: false, error: "ROOT_CAUSE_REQUIRED" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    null;

  const payload = {
    id: body.id || undefined,
    user_id: userId,
    email,
    name,
    symptom,
    impact: toText(body.impact),
    root_cause: rootCause,
    case_study_company: toText(body.case_study_company),
    case_study_challenge: toText(body.case_study_challenge),
    case_study_solution: toText(body.case_study_solution),
    case_study_result: toText(body.case_study_result),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("problem_lab_rows")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    return Response.json(
      { ok: false, error: "SUPABASE_UPSERT_FAILED" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "SUPABASE_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const { error } = await supabase
    .from("problem_lab_rows")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return Response.json(
      { ok: false, error: "SUPABASE_DELETE_FAILED" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
