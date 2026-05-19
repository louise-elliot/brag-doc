"use client";

import { useState } from "react";
import { CoachNotePills } from "./CoachNotePills";

interface ReframeViewProps {
  original: string;
  reframed: string;
  onAccept: (finalText: string) => void;
  onDismiss: () => void;
  coachNotes?: string[] | null;
}

export function ReframeView({
  original,
  reframed,
  onAccept,
  onDismiss,
  coachNotes,
}: ReframeViewProps) {
  const [edited, setEdited] = useState(reframed);

  return (
    <aside
      role="region"
      aria-label="Reframed version"
      className="bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md p-5 mt-4"
      style={{ animation: "reframeReveal var(--transition-slow) both" }}
    >
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--color-neutral-500)] mb-2">
            Your version
          </p>
          <p
            className="font-body text-sm text-[var(--color-neutral-500)]"
            style={{ lineHeight: 1.75 }}
          >
            {original}
          </p>
        </div>

        <div>
          <label
            htmlFor="reframe-edit"
            className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--color-primary-700)] mb-2 block"
          >
            Reframed
          </label>
          <textarea
            id="reframe-edit"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={4}
            className="w-full bg-transparent border border-dashed border-[var(--color-primary-300)] rounded-sm px-[10px] py-2 font-body text-sm text-[var(--color-neutral-700)] resize-y outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-100)]"
            style={{ lineHeight: 1.75 }}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => onAccept(edited)}
          className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="font-body text-sm font-medium text-[var(--color-neutral-600)] rounded-md px-4 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>

      {coachNotes && coachNotes.length > 0 && (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          <span className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--color-neutral-500)]">
            What the coach noticed
          </span>
          <CoachNotePills notes={coachNotes} />
        </div>
      )}
    </aside>
  );
}
