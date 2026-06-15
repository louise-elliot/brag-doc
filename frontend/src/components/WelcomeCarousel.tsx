"use client";

import { useCallback, useEffect, useState } from "react";

interface WelcomeCarouselProps {
  open: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    title: "Log a win each day",
    body: "Write what you did, in your own words. The daily prompt is there to spark ideas, not box you in.",
  },
  {
    title: "Let the coach reframe it",
    body: "The AI coach rewrites self-diminishing language into confident, accurate impact statements, keeping your facts intact.",
  },
  {
    title: "Export your brag doc",
    body: "At review time, generate a polished, categorized summary you can copy straight into your self-review.",
  },
];

export function WelcomeCarousel({ open, onClose }: WelcomeCarouselProps) {
  const [slide, setSlide] = useState(0);

  const handleClose = useCallback(() => {
    setSlide(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Byline"
    >
      <button
        type="button"
        aria-label="Close welcome"
        onClick={handleClose}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="relative bg-white rounded-lg shadow-xl max-w-[520px] w-full"
        style={{ animation: "fadeIn 0.25s ease both" }}
      >
        <div className="px-10 py-12">
          <p className="font-body text-sm font-medium text-[var(--color-primary-600)] mb-3">
            Welcome to Byline
          </p>
          <h2 className="font-display text-3xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-4">
            {current.title}
          </h2>
          <p
            className="font-body text-base text-[var(--color-neutral-700)]"
            style={{ lineHeight: 1.7 }}
          >
            {current.body}
          </p>
          {isLast && (
            <p className="font-body text-sm text-[var(--color-neutral-500)] mt-4">
              Tap Byline any time to learn more.
            </p>
          )}

          <div className="flex items-center gap-2 mt-8" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={[
                  "rounded-full w-2 h-2",
                  i === slide
                    ? "bg-[var(--color-primary-500)]"
                    : "bg-[var(--color-neutral-300)]",
                ].join(" ")}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={handleClose}
              className="font-body text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)] bg-transparent border-none cursor-pointer"
            >
              Skip
            </button>
            <div className="flex gap-3">
              {slide > 0 && (
                <button
                  type="button"
                  onClick={() => setSlide((s) => s - 1)}
                  className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={handleClose}
                  className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
                >
                  Get started
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSlide((s) => s + 1)}
                  className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
