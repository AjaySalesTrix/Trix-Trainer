"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function AdminPosthog({ userId }: { userId: string }) {
  useEffect(() => {
    posthog.capture("admin_viewed_user", { userId });
  }, [userId]);

  return null;
}
