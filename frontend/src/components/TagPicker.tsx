"use client";

import { TAGS } from "@/lib/types";
import { TAG_COLORS } from "@/lib/tags";

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
