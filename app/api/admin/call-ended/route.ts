import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_USER_ID;

  if (!adminId) {
    return Response.json({ error: "ADMIN_NOT_CONFIGURED" }, { status: 500 });
  }

  if (!userId || userId !== adminId) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId) {
    return Response.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("call_ended_events")
    .select("*")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: "SUPABASE_QUERY_FAILED" }, { status: 500 });
  }

  return Response.json({ ok: true, data });
}
