"use client";

import { TAGS } from "@/lib/types";

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
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
            selected.includes(tag)
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
