"use client";

import { useEffect, useRef, useState } from "react";
import { CoachMessage } from "./CoachMessage";
import { ReframeView } from "./ReframeView";
import {
  coachReframe,
  coachTurn,
  type CoachMessage as ApiMessage,
} from "@/lib/coachApi";

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

  async function fetchTurn(history: ApiMessage[]) {
    setPhase({ kind: "loading-turn" });
    try {
      const result = await coachTurn({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: history,
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
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-accent-border)",
        borderRadius: "var(--radius-md)",
        animation: "fadeIn 0.25s ease both",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          AI Coach
        </span>
        {phase.kind !== "reframing" && (
          <button
            type="button"
            aria-label="Close coach"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Close
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        {messages.map((m, i) => (
          <CoachMessage key={i} role={m.role} text={m.text} notes={m.notes} />
        ))}

        {phase.kind === "loading-turn" && (
          <p
            role="status"
            aria-live="polite"
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Coach is reading...
          </p>
        )}

        {phase.kind === "loading-reframe" && (
          <p
            role="status"
            aria-live="polite"
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Coach is rewriting...
          </p>
        )}

        {phase.kind === "error-turn" && <ErrorRow onRetry={handleRetryTurn} />}

        {phase.kind === "error-reframe" && (
          <ErrorRow onRetry={handleRetryReframe} />
        )}
      </div>

      {phase.kind === "chatting" && (
        <div style={{ marginTop: "16px" }}>
          <label
            htmlFor={`coach-reply-${entry.id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Your reply
          </label>
          <textarea
            id={`coach-reply-${entry.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              background: "var(--color-base)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!reply.trim()}
              style={{
                padding: "8px 18px",
                background: "var(--color-surface-raised)",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                cursor: reply.trim() ? "pointer" : "not-allowed",
                opacity: reply.trim() ? 1 : 0.5,
              }}
            >
              Send reply
            </button>
            <button
              type="button"
              onClick={() => void fetchReframe()}
              style={{
                padding: "8px 18px",
                background: "var(--color-accent)",
                color: "var(--color-base)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Reframe it now
            </button>
          </div>
        </div>
      )}

      {phase.kind === "reframing" && (
        <div style={{ marginTop: "16px" }}>
          <ReframeView
            original={entry.original}
            reframed={phase.reframed}
            coachNotes={phase.notes}
            onAccept={handleAccept}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </div>
  );
}

interface ErrorRowProps {
  onRetry: () => void;
}

function ErrorRow({ onRetry }: ErrorRowProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "13px",
        color: "var(--color-danger)",
      }}
    >
      <span>Coach didn&apos;t respond. Try again.</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-accent)",
          background: "none",
          border: "1px solid var(--color-accent-border)",
          borderRadius: "var(--radius-sm)",
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
