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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ original: text.trim(), tags });
    setText("");
    setTags([]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-lg font-semibold text-white">{prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write about your win..."
        rows={4}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
      />
      <TagPicker selected={tags} onChange={setTags} />
      <button
        type="submit"
        disabled={!text.trim()}
        className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
      >
        Save
      </button>
    </form>
  );
}
