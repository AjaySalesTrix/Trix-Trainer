import { auth } from "@clerk/nextjs/server";
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

  const filePath = path.join(process.cwd(), "data", "phase1.json");
  const raw = fs.readFileSync(filePath, "utf8");

  return new Response(raw, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
