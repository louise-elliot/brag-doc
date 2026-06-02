import { getSupabaseBrowserClient } from "./supabase/client";
import { DEFAULT_USER_SETTINGS } from "./types";

const LS_ENTRIES = "byline-entries";
const LS_SETTINGS = "byline-settings";
const LS_TAGS = "byline:tags";

interface LocalEntry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  coachNotes: string[] | null;
  createdAt: string;
}

interface LocalSettings {
  coachingStyle?: string;
  contextHeadline?: string;
  contextNotes?: string;
}

interface LocalTag { name: string }

export type MigrationResult = "skipped-returning-user" | "migrated" | "error";

function readLocalEntries(): LocalEntry[] {
  const raw = localStorage.getItem(LS_ENTRIES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalEntry[]) : [];
  } catch {
    return [];
  }
}

function readLocalSettings(): LocalSettings {
  const raw = localStorage.getItem(LS_SETTINGS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed as LocalSettings : {};
  } catch {
    return {};
  }
}

function readLocalTags(): LocalTag[] {
  const raw = localStorage.getItem(LS_TAGS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalTag[]) : [];
  } catch {
    return [];
  }
}

function clearLocalStorage(): void {
  localStorage.removeItem(LS_ENTRIES);
  localStorage.removeItem(LS_SETTINGS);
  localStorage.removeItem(LS_TAGS);
}

export async function runFirstSignInMigration(): Promise<MigrationResult> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return "error";

  // Returning user?
  const { data: existing, error: selErr } = await client
    .from("settings")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Stale localStorage on a returning-user device → drop it.
    clearLocalStorage();
    return "skipped-returning-user";
  }
  // PGRST116 means no row, anything else is unexpected.
  if (selErr && (selErr as { code?: string }).code !== "PGRST116") {
    console.error("[migration:fail]", selErr);
    return "error";
  }

  const entries = readLocalEntries();
  const settings = readLocalSettings();
  const tags = readLocalTags();

  const payload = {
    p_entries: entries,
    p_settings: {
      coaching_style: settings.coachingStyle ?? DEFAULT_USER_SETTINGS.coachingStyle,
      custom_tags: tags.map((t) => t.name),
      user_context:
        settings.contextHeadline || settings.contextNotes
          ? {
              headline: settings.contextHeadline ?? "",
              notes: settings.contextNotes ?? "",
            }
          : null,
    },
  };

  const { error } = await client.rpc("migrate_localstorage", payload);
  if (error) {
    console.error("[migration:fail]", error);
    return "error";
  }
  clearLocalStorage();
  return "migrated";
}
