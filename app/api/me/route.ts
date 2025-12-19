// app/api/me/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ userId: null, email: null, is_premium: false });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("users")
    .select("is_premium")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  return Response.json({
    userId,
    email,
    is_premium: !!data?.is_premium && !error,
  });
}