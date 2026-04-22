"use client";

import { useState } from "react";

interface SettingsProps {
  onClearData: () => void;
}

export function Settings({ onClearData }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ paddingTop: "48px" }}>
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "28px",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
            marginBottom: "16px",
          }}
        >
          Data Management
        </h3>
        <p
          style={{
            fontSize: "14px",
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          Your journal entries are stored locally in this browser. Entry text
          is sent to Anthropic only when you reframe an entry or generate a
          brag doc, and is not stored on our servers.
        </p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{
              padding: "8px 20px",
              background: "var(--color-danger-muted)",
              color: "var(--color-danger)",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(207,68,68,0.25)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            Clear all data
          </button>
        ) : (
          <div
            style={{
              background: "var(--color-danger-muted)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(207,68,68,0.25)",
              padding: "20px",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "var(--color-danger)",
                marginBottom: "16px",
              }}
            >
              This will permanently delete all your journal entries.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  onClearData();
                  setConfirming(false);
                }}
                style={{
                  padding: "8px 20px",
                  background: "var(--color-danger)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                Yes, delete everything
              </button>
              <button
                onClick={() => setConfirming(false)}
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
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
