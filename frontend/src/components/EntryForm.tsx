"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

interface EntryFormProps {
  prompt: string;
  availableTags: TagDef[];
  onSave: (data: { original: string; tags: string[] }) => void;
  onRefreshPrompt?: () => void;
}

export function EntryForm({
  prompt,
  availableTags,
  onSave,
  onRefreshPrompt,
}: EntryFormProps) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

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
    <form onSubmit={handleSubmit} className="pt-12">
      <p className="font-display text-4xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-4">
        {prompt}
      </p>
      {onRefreshPrompt && (
        <button
          type="button"
          onClick={onRefreshPrompt}
          aria-label="Try another prompt"
          className="font-body text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] rounded-md px-3 py-2 transition-colors cursor-pointer mb-8 -ml-3"
        >
          Try another prompt
        </button>
      )}

      <div className="flex flex-col gap-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write about your win..."
          rows={5}
          className={[
            "w-full font-body text-lg rounded-md outline-none resize-none transition-colors",
            "px-5 py-4 min-h-[120px] border placeholder:text-[var(--color-neutral-400)] text-[var(--color-neutral-700)]",
            text
              ? "bg-white border-[var(--color-neutral-300)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
              : "bg-[var(--color-neutral-50)] border-[var(--color-neutral-300)] focus:bg-white focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]",
          ].join(" ")}
          style={{ lineHeight: 1.75 }}
        />
        <TagPicker tags={availableTags} selected={tags} onChange={setTags} />
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span
              className="font-body text-sm text-[var(--color-success-500)]"
              style={{ animation: "saveCheck 0.3s ease both" }}
            >
              Win logged
            </span>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className={[
              "font-body text-sm font-semibold rounded-md px-6 py-3 transition-colors",
              text.trim()
                ? "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] cursor-pointer"
                : "bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed",
            ].join(" ")}
            style={{
              animation: saved ? "saveFlash 0.6s ease" : "none",
            }}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
