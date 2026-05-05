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
    <div
      style={{
        position: "relative",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-accent-border)",
        overflow: "hidden",
        animation: "reframeReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div
        style={{
          height: "2px",
          background:
            "linear-gradient(to right, var(--color-accent), transparent)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px 0",
        }}
      >
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
          AI Reframe
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.05em",
          }}
        >
          side-by-side
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "0",
          padding: "20px 24px",
        }}
      >
        <div style={{ paddingRight: "20px" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              marginBottom: "10px",
            }}
          >
            Your version
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-tertiary)",
              lineHeight: 1.6,
            }}
          >
            {original}
          </p>
        </div>

        <div
          style={{
            width: "1px",
            background:
              "linear-gradient(to bottom, var(--color-accent-border), var(--color-border-subtle))",
          }}
        />

        <div style={{ paddingLeft: "20px" }}>
          <label
            htmlFor="reframe-edit"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: "10px",
              display: "block",
            }}
          >
            Reframed
          </label>
          <textarea
            id="reframe-edit"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px dashed var(--color-accent-border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "0 24px 20px",
        }}
      >
        <button
          onClick={() => onAccept(edited)}
          style={{
            padding: "8px 20px",
            background: "var(--color-accent)",
            color: "var(--color-base)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "8px 20px",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Dismiss
        </button>
      </div>

      {coachNotes && coachNotes.length > 0 && (
        <div
          style={{
            padding: "16px 24px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            What the coach noticed
          </span>
          <CoachNotePills notes={coachNotes} />
        </div>
      )}
    </div>
  );
}
