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
              "font-body text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors border inline-flex items-center gap-1.5",
              isSelected
                ? "bg-[var(--color-primary-500)] border-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] hover:border-[var(--color-primary-600)]"
                : "bg-white border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] hover:border-[var(--color-neutral-400)]",
            ].join(" ")}
          >
            {isSelected && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8l3 3 7-7" />
              </svg>
            )}
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
