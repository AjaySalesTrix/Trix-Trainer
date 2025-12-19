import fs from "fs";
import path from "path";

export async function GET() {
  const htmlPath = path.join(process.cwd(), "html", "trainer.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
