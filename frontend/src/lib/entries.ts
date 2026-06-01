import { readWithLegacyMigration } from "./localStorage";
import type { Entry } from "./types";

const STORAGE_KEY = "byline-entries";
const LEGACY_STORAGE_KEY = "confidence-journal-entries";

function readEntries(): Entry[] {
  const raw = readWithLegacyMigration(STORAGE_KEY, LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({
      ...e,
      coachNotes: e.coachNotes ?? null,
    }));
  } catch {
    return [];
  }
}

function writeEntries(entries: Entry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getEntries(): Entry[] {
  return readEntries().sort((a, b) => {
    const byDate =
      new Date(b.date).getTime() - new Date(a.date).getTime();
    if (byDate !== 0) return byDate;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}

export function addEntry(
  data: Omit<Entry, "id" | "createdAt">
): Entry {
  const entry: Entry = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const entries = readEntries();
  entries.push(entry);
  writeEntries(entries);
  return entry;
}

export function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "original" | "reframed" | "tags" | "coachNotes">>
): void {
  const entries = readEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updates };
    writeEntries(entries);
  }
}

export function deleteAllEntries(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function deleteEntry(id: string): void {
  const entries = readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length !== entries.length) writeEntries(next);
}

export function editEntry(
  id: string,
  updates: { original?: string; reframed?: string; tags?: string[] }
): void {
  const entries = readEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return;
  const current = entries[index];
  const originalChanged =
    updates.original !== undefined && updates.original !== current.original;
  entries[index] = {
    ...current,
    ...(updates.original !== undefined && { original: updates.original }),
    ...(updates.reframed !== undefined && { reframed: updates.reframed }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
    ...(originalChanged && updates.reframed === undefined && { reframed: null }),
  };
  writeEntries(entries);
}

export function renameTagOnEntries(oldName: string, newName: string): void {
  const entries = readEntries();
  let changed = false;
  const updated = entries.map((e) => {
    if (!e.tags.includes(oldName)) return e;
    changed = true;
    return { ...e, tags: e.tags.map((t) => (t === oldName ? newName : t)) };
  });
  if (changed) writeEntries(updated);
}

export function getEntriesByDateRange(
  start: string,
  end: string
): Entry[] {
  return getEntries().filter((e) => e.date >= start && e.date <= end);
}
