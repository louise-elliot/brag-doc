"use client";

import { useEffect, useState } from "react";
import { CoachNotePills } from "./CoachNotePills";

interface CoachMessageProps {
  role: "coach" | "user";
  text: string;
  notes?: string[];
  animate?: boolean;
}

const TYPE_INTERVAL_MS = 18;

export function CoachMessage({
  role,
  text,
  notes,
  animate = false,
}: CoachMessageProps) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setDisplayed(text);
      return;
    }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [animate, text]);

  const isCoach = role === "coach";
  return (
    <div className={`flex flex-col gap-2 ${isCoach ? "items-start" : "items-end"}`}>
      <span className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
        {isCoach ? "Coach" : "You"}
      </span>
      {isCoach && notes && notes.length > 0 && <CoachNotePills notes={notes} />}
      <p
        className={
          isCoach
            ? "font-body text-base text-[var(--color-neutral-700)] bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md px-5 py-4 max-w-[85%]"
            : "font-body text-base text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] rounded-md px-5 py-4 max-w-[85%]"
        }
        style={{ lineHeight: 1.6 }}
      >
        {displayed}
      </p>
    </div>
  );
}
