"use client";

import { useEffect } from "react";

interface AiConsentGateProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function AiConsentGate({ open, onAccept, onCancel }: AiConsentGateProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI data disclosure"
    >
      <button
        type="button"
        aria-label="Dismiss dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="relative bg-white rounded-lg shadow-xl max-w-[480px] w-full"
        style={{ animation: "fadeIn 0.25s ease both" }}
      >
        <div className="px-8 py-10">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-4">
            Before you use AI features
          </h2>
          <p
            className="font-body text-base text-[var(--color-neutral-700)] mb-4"
            style={{ lineHeight: 1.7 }}
          >
            To coach you and generate your Brag Doc, the text of your entries is
            sent to Anthropic, which powers the AI. Continue only if you&apos;re
            happy for this text to be sent.
          </p>
          <p
            className="font-body text-sm text-[var(--color-neutral-500)] mb-8"
            style={{ lineHeight: 1.6 }}
          >
            You can change this anytime in Settings &rarr; Privacy.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="font-body text-sm font-medium text-[var(--color-neutral-700)] border border-[var(--color-neutral-300)] rounded-md px-5 py-2.5 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-5 py-2.5 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
            >
              I understand, continue
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
