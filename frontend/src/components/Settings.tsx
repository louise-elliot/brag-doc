"use client";

import { useState } from "react";
import {
  PALETTE,
  isDuplicateName,
  nextUnusedColor,
  type TagDef,
} from "@/lib/tags";

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
