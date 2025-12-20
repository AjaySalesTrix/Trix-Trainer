// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/trainer.html(.*)",

  "/sign-in(.*)",
  "/sign-up(.*)",

  // ✅ public data
  "/api/phase1",
  "/api/phase2-preview",

  // ✅ public marketing endpoints (opt-in flow)
  "/api/marketing/opt-in",
  "/api/marketing/status",

  // ✅ Stripe webhook must be public
  "/api/stripe/webhook",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};