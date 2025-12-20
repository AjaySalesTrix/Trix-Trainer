"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

type Props = {
  children: React.ReactNode;
};

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function initPostHog() {
  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    console.warn("[TRIX] PostHog env vars missing, analytics disabled.");
    return false;
  }
  if (typeof window === "undefined") return false;
  const w = window as typeof window & { __TRIX_POSTHOG_INIT?: boolean };
  if (!w.__TRIX_POSTHOG_INIT) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
    });
    w.__TRIX_POSTHOG_INIT = true;
  }
  return true;
}

export default function PostHogProvider({ children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const sessionStartRef = useRef<number | null>(null);
  const sessionEndedRef = useRef(false);

  const canTrack = useMemo(() => initPostHog(), []);

  useEffect(() => {
    if (!canTrack) return;
    sessionStartRef.current = Date.now();
    sessionEndedRef.current = false;
    posthog.capture("session_start", { source: "app" });

    const sendSessionEnd = () => {
      if (sessionEndedRef.current || sessionStartRef.current === null) return;
      sessionEndedRef.current = true;
      posthog.capture("session_end", {
        source: "app",
        duration_ms: Date.now() - sessionStartRef.current,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendSessionEnd();
    };

    window.addEventListener("pagehide", sendSessionEnd);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", sendSessionEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canTrack]);

  useEffect(() => {
    if (!canTrack) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });

    if (pathname === "/trainer") {
      posthog.capture("trainer_loaded", { source: "trainer_route" });
    }
  }, [canTrack, pathname, searchParams]);

  useEffect(() => {
    if (!canTrack) return;
    if (user?.id) {
      const email =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress;
      const name =
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ");

      posthog.identify(user.id, {
        email: email || undefined,
        name: name || undefined,
        $email: email || undefined,
        $name: name || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      });
    } else {
      posthog.reset();
    }
  }, [canTrack, user]);

  return children;
}
