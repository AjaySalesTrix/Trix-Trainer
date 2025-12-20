"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";

export default function TrainerClient() {
  const cacheBust = useMemo(() => Date.now(), []);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const searchParams = useSearchParams();

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams();
    const mode = searchParams?.get("mode");
    const userId = searchParams?.get("userId");
    if (mode) params.set("mode", mode);
    if (userId) params.set("userId", userId);
    params.set("v", String(cacheBust));
    return `/trainer.html?${params.toString()}`;
  }, [cacheBust, searchParams]);

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="TRIX Trainer"
      />

      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 50 }}>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              style={{
                borderRadius: 999,
                padding: "10px 14px",
                border: "1px solid rgba(9, 28, 45, 0.25)",
                background: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sign in
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );
}
