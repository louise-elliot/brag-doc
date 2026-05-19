"use client";

import { useState, useCallback, useEffect } from "react";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    refreshEntries();
    refreshTags();
  }, [refreshEntries, refreshTags]);

  function handleAddTag(name: string) {
    const next = [...tags, { name }];
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

  function handleSave(data: { original: string; tags: string[] }) {
    addEntry({
      date: today,
      prompt,
      original: data.original,
      reframed: null,
      tags: data.tags,
      coachNotes: null,
    });
    refreshEntries();
  }

  function handleCoachAccept(id: string, reframed: string, notes: string[]) {
    updateEntry(id, { reframed, coachNotes: notes });
    refreshEntries();
  }

  function handleCoachDismiss(id: string) {
    updateEntry(id, { coachNotes: [] });
    refreshEntries();
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

  function handleClearData() {
    deleteAllEntries();
    refreshEntries();
  }

  return (
    <div className="min-h-screen relative" style={{ zIndex: 1 }}>
      <div className="max-w-[1200px] mx-auto">
        <header
          className="animate-in flex justify-between items-center px-12 pt-12 pb-6 border-b border-[var(--color-neutral-200)]"
        >
          <div className="font-display text-xl font-bold tracking-tight text-[var(--color-neutral-800)]">
            Confidence
          </div>
          <span className="font-body text-xs text-[var(--color-neutral-500)]">
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}
          </span>
        </header>

        <nav
          role="tablist"
          className="animate-in animate-delay-1 flex gap-8 px-12 pt-6"
        >
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                id={`tab-${key}`}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${key}`}
                onClick={() => setTab(key)}
                className={[
                  "font-body text-sm font-medium pb-3 -mb-px border-b-2 transition-colors cursor-pointer",
                  active
                    ? "text-[var(--color-neutral-800)] border-[var(--color-primary-500)]"
                    : "text-[var(--color-neutral-500)] border-transparent hover:text-[var(--color-neutral-700)]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <main className="px-12 pb-20">
          {tab === "journal" && (
            <div
              role="tabpanel"
              id="tabpanel-journal"
              aria-labelledby="tab-journal"
              className="max-w-[800px] mx-auto"
            >
              <div className="animate-in animate-delay-2">
                <EntryForm
                  prompt={prompt}
                  availableTags={tags}
                  onSave={handleSave}
                  onRefreshPrompt={handleRefreshPrompt}
                />
              </div>

              <div className="mt-16 animate-in animate-delay-4">
                <div className="flex items-baseline gap-3 mb-6">
                  <h2 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)]">
                    Past entries
                  </h2>
                  {entries.length > 0 && (
                    <span className="font-body text-sm text-[var(--color-neutral-500)]">
                      · {entries.length}
                    </span>
                  )}
                </div>
                <EntryList
                  entries={entries}
                  tags={tags}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onCoachAccept={handleCoachAccept}
                  onCoachDismiss={handleCoachDismiss}
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
              <BragDoc entries={entries} tags={tags} />
            </div>
          )}

          {tab === "settings" && (
            <div
              role="tabpanel"
              id="tabpanel-settings"
              aria-labelledby="tab-settings"
              className="max-w-[800px] mx-auto animate-in animate-delay-2"
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
