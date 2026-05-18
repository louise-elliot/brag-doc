"use client";

import { useEffect, useState } from "react";
import {
  PALETTE,
  isDuplicateName,
  nextUnusedColor,
  type TagDef,
} from "@/lib/tags";
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
} from "@/lib/types";
import { readSettings, writeSettings } from "@/lib/settings";

interface SettingsProps {
  tags: TagDef[];
  onAddTag: (name: string, color: string) => void;
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
    <div style={{ paddingTop: "48px", display: "flex", flexDirection: "column", gap: "24px" }}>
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
  onAddTag: (name: string, color: string) => void;
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
  const [newColor, setNewColor] = useState<string>(() => nextUnusedColor(tags));
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");

  const trimmed = newName.trim();
  const addDisabled =
    trimmed.length === 0 || isDuplicateName(tags, trimmed);

  function submitNew() {
    if (addDisabled) return;
    onAddTag(trimmed, newColor);
    setNewName("");
    setNewColor(nextUnusedColor([...tags, { name: trimmed, color: newColor }]));
  }

  function startEditing(tag: TagDef) {
    setEditingName(tag.name);
    setEditingDraft(tag.name);
  }

  function commitEditing() {
    if (!editingName) return;
    const nextName = editingDraft.trim();
    const isSame = nextName === editingName;
    const invalid =
      !nextName || isDuplicateName(tags, nextName, editingName);
    if (!isSame && !invalid) {
      onRenameTag(editingName, nextName);
    }
    setEditingName(null);
    setEditingDraft("");
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Categories
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "24px",
        }}
      >
        These are the tags you can apply to entries. Deleting a category removes
        it from the picker — past entries keep their tag. Renaming updates the
        tag on every entry that had it.
      </p>

      {tags.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-tertiary)",
            fontStyle: "italic",
            marginBottom: "20px",
          }}
        >
          No categories yet — add one below.
        </p>
      ) : (
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginBottom: "24px",
          }}
        >
          {tags.map((tag) => {
            const isEditing = editingName === tag.name;
            return (
              <li
                key={tag.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: tag.color,
                    flexShrink: 0,
                  }}
                />
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
                    style={{
                      flex: 1,
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-accent-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "4px 10px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(tag)}
                    aria-label={`Rename ${tag.name}`}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "4px 0",
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      color: "var(--color-text-primary)",
                      cursor: "text",
                    }}
                  >
                    {tag.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteTag(tag.name)}
                  aria-label={`Delete ${tag.name}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-tertiary)",
                    cursor: "pointer",
                    fontSize: "16px",
                    lineHeight: 1,
                    padding: "4px 8px",
                    transition: "color 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = "var(--color-danger)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = "var(--color-text-tertiary)";
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
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
            style={{
              flex: 1,
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={addDisabled}
            style={{
              padding: "8px 20px",
              background: addDisabled
                ? "var(--color-surface-raised)"
                : "var(--color-accent)",
              color: addDisabled
                ? "var(--color-text-tertiary)"
                : "var(--color-base)",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: addDisabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            Add
          </button>
        </div>
        <div
          role="radiogroup"
          aria-label="Category color"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {PALETTE.map((hex) => {
            const selected = hex === newColor;
            return (
              <button
                key={hex}
                role="radio"
                aria-checked={selected}
                aria-label={`Color ${hex}`}
                type="button"
                onClick={() => setNewColor(hex)}
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: hex,
                  border: selected
                    ? "2px solid var(--color-text-primary)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                  transition: "border-color 0.15s",
                }}
              />
            );
          })}
        </div>
        {trimmed.length > 0 && isDuplicateName(tags, trimmed) && (
          <p
            role="alert"
            style={{
              fontSize: "12px",
              color: "var(--color-danger)",
              margin: 0,
            }}
          >
            A category with this name already exists.
          </p>
        )}
      </div>
    </div>
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
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Data Management
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "24px",
        }}
      >
        Your journal entries are stored locally in this browser. Entry text is
        sent to Anthropic only when you reframe an entry or generate a brag
        doc, and is not stored on our servers.
      </p>

      {!confirming ? (
        <button
          onClick={onConfirm}
          style={{
            padding: "8px 20px",
            background: "var(--color-danger-muted)",
            color: "var(--color-danger)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(207,68,68,0.25)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Clear all data
        </button>
      ) : (
        <div
          style={{
            background: "var(--color-danger-muted)",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(207,68,68,0.25)",
            padding: "20px",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-danger)",
              marginBottom: "16px",
            }}
          >
            This will permanently delete all your journal entries.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClearData}
              style={{
                padding: "8px 20px",
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
              Yes, delete everything
            </button>
            <button
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
      )}
    </div>
  );
}

function ContextCard() {
  const [headline, setHeadline] = useState(
    DEFAULT_USER_SETTINGS.contextHeadline
  );
  const [notes, setNotes] = useState(DEFAULT_USER_SETTINGS.contextNotes);

  useEffect(() => {
    const stored = readSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    setHeadline(stored.contextHeadline);
    setNotes(stored.contextNotes);
  }, []);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Your Context
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        Helps the coach speak to where you are. None of this leaves your
        browser unless an entry is being reframed or a brag doc is being
        generated.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            Headline
          </span>
          <input
            aria-label="Headline"
            value={headline}
            placeholder="e.g. Senior backend engineer at a fintech series-B"
            onChange={(e) => setHeadline(e.target.value)}
            onBlur={(e) => writeSettings({ contextHeadline: e.currentTarget.value })}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </label>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            What else should the coach know?
          </span>
          <textarea
            aria-label="What else should the coach know?"
            value={notes}
            placeholder="What are you working towards? What's invisible in your org? What does your manager value?"
            rows={5}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => writeSettings({ contextNotes: e.currentTarget.value })}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              outline: "none",
              resize: "vertical",
              minHeight: "100px",
            }}
          />
        </label>
      </div>
    </div>
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
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Coaching Style
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        Pick the voice that works best for you. You can change this any time.
      </p>
      <div
        role="radiogroup"
        aria-label="Coaching style"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
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
              style={{
                textAlign: "left",
                padding: "16px 18px",
                background: selected
                  ? "var(--color-accent-muted)"
                  : "transparent",
                border: selected
                  ? "1px solid var(--color-accent-border)"
                  : "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: "4px",
                }}
              >
                {option.label}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {option.descriptor}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
