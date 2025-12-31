"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import styles from "./TrixOnboardingAuthModal.module.css";

type ModalMode = "onboarding" | "auth";
type AuthView = "signUp" | "signIn";

type TrixOnboardingAuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const steps = [
  {
    title: "Welcome to the Trix Cold Call Trainer!",
    content: (
      <>
        <p>Practice the full call without guessing what to say next.</p>
        <p>Follow the flow, stay in control, and build real confidence.</p>
      </>
    ),
  },
  {
    title: "The biggest challenges in cold calls",
    content: (
      <>
        <p>
          Often, the biggest challenges — for both new reps and experienced ones
          who avoid cold calling — aren’t confidence or motivation.
        </p>
        <p>They’re these:</p>
        <ol className={styles.listNumbered}>
          <li>
            Knowing how to respond to whatever the prospect says — without
            freezing or panicking
          </li>
          <li>Losing control of the call the moment it goes off-script</li>
          <li>
            Not knowing what to say next to move the conversation forward
          </li>
        </ol>
        <p>
          It’s why cold calls feel stressful and puts a lot of reps off of doing
          them - sound familiar?
        </p>
      </>
    ),
  },
  {
    title: "This trainer removes that uncertainty",
    content: (
      <>
        
        <p>
          You’re not expected to “think on your feet” or memorise scripts.
        </p>
        <p>Instead, you’ll practice cold calls where:</p>
        <ul className={styles.listBullets}>
          <li>Every prospect response is realistic and unpredictable</li>
          <li>You’re guided on what to say next at each moment</li>
          <li>The call always follows a clear, logical path</li>
        </ul>
        <p>
          So instead of reacting under pressure…
          <br />
          you learn how to navigate the conversation.
        </p>
      </>
    ),
  },
  {
    title: "This isn’t about sounding scripted.",
    content: (
      <>
        
        <p>
          Every good cold call has structure — whether the rep realises it or
          not.
        </p>
        <p>The difference is:</p>
        <p>Bad reps think in the moment.</p>
        <p>Good reps recognise patterns and respond instinctively.</p>
        <p>
          This trainer maps the entire cold call — so no matter what the
          prospect says,
          <br />
          you know how to navigate the conversation and ask the right question
          at the right time.
        </p>
      </>
    ),
  },
  {
    title:
      "Check out the video below on how to use the trainer (and how to get access to the free custom cold calling GPT, where the GPT will roleplay as your prospect)!",
    content: <p>Watch a quick walkthrough, then create your account.</p>,
  },
];

const videoUrl = process.env.NEXT_PUBLIC_TRAINER_WALKTHROUGH_URL || "";

export default function TrixOnboardingAuthModal({
  isOpen,
  onClose,
}: TrixOnboardingAuthModalProps) {
  const { isSignedIn } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<ModalMode>("onboarding");
  const [authView, setAuthView] = useState<AuthView>("signUp");
  const modalRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const canClose = isSignedIn;
  const isFinalStep = stepIndex === steps.length - 1;

  const step = steps[stepIndex];

  const isVideo = useMemo(() => {
    return /(\.mp4|\.webm|\.ogg)(\?.*)?$/i.test(videoUrl);
  }, []);

  useEffect(() => {
    if (isSignedIn && isOpen) {
      onClose();
    }
  }, [isSignedIn, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (canClose) onClose();
        return;
      }
      if (e.key !== "Tab") return;
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      prevFocusRef.current?.focus();
    };
  }, [isOpen, canClose, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setStepIndex(0);
    setMode("onboarding");
    setAuthView("signUp");
  }, [isOpen]);

  if (!isOpen) return null;

  const appearance = {
    variables: {
      colorPrimary: "#f1d3a2",
      colorBackground: "#0e141b",
      colorText: "#f5f1e8",
      colorTextSecondary: "rgba(245, 241, 232, 0.7)",
      borderRadius: "16px",
      fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui)",
    },
    elements: {
      card: "background: transparent; box-shadow: none; padding: 0;",
      headerTitle: "color: #f5f1e8;",
      headerSubtitle: "color: rgba(245, 241, 232, 0.7);",
      socialButtonsBlockButton:
        "border-radius: 999px; border-color: rgba(255,255,255,0.2);",
      formButtonPrimary:
        "border-radius: 999px; background: #f1d3a2; color: #1a1a1a; font-weight: 700;",
      formFieldInput:
        "border-radius: 12px; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); color: #f5f1e8;",
      footerActionLink: "color: #f1d3a2;",
    },
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div
        className={styles.backdrop}
        onClick={() => {
          if (canClose) onClose();
        }}
      />
      <div
        className={`${styles.modal} ${
          mode === "auth" ? styles.modalAuth : styles.modalOnboarding
        }`}
        ref={modalRef}
      >
        <div className={styles.header}>
          <div className={styles.brand}>TRIX</div>
          {mode === "onboarding" ? (
            <div className={styles.stepper}>
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ""}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        {mode === "onboarding" ? (
          <div className={styles.content}>
            <h2 className={styles.title}>{step.title}</h2>
            <div className={styles.body}>
              {isFinalStep ? (
                <div className={styles.finalStep}>
                  {step.content}
                  <div className={styles.videoWrap}>
                    {videoUrl ? (
                      isVideo ? (
                        <video
                          className={styles.video}
                          controls
                          src={videoUrl}
                        />
                      ) : (
                        <iframe
                          className={styles.video}
                          src={videoUrl}
                          title="Trainer walkthrough"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen
                        />
                      )
                    ) : (
                      <div className={styles.videoPlaceholder}>
                        Add NEXT_PUBLIC_TRAINER_WALKTHROUGH_URL to show the walkthrough.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                step.content
              )}
            </div>
            <div className={styles.footer}>
              <button
                className={styles.secondary}
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                disabled={stepIndex === 0}
                type="button"
              >
                Back
              </button>
              {isFinalStep ? (
                <button
                  className={styles.primary}
                  onClick={() => setMode("auth")}
                  type="button"
                >
                  Sign up to get started
                </button>
              ) : (
                <button
                  className={styles.primary}
                  onClick={() => setStepIndex((s) => Math.min(steps.length - 1, s + 1))}
                  type="button"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.authCenter}>
            <div className={styles.authWrap}>
              {/* Clerk shows "Secured by Clerk" in dev; this disappears on production keys/verified domain. */}
              {authView === "signUp" ? (
                <SignUp routing="virtual" appearance={appearance} />
              ) : (
                <SignIn routing="virtual" appearance={appearance} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
