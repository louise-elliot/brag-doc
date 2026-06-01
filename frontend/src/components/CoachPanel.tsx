"use client";

import { useEffect, useRef, useState } from "react";
import { CoachMessage } from "./CoachMessage";
import { ReframeView } from "./ReframeView";
import {
  coachReframe,
  coachTurn,
  type CoachMessage as ApiMessage,
} from "@/lib/coachApi";
import { readSettings, serializeContext } from "@/lib/settings";

export interface CoachPanelEntry {
  id: string;
  original: string;
  prompt: string;
  tags: string[];
}

interface CoachPanelProps {
  entry: CoachPanelEntry;
  onAccept: (reframed: string, notes: string[]) => void;
  onDismiss: () => void;
  onClose: () => void;
}

type Phase =
  | { kind: "loading-turn" }
  | { kind: "chatting" }
  | { kind: "error-turn" }
  | { kind: "loading-reframe" }
  | { kind: "reframing"; reframed: string; notes: string[] }
  | { kind: "error-reframe" };

export function CoachPanel({
  entry,
  onAccept,
  onDismiss,
  onClose,
}: CoachPanelProps) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading-turn" });
  const [reply, setReply] = useState("");
  const fetchedFirstRef = useRef(false);
  const lastMessageIndex = messages.length - 1;

  function settingsFields() {
    const settings = readSettings();
    return {
      coaching_style: settings.coachingStyle,
      user_context: serializeContext(settings),
    };
  }

  async function fetchTurn(history: ApiMessage[]) {
    setPhase({ kind: "loading-turn" });
    try {
      const result = await coachTurn({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: history,
        ...settingsFields(),
      });
      setMessages([
        ...history,
        { role: "coach", text: result.text, notes: result.notes },
      ]);
      setPhase({ kind: "chatting" });
    } catch {
      setPhase({ kind: "error-turn" });
    }
  }

  async function fetchReframe() {
    setPhase({ kind: "loading-reframe" });
    try {
      const result = await coachReframe({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: messages,
        ...settingsFields(),
      });
      setPhase({
        kind: "reframing",
        reframed: result.reframed,
        notes: result.notes,
      });
    } catch {
      setPhase({ kind: "error-reframe" });
    }
  }

  useEffect(() => {
    if (fetchedFirstRef.current) return;
    fetchedFirstRef.current = true;
    void fetchTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSendReply() {
    const trimmed = reply.trim();
    if (!trimmed) return;
    const next: ApiMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setReply("");
    void fetchTurn(next);
  }

  function handleRetryTurn() {
    void fetchTurn(messages);
  }

  function handleRetryReframe() {
    void fetchReframe();
  }

  function handleAccept(finalText: string) {
    if (phase.kind !== "reframing") return;
    onAccept(finalText, phase.notes);
  }

  return (
    <section
      className="mt-4 bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md p-5"
      style={{ animation: "reframeReveal var(--transition-slow) both" }}
    >
      <div className="flex justify-between items-center">
        <span className="font-body text-sm font-semibold text-[var(--color-primary-700)]">
          Your Coaching Conversation
        </span>
        {phase.kind !== "reframing" && (
          <button
            type="button"
            aria-label="Close coach"
            onClick={onClose}
            className="font-body text-sm text-[var(--color-neutral-500)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-neutral-100)] px-3 py-1 rounded-md"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 mt-4">
        {messages.map((m, i) => (
          <CoachMessage
            key={i}
            role={m.role}
            text={m.text}
            notes={m.notes}
            animate={i === lastMessageIndex && m.role === "coach"}
          />
        ))}

        {phase.kind === "loading-turn" && (
          <p
            role="status"
            aria-live="polite"
            className="font-body text-sm text-[var(--color-neutral-500)]"
          >
            Coach is thinking...
          </p>
        )}

        {phase.kind === "loading-reframe" && (
          <p
            role="status"
            aria-live="polite"
            className="font-body text-sm text-[var(--color-neutral-500)]"
          >
            Coach is wordsmithing...
          </p>
        )}

        {phase.kind === "error-turn" && <ErrorRow onRetry={handleRetryTurn} />}

        {phase.kind === "error-reframe" && (
          <ErrorRow onRetry={handleRetryReframe} />
        )}
      </div>

      {phase.kind === "chatting" && (
        <div className="mt-4">
          <label
            htmlFor={`coach-reply-${entry.id}`}
            className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-500)] block mb-2"
          >
            Your reply
          </label>
          <textarea
            id={`coach-reply-${entry.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            className="w-full font-body text-base text-[var(--color-neutral-700)] bg-[var(--color-neutral-0)] border border-[var(--color-neutral-300)] rounded-md px-4 py-3 resize-y outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!reply.trim()}
              className="font-body text-sm font-medium px-5 py-2 rounded-md border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] bg-transparent cursor-pointer hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send reply
            </button>
            <button
              type="button"
              onClick={() => void fetchReframe()}
              className="font-body text-sm font-semibold px-5 py-2 rounded-md bg-[var(--color-primary-500)] text-white border-none cursor-pointer hover:bg-[var(--color-primary-600)]"
            >
              Reframe it now
            </button>
          </div>
        </div>
      )}

      {phase.kind === "reframing" && (
        <div className="mt-4">
          <ReframeView
            original={entry.original}
            reframed={phase.reframed}
            coachNotes={phase.notes}
            onAccept={handleAccept}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </section>
  );
}

interface ErrorRowProps {
  onRetry: () => void;
}

function ErrorRow({ onRetry }: ErrorRowProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 font-body text-sm text-[var(--color-error-500)]"
    >
      <span>Coach didn&apos;t respond. Try again.</span>
      <button
        type="button"
        onClick={onRetry}
        className="font-body text-xs text-[var(--color-primary-700)] bg-transparent border border-[var(--color-primary-500)] rounded-md px-3 py-1 cursor-pointer hover:bg-[var(--color-primary-50)]"
      >
        Retry
      </button>
    </div>
  );
}
