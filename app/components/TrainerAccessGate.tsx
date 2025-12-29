"use client";

import { useEffect, useRef } from "react";
import styles from "./TrainerAccessGate.module.css";

type TrainerAccessGateProps = {
  isSignedIn: boolean;
  onInteract: () => void;
  children: React.ReactNode;
};

export default function TrainerAccessGate({
  isSignedIn,
  onInteract,
  children,
}: TrainerAccessGateProps) {
  const openingRef = useRef(false);

  const triggerModal = () => {
    if (isSignedIn) return;
    if (openingRef.current) return;
    openingRef.current = true;
    onInteract();
    setTimeout(() => {
      openingRef.current = false;
    }, 300);
  };

  useEffect(() => {
    if (isSignedIn) return;
    const onKeyDown = () => {
      triggerModal();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isSignedIn]);

  return (
    <div className={styles.gate}>
      {children}
      {!isSignedIn ? (
        <div
          className={styles.blocker}
          onPointerDown={triggerModal}
          role="presentation"
        />
      ) : null}
    </div>
  );
}
