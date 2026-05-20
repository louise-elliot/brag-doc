"use client";

import { useEffect } from "react";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="About Byline"
    >
      <button
        type="button"
        aria-label="Close about"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="relative bg-white rounded-lg shadow-xl max-w-[640px] w-full max-h-[85vh] overflow-y-auto"
        style={{ animation: "fadeIn 0.25s ease both" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close about"
          className="absolute top-4 right-4 font-body text-2xl leading-none text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-100)] rounded-md w-10 h-10 flex items-center justify-center transition-colors cursor-pointer"
        >
          ×
        </button>
        <div className="px-10 py-12">
          <h2 className="font-display text-3xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-6">
            Why Byline exists
          </h2>
          <div
            className="font-body text-base text-[var(--color-neutral-700)] flex flex-col gap-4"
            style={{ lineHeight: 1.7 }}
          >
            <p>
              Byline is for women who are great at their jobs, but terrible
              at talking about them.
            </p>
            <p>
              Research consistently shows that women undersell their
              abilities, experience, and impact at work — costing them
              opportunities, progression, and visibility.
            </p>
            <p>
              The idea behind Byline is simple. You log your wins as you
              experience them, in the language that comes naturally to you.
              Our AI coach helps you recognise the patterns that quietly
              diminish your impact, and reframe each entry so it confidently
              reflects what you actually did.
            </p>
            <p>
              Over time, these daily wins become a record of your work. When
              performance review season arrives, you export a polished brag
              doc that already sounds like someone who knows their own worth.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
