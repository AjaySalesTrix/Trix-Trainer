import "./globals.css";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import PostHogProvider from "./posthog-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <Suspense fallback={null}>
            <PostHogProvider>{children}</PostHogProvider>
          </Suspense>
        </ClerkProvider>
      </body>
    </html>
  );
}
