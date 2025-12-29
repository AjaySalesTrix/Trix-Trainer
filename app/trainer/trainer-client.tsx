"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TrainerAccessGate from "../components/TrainerAccessGate";
import TrixOnboardingAuthModal from "../components/TrixOnboardingAuthModal";

export default function TrainerClient() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams();
    const mode = searchParams?.get("mode");
    const userId = searchParams?.get("userId");
    if (mode) params.set("mode", mode);
    if (userId) params.set("userId", userId);
    return params.toString() ? `/trainer.html?${params.toString()}` : "/trainer.html";
  }, [searchParams]);

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <TrainerAccessGate
        isSignedIn={!!isSignedIn}
        onInteract={() => setModalOpen(true)}
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="TRIX Trainer"
        />
      </TrainerAccessGate>

      {isSignedIn ? (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 50 }}>
          <UserButton />
        </div>
      ) : null}

      <TrixOnboardingAuthModal
        isOpen={modalOpen && !isSignedIn}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
