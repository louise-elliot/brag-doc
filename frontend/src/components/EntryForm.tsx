"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

interface EntryFormProps {
  prompt: string;
  availableTags: TagDef[];
  onSave: (data: { original: string; tags: string[] }) => void;
  onRefreshPrompt?: () => void;
  saving?: boolean;
}

export function EntryForm({
  prompt,
  availableTags,
  onSave,
  onRefreshPrompt,
  saving = false,
}: EntryFormProps) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ original: text.trim(), tags });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    setTimeout(() => {
      setText("");
      setTags([]);
    }, 800);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ paddingTop: "48px", paddingBottom: "40px" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            marginBottom: "16px",
          }}
        >
          Today&apos;s prompt
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div
            style={{
              width: "3px",
              flexShrink: 0,
              borderRadius: "2px",
              background:
                "linear-gradient(to bottom, var(--color-accent), transparent)",
              alignSelf: "stretch",
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "38px",
              fontWeight: 600,
              fontStyle: "italic",
              lineHeight: 1.2,
              color: "var(--color-text-primary)",
              maxWidth: "580px",
              margin: 0,
            }}
          >
            {prompt}
          </p>
          {onRefreshPrompt && (
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                marginTop: "14px",
              }}
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
            >
              <button
                type="button"
                aria-label="Try another prompt"
                onClick={onRefreshPrompt}
                onFocus={() => setTooltipVisible(true)}
                onBlur={() => setTooltipVisible(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text-tertiary)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "color 0.2s, border-color 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--color-accent)";
                  e.currentTarget.style.borderColor = "var(--color-accent-border)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                  e.currentTarget.style.borderColor = "var(--color-border)";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13.5 3.5v3h-3" />
                  <path d="M13.5 6.5A5.5 5.5 0 1 0 14 10" />
                </svg>
              </button>
              {tooltipVisible && (
                <span
                  role="tooltip"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    whiteSpace: "nowrap",
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.03em",
                    color: "var(--color-text-secondary)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  Try another prompt
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write about your win..."
          rows={4}
          style={{
            width: "100%",
            background: "var(--color-surface)",
            border: saved
              ? "1px solid var(--color-positive)"
              : "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "var(--color-text-primary)",
            minHeight: "130px",
            resize: "none",
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <TagPicker tags={availableTags} selected={tags} onChange={setTags} />
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="submit"
            disabled={!text.trim() || saving}
            style={{
              padding: "10px 28px",
              background: saved
                ? "var(--color-positive)"
                : "var(--color-accent)",
              color: saved ? "#fff" : "var(--color-base)",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: text.trim() && !saving ? "pointer" : "not-allowed",
              opacity: text.trim() && !saving ? 1 : 0.4,
              transition: "all 0.2s",
              animation: saved ? "saveFlash 0.6s ease" : "none",
            }}
          >
            {saved ? "Saved" : "Save"}
          </button>
          {saved && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-positive)",
                animation: "saveCheck 0.3s ease both",
              }}
            >
              Win logged
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
