"use client";

import { useUser } from "@clerk/nextjs";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function TrainerPage() {
  const { user } = useUser();

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      {/* Full-screen trainer UI */}
      <iframe
        // cache-bust so you always see the latest trainer.html changes
        src="/trainer.html?v=4"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="TRIX Trainer"
      />

      {/* Auth status overlay (keeps /trainer clean so the trainer.html UI is the focus) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 50,
        }}
      >
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