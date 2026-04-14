"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";

interface EntryFormProps {
  prompt: string;
  onSave: (data: { original: string; tags: string[] }) => void;
}

export function EntryForm({ prompt, onSave }: EntryFormProps) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ original: text.trim(), tags });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    setText("");
    setTags([]);
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
        <div style={{ display: "flex", gap: "16px" }}>
          <div
            style={{
              width: "3px",
              flexShrink: 0,
              borderRadius: "2px",
              background:
                "linear-gradient(to bottom, var(--color-accent), transparent)",
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
            }}
          >
            {prompt}
          </p>
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
        <TagPicker selected={tags} onChange={setTags} />
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="submit"
            disabled={!text.trim()}
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
              cursor: text.trim() ? "pointer" : "not-allowed",
              opacity: text.trim() ? 1 : 0.4,
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
