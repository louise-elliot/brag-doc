"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { tagColorFor, type TagDef } from "@/lib/tags";

interface EntryListProps {
  entries: Entry[];
  tags: TagDef[];
}

export function EntryList({ entries, tags }: EntryListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (entries.length === 0) {
    return (
      <p style={{ color: "var(--color-text-tertiary)", fontSize: "14px" }}>
        No entries yet
      </p>
    );
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
    <div style={{ position: "relative" }}>
      {entries.map((entry, index) => {
        const isFirst = index === 0;
        const isLast = index === entries.length - 1;

        return (
          <div
            key={entry.id}
            style={{
              position: "relative",
              paddingLeft: "28px",
              paddingBottom: isLast ? "0" : "24px",
            }}
          >
            {/* Timeline line */}
            {!isLast && (
              <div
                style={{
                  position: "absolute",
                  left: "3px",
                  top: "10px",
                  bottom: "0",
                  width: "1px",
                  background: "var(--color-border-subtle)",
                }}
              />
            )}

            {/* Timeline dot */}
            <div
              style={{
                position: "absolute",
                left: "0",
                top: "6px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isFirst
                  ? "var(--color-accent)"
                  : "var(--color-text-tertiary)",
              }}
            />

            {/* Entry content */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  {entry.date}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {entry.tags.map((tag) => {
                    const tagColors = tagColorFor(tags, tag);
                    return (
                      <span
                        key={tag}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          background: tagColors
                            ? tagColors.bg
                            : "var(--color-surface)",
                          color: tagColors
                            ? tagColors.color
                            : "var(--color-text-tertiary)",
                          border: tagColors
                            ? `1px solid ${tagColors.border}`
                            : "1px solid var(--color-border)",
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {entry.original}
              </p>
              {entry.reframed && (
                <>
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--color-accent)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0",
                      marginTop: "8px",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {expanded.has(entry.id) ? "Hide reframed" : "Show reframed"}
                  </button>
                  {expanded.has(entry.id) && (
                    <p
                      style={{
                        color: "var(--color-text-primary)",
                        borderLeft: "2px solid var(--color-accent)",
                        paddingLeft: "12px",
                        marginTop: "8px",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        animation: "fadeIn 0.25s ease both",
                      }}
                    >
                      {entry.reframed}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
