"use client";

import { useEffect, useState } from "react";
import { isDuplicateName, type TagDef } from "@/lib/tags";
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
} from "@/lib/types";
import { readSettings, writeSettings } from "@/lib/settings";
import { getCurrentUser, signOutCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CategoriesCardProps {
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
}

export function CategoriesCard({
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
        Add, rename or delete the tags that can be applied to daily wins.
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

export interface ManageDataCardProps {
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClearData: () => void;
}

export function ManageDataCard({
  confirming,
  onConfirm,
  onCancel,
  onClearData,
}: ManageDataCardProps) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Manage Data
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-4"
        style={{ lineHeight: 1.6 }}
      >
        Delete all your daily win entries.
      </p>
      <div
        role="note"
        className="flex items-start gap-2 bg-[var(--color-warning-50)] border border-[var(--color-warning-500)]/30 rounded-md px-3 py-2 mb-6"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[var(--color-warning-500)] flex-shrink-0 mt-0.5"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <p className="font-body text-sm text-[var(--color-neutral-700)]">
          This action can&apos;t be undone.
        </p>
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={onConfirm}
          className="font-body text-sm font-semibold bg-[var(--color-error-50)] text-[var(--color-error-500)] rounded-md px-6 py-3 hover:bg-[var(--color-error-500)] hover:text-white transition-colors cursor-pointer"
        >
          Delete all entries
        </button>
      ) : (
        <div
          className="bg-[var(--color-error-50)] border border-[var(--color-error-500)] rounded-md p-5"
          style={{ animation: "fadeIn 0.2s ease both" }}
        >
          <p className="font-body text-base text-[var(--color-error-500)] mb-4">
            This deletes all your entries. Your account and settings will be kept.
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

export function ContextCard() {
  const [headline, setHeadline] = useState(DEFAULT_USER_SETTINGS.contextHeadline);
  const [notes, setNotes] = useState(DEFAULT_USER_SETTINGS.contextNotes);

  useEffect(() => {
    let cancelled = false;
    readSettings().then(
      (stored) => {
        if (cancelled) return;
        setHeadline(stored.contextHeadline);
        setNotes(stored.contextNotes);
      },
      () => {
        /* fall back to defaults */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        About You
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-4"
        style={{ lineHeight: 1.6 }}
      >
        Help your coach understand a bit more about where you are, and where you
        want to be.
      </p>
      <div
        role="note"
        className="flex items-start gap-2 bg-[var(--color-warning-50)] border border-[var(--color-warning-500)]/30 rounded-md px-3 py-2 mb-6"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[var(--color-warning-500)] flex-shrink-0 mt-0.5"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <p className="font-body text-sm text-[var(--color-neutral-700)]">
          Please don&apos;t include any personal or sensitive information.
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="font-display text-lg font-medium text-[var(--color-neutral-800)]">
            Job Title
          </span>
          <input
            aria-label="Job Title"
            value={headline}
            placeholder="Senior Software Engineer in financial services"
            onChange={(e) => setHeadline(e.target.value)}
            onBlur={(e) => void writeSettings({ contextHeadline: e.currentTarget.value })}
            className="font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-lg font-medium text-[var(--color-neutral-800)]">
            What else do you want your coach to know?
          </span>
          <textarea
            aria-label="What else do you want your coach to know?"
            value={notes}
            placeholder="e.g. what are your career aspirations?"
            rows={5}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => void writeSettings({ contextNotes: e.currentTarget.value })}
            className="font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none min-h-[120px] resize-y placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
            style={{ lineHeight: 1.6 }}
          />
        </label>
      </div>
    </section>
  );
}

export function CoachingStyleCard() {
  const [style, setStyle] = useState<CoachingStyle>(
    DEFAULT_USER_SETTINGS.coachingStyle
  );

  useEffect(() => {
    let cancelled = false;
    readSettings().then(
      (stored) => {
        if (!cancelled) setStyle(stored.coachingStyle);
      },
      () => {
        /* fall back to defaults */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function pick(next: CoachingStyle) {
    setStyle(next);
    void writeSettings({ coachingStyle: next });
  }

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Coach Persona
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        Choose the coaching style that works best for you.
      </p>
      <div
        role="radiogroup"
        aria-label="Coach Persona"
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
              <div
                className="font-body text-sm italic text-[var(--color-neutral-500)] mt-1"
                style={{ lineHeight: 1.5 }}
              >
                {option.tagline}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface PrivacyCardProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function PrivacyCard({ value, onChange }: PrivacyCardProps) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Consent
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        Coach and Brag Doc features are powered by AI.
        <br />
        To use these features, please accept the acknowledgement below.
      </p>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1"
        />
        <span
          className="font-body text-base text-[var(--color-neutral-700)]"
          style={{ lineHeight: 1.6 }}
        >
          I understand that to use the Coach and Brag Doc features, my daily
          wins entries will be sent to Anthropic.
        </span>
      </label>
    </section>
  );
}

export function AccountCard({
  onReplayWelcome,
}: {
  onReplayWelcome: () => void;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then(
      (u) => {
        if (!cancelled) setEmail(u?.email ?? null);
      },
      () => {
        /* ignore */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await signOutCurrentUser();
    window.location.href = "/sign-in";
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const client = getSupabaseBrowserClient();
    const { error } = await client.functions.invoke("delete-account");
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    await client.auth.signOut();
    window.location.href = "/sign-in?deleted=1";
  }

  const deleteDisabled = !email || confirmEmail !== email || deleting;

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Account
      </h3>
      {email && (
        <p
          className="font-body text-base text-[var(--color-neutral-600)] mb-6"
          style={{ lineHeight: 1.6 }}
        >
          {email}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteAccount(true)}
          className="font-body text-sm font-semibold bg-transparent border border-[var(--color-error-500)] text-[var(--color-error-500)] rounded-md px-6 py-3 hover:bg-[var(--color-error-50)] transition-colors cursor-pointer"
        >
          Delete account
        </button>
        <button
          type="button"
          onClick={onReplayWelcome}
          className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
        >
          Replay welcome tour
        </button>
      </div>
      {showDeleteAccount && (
        <div
          role="dialog"
          aria-label="Confirm delete account"
          className="mt-4 bg-[var(--color-error-50)] border border-[var(--color-error-500)] rounded-md p-5"
          style={{ animation: "fadeIn 0.2s ease both" }}
        >
          <p className="font-body text-base text-[var(--color-error-500)] mb-4">
            This permanently deletes your entries, settings, and account. Type
            your email to confirm.
          </p>
          <label className="flex flex-col gap-2 mb-4">
            <span className="font-body text-sm font-medium text-[var(--color-neutral-700)]">
              Type your email
            </span>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="font-body text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-error-500)] focus:ring-2 focus:ring-[var(--color-error-50)]"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteDisabled}
              className={[
                "font-body text-sm font-semibold rounded-md px-6 py-3 transition-opacity",
                deleteDisabled
                  ? "bg-[var(--color-error-500)] text-white opacity-50 cursor-not-allowed"
                  : "bg-[var(--color-error-500)] text-white hover:opacity-90 cursor-pointer",
              ].join(" ")}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteAccount(false);
                setConfirmEmail("");
                setDeleteError(null);
              }}
              className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {deleteError && (
            <p
              role="alert"
              className="font-body text-sm text-[var(--color-error-500)] mt-3"
            >
              {deleteError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
