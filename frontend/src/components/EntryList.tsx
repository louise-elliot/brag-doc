"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

interface EntryListProps {
  entries: Entry[];
}

export function EntryList({ entries }: EntryListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (entries.length === 0) {
    return <p className="text-gray-500">No entries yet</p>;
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="border border-gray-800 rounded-lg p-4 space-y-2"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{entry.date}</span>
            <div className="flex gap-2">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-gray-300">{entry.original}</p>
          {entry.reframed && (
            <>
              <button
                onClick={() => toggleExpanded(entry.id)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {expanded.has(entry.id) ? "Hide reframed" : "Show reframed"}
              </button>
              {expanded.has(entry.id) && (
                <p className="text-white border-l-2 border-purple-600 pl-3">
                  {entry.reframed}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
