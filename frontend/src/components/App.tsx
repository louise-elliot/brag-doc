"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
import { BragDoc } from "./BragDoc";
import { SettingsDrawer } from "./SettingsDrawer";
import { AboutModal } from "./AboutModal";
import { AiConsentGate } from "./AiConsentGate";
import { readSettings, writeSettings } from "@/lib/settings";
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
import { runFirstSignInMigration } from "@/lib/migration";
import type { Entry } from "@/lib/types";

type Tab = "journal" | "bragdoc";

const TABS: { key: Tab; label: string }[] = [
  { key: "journal", label: "Daily Wins ✨" },
  { key: "bragdoc", label: "Brag Doc 📝" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("journal");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  const today = todayLocal();
  const [prompt, setPrompt] = useState<string>(() => getPromptForDate(today));

  function handleRefreshPrompt() {
    setPrompt((current) => getRandomPromptExcluding(current));
  }

  const [tags, setTags] = useState<TagDef[]>([]);
  const [aiConsent, setAiConsent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const refreshEntries = useCallback(async () => {
    const es = await getEntries();
    setEntries(es);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runFirstSignInMigration();
      if (cancelled) return;
      const [es, ts] = await Promise.all([getEntries(), getTags()]);
      if (cancelled) return;
      setEntries(es);
      setTags(ts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    readSettings().then(
      (s) => {
        if (!cancelled) setAiConsent(s.aiConsent);
      },
      () => {
        /* not signed in / no row yet — stay false */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAiConsentChange(next: boolean) {
    setAiConsent(next);
    await writeSettings({ aiConsent: next });
  }

  const requireAiConsent = useCallback(
    (run: () => void) => {
      if (aiConsent) {
        run();
        return;
      }
      pendingActionRef.current = run;
      setGateOpen(true);
    },
    [aiConsent]
  );

  async function handleGateAccept() {
    // Close the gate and run the pending action first, so persisting consent
    // can never block the user. If the write fails (e.g. transient backend
    // error), they still get their AI action this session; consent just isn't
    // saved, so the gate reappears next time.
    setAiConsent(true);
    setGateOpen(false);
    const run = pendingActionRef.current;
    pendingActionRef.current = null;
    run?.();
    try {
      await writeSettings({ aiConsent: true });
    } catch (e) {
      console.error("Failed to persist AI consent", e);
    }
  }

  function handleGateCancel() {
    pendingActionRef.current = null;
    setGateOpen(false);
  }

  async function handleAddTag(name: string) {
    const next = [...tags, { name }];
    await saveTags(next);
    setTags(next);
  }

  async function handleDeleteTag(name: string) {
    const next = tags.filter((t) => t.name !== name);
    await saveTags(next);
    setTags(next);
  }

  async function handleRenameTag(oldName: string, newName: string) {
    const next = tags.map((t) =>
      t.name === oldName ? { ...t, name: newName } : t
    );
    await saveTags(next);
    await renameTagOnEntries(oldName, newName);
    setTags(next);
    await refreshEntries();
  }

  async function handleSave(data: { original: string; tags: string[] }) {
    await addEntry({
      date: today,
      prompt,
      original: data.original,
      reframed: null,
      tags: data.tags,
      coachNotes: null,
    });
    await refreshEntries();
  }

  async function handleCoachAccept(
    id: string,
    reframed: string,
    notes: string[]
  ) {
    await updateEntry(id, { reframed, coachNotes: notes });
    await refreshEntries();
  }

  async function handleCoachDismiss(id: string) {
    await updateEntry(id, { coachNotes: [] });
    await refreshEntries();
  }

  async function handleEditEntry(
    id: string,
    updates: { original?: string; reframed?: string; tags?: string[] }
  ) {
    await editEntry(id, updates);
    await refreshEntries();
  }

  async function handleDeleteEntry(id: string) {
    await deleteEntry(id);
    await refreshEntries();
  }

  async function handleClearData() {
    await deleteAllEntries();
    await refreshEntries();
  }

  return (
    <div className="min-h-screen relative" style={{ zIndex: 1 }}>
      <div className="max-w-[1200px] mx-auto">
        <header className="animate-in flex justify-between items-center px-12 pt-12 pb-6 border-b border-[var(--color-neutral-200)]">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About Byline"
            className="font-display text-xl font-bold tracking-tight text-[var(--color-neutral-800)] hover:text-[var(--color-neutral-600)] bg-transparent border-none p-0 cursor-pointer transition-colors"
          >
            Byline
          </button>
          <div className="flex items-center gap-4">
            <span className="font-body text-xs text-[var(--color-neutral-500)]">
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-100)] rounded-md w-9 h-9 flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
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
                  onRequireConsent={requireAiConsent}
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
              <BragDoc entries={entries} tags={tags} onRequireConsent={requireAiConsent} />
            </div>
          )}

        </main>
      </div>
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        onRenameTag={handleRenameTag}
        onClearData={handleClearData}
        aiConsent={aiConsent}
        onAiConsentChange={handleAiConsentChange}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <AiConsentGate
        open={gateOpen}
        onAccept={handleGateAccept}
        onCancel={handleGateCancel}
      />
    </div>
  );
}
