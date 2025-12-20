// app/api/me/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_USER_ID || "";
  const isAdmin = !!adminId && userId === adminId;

  if (!userId) {
    return Response.json({
      userId: null,
      email: null,
      is_premium: false,
      is_admin: false,
    });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  const firstName = user?.firstName || null;
  const lastName = user?.lastName || null;
  const fullName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    null;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { error: upsertError } = await supabase
      .from("users")
      .upsert(
        {
          clerk_user_id: userId,
          email,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
        },
        { onConflict: "clerk_user_id" }
      );
    if (upsertError) {
      console.error("[api/me] users upsert failed", {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });
    }
  } catch (_) {}

  const { data, error } = await supabase
    .from("users")
    .select("is_premium")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  // ✅ Admin override: always premium
  if (isAdmin) {
    return Response.json({
      userId,
      email,
      firstName,
      lastName,
      fullName,
      is_premium: true,
      is_admin: true,
    });
  }

  return Response.json({
    userId,
    email,
    firstName,
    lastName,
    fullName,
    is_premium: !!data?.is_premium && !error,
    is_admin: isAdmin,
  });
}
