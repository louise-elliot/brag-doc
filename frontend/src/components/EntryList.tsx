"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import type { TagDef } from "@/lib/tags";
import { TagPicker } from "./TagPicker";
import { CoachPanel } from "./CoachPanel";
import { CoachNotePills } from "./CoachNotePills";

interface EntryListProps {
  entries: Entry[];
  tags: TagDef[];
  onEditEntry: (
    id: string,
    updates: { original?: string; reframed?: string; tags?: string[] }
  ) => void;
  onDeleteEntry: (id: string) => void;
  onCoachAccept: (entryId: string, reframed: string, notes: string[]) => void;
  onCoachDismiss: (entryId: string) => void;
}

type ActiveRow = { id: string; mode: "edit" | "delete" } | null;

export function EntryList({
  entries,
  tags,
  onEditEntry,
  onDeleteEntry,
  onCoachAccept,
  onCoachDismiss,
}: EntryListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeRow, setActiveRow] = useState<ActiveRow>(null);
  const [coachOpenId, setCoachOpenId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-2">
          No wins yet
        </p>
        <p className="font-body text-base text-[var(--color-neutral-500)]">
          They&apos;ll be here when you&apos;re ready.
        </p>
      </div>
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
    <div className="flex flex-col gap-6">
      {entries.map((entry) => {
        const isEditing = activeRow?.id === entry.id && activeRow.mode === "edit";
        const isDeleting =
          activeRow?.id === entry.id && activeRow.mode === "delete";

        return (
          <article
            key={entry.id}
            className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            style={{ transition: "var(--transition-base)" }}
          >
            <EntryRowHeader
              date={entry.date}
              tags={entry.tags}
              showActions={!isEditing && !isDeleting}
              onEdit={() => setActiveRow({ id: entry.id, mode: "edit" })}
              onDelete={() => setActiveRow({ id: entry.id, mode: "delete" })}
            />

            {isEditing ? (
              <EditEntryForm
                initialText={entry.reframed ?? entry.original}
                initialTags={entry.tags}
                availableTags={tags}
                onSave={(data) => {
                  const textKey = entry.reframed !== null ? "reframed" : "original";
                  onEditEntry(entry.id, {
                    [textKey]: data.original,
                    tags: data.tags,
                  });
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
              <>
                <EntryRowBody
                  entry={entry}
                  expanded={expanded.has(entry.id)}
                  onToggleOriginal={() => toggleExpanded(entry.id)}
                />
                {entry.coachNotes === null && coachOpenId !== entry.id && (
                  <button
                    type="button"
                    onClick={() => setCoachOpenId(entry.id)}
                    className="font-body text-sm font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] rounded-md px-3 py-2 mt-3 transition-colors cursor-pointer -ml-3"
                  >
                    Coach me
                  </button>
                )}
                {coachOpenId === entry.id && (
                  <CoachPanel
                    entry={{
                      id: entry.id,
                      original: entry.original,
                      prompt: entry.prompt,
                      tags: entry.tags,
                    }}
                    onAccept={(reframed, notes) => {
                      onCoachAccept(entry.id, reframed, notes);
                      setCoachOpenId(null);
                    }}
                    onDismiss={() => {
                      onCoachDismiss(entry.id);
                      setCoachOpenId(null);
                    }}
                    onClose={() => setCoachOpenId(null)}
                  />
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

interface EntryRowHeaderProps {
  date: string;
  tags: string[];
  showActions: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryRowHeader({
  date,
  tags,
  showActions,
  onEdit,
  onDelete,
}: EntryRowHeaderProps) {
  return (
    <header className="flex items-baseline justify-between gap-4 mb-3">
      <time
        dateTime={date}
        className="font-display text-lg font-medium text-[var(--color-neutral-800)]"
      >
        {date}
      </time>
      <div className="flex flex-wrap gap-2 items-center justify-end">
        {tags.map((tag) => (
          <span
            key={tag}
            className="font-body text-xs font-medium px-3 py-1 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]"
          >
            {tag}
          </span>
        ))}
        {showActions && (
          <div className="flex gap-0.5 ml-1.5">
            <IconButton ariaLabel="Edit entry" onClick={onEdit}>
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
            <IconButton ariaLabel="Delete entry" onClick={onDelete} danger>
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
    </header>
  );
}

interface IconButtonProps {
  ariaLabel: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}

function IconButton({ ariaLabel, onClick, danger, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`p-1 rounded inline-flex items-center justify-center transition-colors cursor-pointer ${
        danger
          ? "text-[var(--color-neutral-400)] hover:text-[var(--color-error-500)] hover:bg-[var(--color-error-50)]"
          : "text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]"
      }`}
    >
      {children}
    </button>
  );
}

interface EntryRowBodyProps {
  entry: Entry;
  expanded: boolean;
  onToggleOriginal: () => void;
}

function EntryRowBody({
  entry,
  expanded,
  onToggleOriginal,
}: EntryRowBodyProps) {
  if (!entry.reframed) {
    return (
      <p
        className="font-body text-base text-[var(--color-neutral-700)]"
        style={{ lineHeight: 1.75 }}
      >
        {entry.original}
      </p>
    );
  }

  return (
    <div>
      <p
        className="font-body text-base text-[var(--color-neutral-700)]"
        style={{ lineHeight: 1.75 }}
      >
        {entry.reframed}
      </p>
      <button
        type="button"
        onClick={onToggleOriginal}
        className="font-body text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] rounded-md px-3 py-2 mt-3 transition-colors cursor-pointer -ml-3"
      >
        {expanded ? "Hide original" : "Show original"}
      </button>
      {expanded && (
        <div
          className="border-l-2 border-[var(--color-neutral-300)] pl-3 mt-2"
          style={{ animation: "fadeIn 0.25s ease both" }}
        >
          <p
            className="font-body text-base text-[var(--color-neutral-600)]"
            style={{ lineHeight: 1.75 }}
          >
            {entry.original}
          </p>
          {entry.coachNotes && entry.coachNotes.length > 0 && (
            <div className="mt-3">
              <CoachNotePills notes={entry.coachNotes} />
            </div>
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
      className="flex flex-col gap-3"
    >
      <textarea
        aria-label="Edit entry text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none resize-y min-h-[100px] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
        style={{ lineHeight: 1.6 }}
      />
      <TagPicker tags={availableTags} selected={tags} onChange={setTags} />
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`font-body text-sm font-semibold rounded-md px-6 py-3 transition-colors ${
            canSave
              ? "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] cursor-pointer"
              : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)] cursor-not-allowed"
          }`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-sm font-medium text-[var(--color-neutral-700)] border border-[var(--color-neutral-300)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
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
      className="bg-[var(--color-error-50)] rounded-lg border border-[var(--color-error-500)]/25 p-4"
      style={{ animation: "fadeIn 0.2s ease both" }}
    >
      <p className="font-body text-sm text-[var(--color-error-500)] mb-3">
        Delete this entry? It can&apos;t be undone.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          className="font-body text-sm font-semibold bg-[var(--color-error-500)] text-white rounded-md px-4 py-1.5 hover:opacity-90 transition-opacity cursor-pointer"
        >
          Yes, delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-sm font-medium text-[var(--color-neutral-700)] border border-[var(--color-neutral-300)] rounded-md px-4 py-1.5 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
