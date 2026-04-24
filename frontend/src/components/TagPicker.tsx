"use client";

import { tagColorFromHex, type TagDef } from "@/lib/tags";

interface TagPickerProps {
  tags: TagDef[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ tags, selected, onChange }: TagPickerProps) {
  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((t) => t !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.name);
        const colors = tagColorFromHex(tag.color);
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggle(tag.name)}
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
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
