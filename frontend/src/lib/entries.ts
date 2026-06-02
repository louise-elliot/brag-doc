import type { Entry } from "./types";
import { getSupabaseBrowserClient } from "./supabase/client";

interface EntryRow {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  coach_notes: string[] | null;
  created_at: string;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    date: row.date,
    prompt: row.prompt,
    original: row.original,
    reframed: row.reframed,
    tags: row.tags,
    coachNotes: row.coach_notes,
    createdAt: row.created_at,
  };
}

export async function getEntries(): Promise<Entry[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("entries")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function addEntry(
  data: Omit<Entry, "id" | "createdAt">
): Promise<Entry> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  const payload = {
    user_id: user.id,
    date: data.date,
    prompt: data.prompt,
    original: data.original,
    reframed: data.reframed,
    tags: data.tags,
    coach_notes: data.coachNotes,
  };
  const { data: row, error } = await client
    .from("entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return rowToEntry(row as EntryRow);
}

export async function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "original" | "reframed" | "tags" | "coachNotes">>
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const payload: Record<string, unknown> = {};
  if (updates.original !== undefined) payload.original = updates.original;
  if (updates.reframed !== undefined) payload.reframed = updates.reframed;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.coachNotes !== undefined) payload.coach_notes = updates.coachNotes;
  const { error } = await client.from("entries").update(payload).eq("id", id);
  if (error) throw error;
}

export async function editEntry(
  id: string,
  updates: { original?: string; reframed?: string; tags?: string[] }
): Promise<void> {
  const client = getSupabaseBrowserClient();
  // Fetch current to detect "original changed" and clear reframed in that case
  const { data: current, error: fetchErr } = await client
    .from("entries").select("original").eq("id", id).single();
  if (fetchErr) throw fetchErr;
  const originalChanged =
    updates.original !== undefined && updates.original !== (current as { original: string }).original;
  const payload: Record<string, unknown> = {};
  if (updates.original !== undefined) payload.original = updates.original;
  if (updates.reframed !== undefined) payload.reframed = updates.reframed;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (originalChanged && updates.reframed === undefined) payload.reframed = null;
  const { error } = await client.from("entries").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllEntries(): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await client.from("entries").delete().eq("user_id", user.id);
  if (error) throw error;
}

export async function renameTagOnEntries(oldName: string, newName: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error: selErr } = await client
    .from("entries")
    .select("id, tags")
    .contains("tags", [oldName]);
  if (selErr) throw selErr;
  for (const row of (data as { id: string; tags: string[] }[])) {
    const next = row.tags.map((t) => (t === oldName ? newName : t));
    const { error } = await client.from("entries").update({ tags: next }).eq("id", row.id);
    if (error) throw error;
  }
}

export async function getEntriesByDateRange(
  start: string,
  end: string
): Promise<Entry[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("entries")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}
