import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ optedIn: false }, { status: 200 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find(e => e.id === user?.primaryEmailAddressId)?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress;

  if (!email) return NextResponse.json({ optedIn: false }, { status: 200 });

  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) return NextResponse.json({ optedIn: false }, { status: 200 });

  // Kit: lookup subscriber by email
  const r = await fetch(`https://api.kit.com/v3/subscribers?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`, {
    method: "GET"
  });

  if (!r.ok) return NextResponse.json({ optedIn: false }, { status: 200 });

  const data: any = await r.json().catch(() => null);
  const exists = !!(data?.subscribers && data.subscribers.length > 0);

  return NextResponse.json({ optedIn: exists }, { status: 200 });
}