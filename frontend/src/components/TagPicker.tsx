"use client";

import { TAGS } from "@/lib/types";

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  leadership: { color: "#D4863C", bg: "rgba(212,134,60,0.12)", border: "rgba(212,134,60,0.3)" },
  technical: { color: "#6B8AE0", bg: "rgba(107,138,224,0.12)", border: "rgba(107,138,224,0.3)" },
  collaboration: { color: "#4CAF82", bg: "rgba(76,175,130,0.12)", border: "rgba(76,175,130,0.3)" },
  "problem-solving": { color: "#C978D6", bg: "rgba(201,120,214,0.12)", border: "rgba(201,120,214,0.3)" },
  communication: { color: "#E0C46B", bg: "rgba(224,196,107,0.12)", border: "rgba(224,196,107,0.3)" },
  mentoring: { color: "#E07272", bg: "rgba(224,114,114,0.12)", border: "rgba(224,114,114,0.3)" },
};

interface TagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {TAGS.map((tag) => {
        const isSelected = selected.includes(tag);
        const colors = TAG_COLORS[tag];
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: isSelected
                ? `1px solid ${colors.border}`
                : "1px solid var(--color-border)",
              background: isSelected ? colors.bg : "var(--color-surface)",
              color: isSelected ? colors.color : "var(--color-text-tertiary)",
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
