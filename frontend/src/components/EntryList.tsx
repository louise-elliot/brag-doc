"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { tagColorFor, type TagDef } from "@/lib/tags";
import { TagPicker } from "./TagPicker";

interface EntryListProps {
  entries: Entry[];
  tags: TagDef[];
  onEditEntry: (
    id: string,
    updates: { original?: string; tags?: string[] }
  ) => void;
  onDeleteEntry: (id: string) => void;
  onReframeAgain: (id: string) => Promise<void> | void;
}

type ActiveRow = { id: string; mode: "edit" | "delete" } | null;

export function EntryList({
  entries,
  tags,
  onEditEntry,
  onDeleteEntry,
  onReframeAgain,
}: EntryListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeRow, setActiveRow] = useState<ActiveRow>(null);
  const [reframingId, setReframingId] = useState<string | null>(null);
  const [reframeErrorId, setReframeErrorId] = useState<string | null>(null);

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

  async function handleReframeAgain(id: string) {
    setReframingId(id);
    setReframeErrorId(null);
    try {
      await onReframeAgain(id);
    } catch {
      setReframeErrorId(id);
    } finally {
      setReframingId(null);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {entries.map((entry, index) => {
        const isFirst = index === 0;
        const isLast = index === entries.length - 1;
        const isEditing = activeRow?.id === entry.id && activeRow.mode === "edit";
        const isDeleting =
          activeRow?.id === entry.id && activeRow.mode === "delete";

        return (
          <div
            key={entry.id}
            style={{
              position: "relative",
              paddingLeft: "28px",
              paddingBottom: isLast ? "0" : "24px",
            }}
          >
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

            <EntryRowHeader
              date={entry.date}
              tags={entry.tags}
              tagDefs={tags}
              showActions={!isEditing && !isDeleting}
              onEdit={() => setActiveRow({ id: entry.id, mode: "edit" })}
              onDelete={() => setActiveRow({ id: entry.id, mode: "delete" })}
            />

            {isEditing ? (
              <EditEntryForm
                initialText={entry.original}
                initialTags={entry.tags}
                availableTags={tags}
                onSave={(data) => {
                  onEditEntry(entry.id, data);
                  setActiveRow(null);
                }}
                onCancel={() => setActiveRow(null)}
              />
            ) : isDeleting ? (
              <DeleteConfirm
                onConfirm={() => {
                  onDeleteEntry(entry.id);
                  setActiveRow(null);
                }}
                onCancel={() => setActiveRow(null)}
              />
            ) : (
              <EntryRowBody
                entry={entry}
                expanded={expanded.has(entry.id)}
                onToggleReframed={() => toggleExpanded(entry.id)}
                onReframeAgain={() => handleReframeAgain(entry.id)}
                reframing={reframingId === entry.id}
                reframeError={reframeErrorId === entry.id}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface EntryRowHeaderProps {
  date: string;
  tags: string[];
  tagDefs: TagDef[];
  showActions: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryRowHeader({
  date,
  tags,
  tagDefs,
  showActions,
  onEdit,
  onDelete,
}: EntryRowHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-text-tertiary)",
          flexShrink: 0,
        }}
      >
        {date}
      </span>
      <div
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "center",
          marginLeft: "auto",
        }}
      >
        {tags.map((tag) => {
          const tagColors = tagColorFor(tagDefs, tag);
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
        {showActions && (
          <div style={{ display: "flex", gap: "2px", marginLeft: "6px" }}>
            <IconButton
              ariaLabel="Edit entry"
              onClick={onEdit}
              hoverColor="var(--color-accent)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 13.5h11" />
                <path d="M10 3l3 3L5.5 13.5 2 14l.5-3.5L10 3z" />
              </svg>
            </IconButton>
            <IconButton
              ariaLabel="Delete entry"
              onClick={onDelete}
              hoverColor="var(--color-danger)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 4h9" />
                <path d="M6 4V2.5h4V4" />
                <path d="M4.5 4l.5 9h6l.5-9" />
              </svg>
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

interface IconButtonProps {
  ariaLabel: string;
  onClick: () => void;
  hoverColor: string;
  children: React.ReactNode;
}

function IconButton({
  ariaLabel,
  onClick,
  hoverColor,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: "4px",
        cursor: "pointer",
        color: "var(--color-text-tertiary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.15s",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = "var(--color-text-tertiary)";
      }}
    >
      {children}
    </button>
  );
}

interface EntryRowBodyProps {
  entry: Entry;
  expanded: boolean;
  onToggleReframed: () => void;
  onReframeAgain: () => void;
  reframing: boolean;
  reframeError: boolean;
}

function EntryRowBody({
  entry,
  expanded,
  onToggleReframed,
  onReframeAgain,
  reframing,
  reframeError,
}: EntryRowBodyProps) {
  return (
    <div>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {entry.original}
      </p>
      {entry.reframed ? (
        <>
          <button
            onClick={onToggleReframed}
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
            {expanded ? "Hide reframed" : "Show reframed"}
          </button>
          {expanded && (
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
      ) : (
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onReframeAgain}
            disabled={reframing}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-accent)",
              background: "none",
              border: "none",
              cursor: reframing ? "default" : "pointer",
              padding: "0",
              letterSpacing: "0.03em",
              opacity: reframing ? 0.6 : 1,
            }}
          >
            {reframing ? "Reframing..." : "Reframe again"}
          </button>
          {reframeError && (
            <span
              role="alert"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-danger)",
              }}
            >
              Could not reframe
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface EditEntryFormProps {
  initialText: string;
  initialTags: string[];
  availableTags: TagDef[];
  onSave: (data: { original: string; tags: string[] }) => void;
  onCancel: () => void;
}

function EditEntryForm({
  initialText,
  initialTags,
  availableTags,
  onSave,
  onCancel,
}: EditEntryFormProps) {
  const [text, setText] = useState(initialText);
  const [tags, setTags] = useState(initialTags);

  const canSave = text.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({ original: text.trim(), tags });
  }

  return (
    <div
      role="group"
      aria-label="Edit entry"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <textarea
        aria-label="Edit entry text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          color: "var(--color-text-primary)",
          minHeight: "100px",
          resize: "vertical",
          outline: "none",
        }}
      />
      <TagPicker tags={availableTags} selected={tags} onChange={setTags} />
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: "8px 20px",
            background: canSave
              ? "var(--color-accent)"
              : "var(--color-surface-raised)",
            color: canSave
              ? "var(--color-base)"
              : "var(--color-text-tertiary)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: canSave ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div
      style={{
        background: "var(--color-danger-muted)",
        borderRadius: "var(--radius-md)",
        border: "1px solid rgba(207,68,68,0.25)",
        padding: "16px",
        animation: "fadeIn 0.2s ease both",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-danger)",
          marginBottom: "12px",
        }}
      >
        Delete this entry? It can&apos;t be undone.
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            padding: "6px 16px",
            background: "var(--color-danger)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Yes, delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "6px 16px",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
