import {
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
  type UserContext,
  type UserSettings,
} from "./types";
import { getSupabaseBrowserClient } from "./supabase/client";

interface SettingsRow {
  user_id: string;
  coaching_style: CoachingStyle;
  custom_tags: string[];
  user_context: { headline: string; notes: string } | null;
  ai_consent: boolean;
}

async function getUserId(): Promise<string> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    coachingStyle: row.coaching_style,
    contextHeadline: row.user_context?.headline ?? "",
    contextNotes: row.user_context?.notes ?? "",
    aiConsent: row.ai_consent ?? false,
  };
}

export async function readSettings(): Promise<UserSettings> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) {
    // PGRST116 = no rows; treat as defaults
    if ((error as { code?: string }).code === "PGRST116") {
      return DEFAULT_USER_SETTINGS;
    }
    throw error;
  }
  return rowToSettings(data as SettingsRow);
}

export function serializeContext(settings: UserSettings): UserContext | null {
  if (
    settings.contextHeadline.trim() === "" &&
    settings.contextNotes.trim() === ""
  ) {
    return null;
  }
  return {
    headline: settings.contextHeadline,
    notes: settings.contextNotes,
  };
}

export async function writeSettings(partial: Partial<UserSettings>): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const current = await readSettings();
  const next: UserSettings = { ...current, ...partial };
  const payload = {
    user_id: userId,
    coaching_style: next.coachingStyle,
    user_context: {
      headline: next.contextHeadline,
      notes: next.contextNotes,
    },
    ai_consent: next.aiConsent,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("settings").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}
