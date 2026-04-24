"use client";

import { useState, useCallback, useEffect } from "react";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
import { ReframeView } from "./ReframeView";
import { BragDoc } from "./BragDoc";
import { Settings } from "./Settings";
import {
  getEntries,
  addEntry,
  updateEntry,
  deleteAllEntries,
  deleteEntry,
  editEntry,
  renameTagOnEntries,
} from "@/lib/entries";
import { getPromptForDate, getRandomPromptExcluding } from "@/lib/prompts";
import { getTags, saveTags, type TagDef } from "@/lib/tags";
import { todayLocal } from "@/lib/dates";
import type { Entry } from "@/lib/types";

type Tab = "journal" | "bragdoc" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "journal", label: "Journal" },
  { key: "bragdoc", label: "Brag Doc" },
  { key: "settings", label: "Settings" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("journal");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reframing, setReframing] = useState<{
    entryId: string;
    original: string;
    reframed: string;
  } | null>(null);
  const [reframeLoading, setReframeLoading] = useState(false);
  const [reframeError, setReframeError] = useState<string | null>(null);

  const today = todayLocal();
  const [prompt, setPrompt] = useState<string>(() => getPromptForDate(today));

  function handleRefreshPrompt() {
    setPrompt((current) => getRandomPromptExcluding(current));
  }

  const [tags, setTags] = useState<TagDef[]>([]);

  const refreshEntries = useCallback(() => {
    setEntries(getEntries());
  }, []);

  const refreshTags = useCallback(() => {
    setTags(getTags());
  }, []);

  useEffect(() => {
    refreshEntries();
    refreshTags();
  }, [refreshEntries, refreshTags]);

  function handleAddTag(name: string, color: string) {
    const next = [...tags, { name, color }];
    saveTags(next);
    setTags(next);
  }

  function handleDeleteTag(name: string) {
    const next = tags.filter((t) => t.name !== name);
    saveTags(next);
    setTags(next);
  }

  function handleRenameTag(oldName: string, newName: string) {
    const next = tags.map((t) =>
      t.name === oldName ? { ...t, name: newName } : t
    );
    saveTags(next);
    renameTagOnEntries(oldName, newName);
    setTags(next);
    refreshEntries();
  }

  async function handleSave(data: { original: string; tags: string[] }) {
    const entry = addEntry({
      date: today,
      prompt,
      original: data.original,
      reframed: null,
      tags: data.tags,
    });
    refreshEntries();

    setReframeLoading(true);
    setReframeError(null);
    try {
      const response = await fetch("/api/reframe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.original }),
      });
      if (!response.ok) throw new Error("Reframe failed");
      const result = await response.json();
      updateEntry(entry.id, { reframed: result.reframed });
      refreshEntries();
      setReframing({
        entryId: entry.id,
        original: data.original,
        reframed: result.reframed,
      });
    } catch {
      setReframeError("Could not reframe your entry. It has been saved as-is.");
    } finally {
      setReframeLoading(false);
    }
  }

  function handleAcceptReframe(finalText: string) {
    if (!reframing) return;
    updateEntry(reframing.entryId, { original: finalText, reframed: finalText });
    refreshEntries();
    setReframing(null);
  }

  function handleDismissReframe() {
    setReframing(null);
  }

  function handleEditEntry(
    id: string,
    updates: { original?: string; tags?: string[] }
  ) {
    editEntry(id, updates);
    refreshEntries();
  }

  function handleDeleteEntry(id: string) {
    deleteEntry(id);
    refreshEntries();
  }

  async function handleReframeAgain(id: string) {
    const current = getEntries().find((e) => e.id === id);
    if (!current) return;
    const response = await fetch("/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: current.original }),
    });
    if (!response.ok) throw new Error("Reframe failed");
    const result = await response.json();
    updateEntry(id, { reframed: result.reframed });
    refreshEntries();
  }

  function handleClearData() {
    deleteAllEntries();
    refreshEntries();
  }

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <header
          style={{
            padding: "32px 40px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="animate-in"
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "3px",
                height: "18px",
                background: "var(--color-accent)",
                borderRadius: "2px",
              }}
            />
            Confidence
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-text-tertiary)",
                letterSpacing: "0.05em",
              }}
            >
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>
        </header>

        <nav
          role="tablist"
          style={{
            display: "flex",
            padding: "28px 40px 0",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
          className="animate-in animate-delay-1"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              id={`tab-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls={`tabpanel-${key}`}
              onClick={() => setTab(key)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "12px 24px 14px",
                color:
                  tab === key
                    ? "var(--color-accent)"
                    : "var(--color-text-tertiary)",
                border: "none",
                background: "none",
                cursor: "pointer",
                borderBottom:
                  tab === key
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
                marginBottom: "-1px",
                transition: "color 0.2s, border-color 0.3s",
              }}
              className={tab === key ? "border-accent-active" : ""}
            >
              {label}
            </button>
          ))}
        </nav>

        <main style={{ padding: "0 40px 80px" }}>
          {tab === "journal" && (
            <div role="tabpanel" id="tabpanel-journal" aria-labelledby="tab-journal">
              <div className="animate-in animate-delay-2">
                <EntryForm
                  prompt={prompt}
                  availableTags={tags}
                  onSave={handleSave}
                  onRefreshPrompt={handleRefreshPrompt}
                  saving={reframeLoading}
                />
              </div>

              {reframeLoading && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    color: "var(--color-text-tertiary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.05em",
                    marginTop: "24px",
                    animation: "shimmer 1.5s ease-in-out infinite",
                  }}
                >
                  Reframing your entry...
                </p>
              )}

              {reframeError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  style={{
                    color: "var(--color-danger)",
                    fontSize: "14px",
                    marginTop: "24px",
                  }}
                >
                  {reframeError}
                </p>
              )}

              {reframing && (
                <div style={{ marginTop: "24px" }}>
                  <ReframeView
                    original={reframing.original}
                    reframed={reframing.reframed}
                    onAccept={handleAcceptReframe}
                    onDismiss={handleDismissReframe}
                  />
                </div>
              )}

              <div
                style={{ marginTop: "48px" }}
                className="animate-in animate-delay-4"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "20px",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    Past Entries
                  </h2>
                  {entries.length > 0 && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--color-text-tertiary)",
                        background: "var(--color-surface)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {entries.length}
                    </span>
                  )}
                </div>
                <EntryList
                  entries={entries}
                  tags={tags}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onReframeAgain={handleReframeAgain}
                />
              </div>
            </div>
          )}

          {tab === "bragdoc" && (
            <div
              role="tabpanel"
              id="tabpanel-bragdoc"
              aria-labelledby="tab-bragdoc"
              className="animate-in animate-delay-2"
            >
              <BragDoc entries={entries} />
            </div>
          )}

          {tab === "settings" && (
            <div
              role="tabpanel"
              id="tabpanel-settings"
              aria-labelledby="tab-settings"
              className="animate-in animate-delay-2"
            >
              <Settings
                tags={tags}
                onAddTag={handleAddTag}
                onDeleteTag={handleDeleteTag}
                onRenameTag={handleRenameTag}
                onClearData={handleClearData}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
