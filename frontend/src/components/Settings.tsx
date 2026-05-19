"use client";

import { useEffect, useState } from "react";
import { isDuplicateName, type TagDef } from "@/lib/tags";
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
} from "@/lib/types";
import { readSettings, writeSettings } from "@/lib/settings";

interface SettingsProps {
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onClearData: () => void;
}

export function Settings({
  tags,
  onAddTag,
  onDeleteTag,
  onRenameTag,
  onClearData,
}: SettingsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="pt-12 flex flex-col gap-12">
      <CoachingStyleCard />
      <ContextCard />
      <CategoriesCard
        tags={tags}
        onAddTag={onAddTag}
        onDeleteTag={onDeleteTag}
        onRenameTag={onRenameTag}
      />
      <DataCard
        confirming={confirming}
        onConfirm={() => setConfirming(true)}
        onCancel={() => setConfirming(false)}
        onClearData={() => {
          onClearData();
          setConfirming(false);
        }}
      />
    </div>
  );
}

interface CategoriesCardProps {
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
}

function CategoriesCard({
  tags,
  onAddTag,
  onDeleteTag,
  onRenameTag,
}: CategoriesCardProps) {
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");

  const trimmed = newName.trim();
  const addDisabled = trimmed.length === 0 || isDuplicateName(tags, trimmed);

  function submitNew() {
    if (addDisabled) return;
    onAddTag(trimmed);
    setNewName("");
  }

  function startEditing(tag: TagDef) {
    setEditingName(tag.name);
    setEditingDraft(tag.name);
  }

  function commitEditing() {
    if (!editingName) return;
    const nextName = editingDraft.trim();
    const isSame = nextName === editingName;
    const invalid = !nextName || isDuplicateName(tags, nextName, editingName);
    if (!isSame && !invalid) {
      onRenameTag(editingName, nextName);
    }
    setEditingName(null);
    setEditingDraft("");
  }

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Categories
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        These are the tags you can apply to entries. Deleting a category removes
        it from the picker — past entries keep their tag. Renaming updates the
        tag on every entry that had it.
      </p>

      {tags.length === 0 ? (
        <p className="font-body text-sm italic text-[var(--color-neutral-500)] mb-6">
          No categories yet — add one below.
        </p>
      ) : (
        <ul className="flex flex-col mb-6">
          {tags.map((tag) => {
            const isEditing = editingName === tag.name;
            return (
              <li
                key={tag.name}
                className="flex items-center gap-3 py-3 border-b border-[var(--color-neutral-200)]"
              >
                {isEditing ? (
                  <input
                    autoFocus
                    aria-label={`Rename ${tag.name}`}
                    value={editingDraft}
                    onChange={(e) => setEditingDraft(e.target.value)}
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditing();
                      }
                      if (e.key === "Escape") {
                        setEditingName(null);
                        setEditingDraft("");
                      }
                    }}
                    className="flex-1 font-body text-base text-[var(--color-neutral-800)] bg-white border border-[var(--color-primary-500)] rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(tag)}
                    aria-label={`Rename ${tag.name}`}
                    className="flex-1 text-left font-body text-base text-[var(--color-neutral-800)] cursor-text bg-transparent border-none"
                  >
                    {tag.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteTag(tag.name)}
                  aria-label={`Delete ${tag.name}`}
                  className="font-body text-sm font-medium text-[var(--color-error-500)] hover:bg-[var(--color-error-50)] rounded-md px-3 py-2 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          aria-label="New category name"
          placeholder="New category name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNew();
            }
          }}
          className="flex-1 font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
        />
        <button
          type="button"
          onClick={submitNew}
          disabled={addDisabled}
          className={[
            "font-body text-sm font-semibold rounded-md px-6 py-3 transition-colors",
            addDisabled
              ? "bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed"
              : "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] cursor-pointer",
          ].join(" ")}
        >
          Add
        </button>
      </div>
      {trimmed.length > 0 && isDuplicateName(tags, trimmed) && (
        <p role="alert" className="font-body text-sm text-[var(--color-error-500)] mt-3">
          A category with this name already exists.
        </p>
      )}
    </section>
  );
}

interface DataCardProps {
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClearData: () => void;
}

function DataCard({
  confirming,
  onConfirm,
  onCancel,
  onClearData,
}: DataCardProps) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Data
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        Your journal entries are stored locally in this browser. Entry text is
        sent to Anthropic only when you reframe an entry or generate a brag doc,
        and is not stored on our servers.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={onConfirm}
          className="font-body text-sm font-semibold bg-[var(--color-error-50)] text-[var(--color-error-500)] rounded-md px-6 py-3 hover:bg-[var(--color-error-500)] hover:text-white transition-colors cursor-pointer"
        >
          Clear all data
        </button>
      ) : (
        <div
          className="bg-[var(--color-error-50)] border border-[var(--color-error-500)] rounded-md p-5"
          style={{ animation: "fadeIn 0.2s ease both" }}
        >
          <p className="font-body text-base text-[var(--color-error-500)] mb-4">
            This will permanently delete all your journal entries.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClearData}
              className="font-body text-sm font-semibold bg-[var(--color-error-500)] text-white rounded-md px-6 py-3 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ContextCard() {
  const [headline, setHeadline] = useState(DEFAULT_USER_SETTINGS.contextHeadline);
  const [notes, setNotes] = useState(DEFAULT_USER_SETTINGS.contextNotes);

  useEffect(() => {
    const stored = readSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    setHeadline(stored.contextHeadline);
    setNotes(stored.contextNotes);
  }, []);

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Your context
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        Helps the coach speak to where you are. None of this leaves your browser
        unless an entry is being reframed or a brag doc is being generated.
      </p>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="font-body text-sm font-medium text-[var(--color-neutral-700)]">
            Headline
          </span>
          <input
            aria-label="Headline"
            value={headline}
            placeholder="e.g. Senior backend engineer at a fintech series-B"
            onChange={(e) => setHeadline(e.target.value)}
            onBlur={(e) => writeSettings({ contextHeadline: e.currentTarget.value })}
            className="font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-body text-sm font-medium text-[var(--color-neutral-700)]">
            What else should the coach know?
          </span>
          <textarea
            aria-label="What else should the coach know?"
            value={notes}
            placeholder="What are you working towards? What's invisible in your org? What does your manager value?"
            rows={5}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => writeSettings({ contextNotes: e.currentTarget.value })}
            className="font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none min-h-[120px] resize-y placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
            style={{ lineHeight: 1.6 }}
          />
        </label>
      </div>
    </section>
  );
}

function CoachingStyleCard() {
  const [style, setStyle] = useState<CoachingStyle>(
    DEFAULT_USER_SETTINGS.coachingStyle
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    setStyle(readSettings().coachingStyle);
  }, []);

  function pick(next: CoachingStyle) {
    setStyle(next);
    writeSettings({ coachingStyle: next });
  }

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Coaching style
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        Pick the voice that works best for you. You can change this any time.
      </p>
      <div
        role="radiogroup"
        aria-label="Coaching style"
        className="flex flex-col gap-3"
      >
        {COACHING_STYLE_OPTIONS.map((option) => {
          const selected = style === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              onClick={() => pick(option.key)}
              className={[
                "text-left rounded-md px-5 py-4 border transition-colors cursor-pointer",
                selected
                  ? "bg-[var(--color-primary-50)] border-[var(--color-primary-500)]"
                  : "bg-white border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]",
              ].join(" ")}
            >
              <div className="font-display text-lg font-semibold text-[var(--color-neutral-800)] mb-1">
                {option.label}
              </div>
              <div
                className="font-body text-sm text-[var(--color-neutral-600)]"
                style={{ lineHeight: 1.5 }}
              >
                {option.descriptor}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
