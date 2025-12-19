import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("users")
    .select("is_premium")
    .eq("clerk_user_id", userId)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!data?.is_premium) {
    return new Response(JSON.stringify({ error: "LOCKED" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const filePath = path.join(process.cwd(), "data", "phase2.json");
  const raw = fs.readFileSync(filePath, "utf8");

  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
