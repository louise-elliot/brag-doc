"use client";

import type { TagDef } from "@/lib/tags";

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
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.name);
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggle(tag.name)}
            aria-pressed={isSelected}
            className={[
              "font-[var(--font-body)] text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors",
              isSelected
                ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]",
            ].join(" ")}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
