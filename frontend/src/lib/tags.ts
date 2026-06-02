import { getSupabaseBrowserClient } from "./supabase/client";

export interface TagDef {
  name: string;
}

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
];

async function getUserId(): Promise<string> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

export async function getTags(): Promise<TagDef[]> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from("settings")
    .select("custom_tags")
    .eq("user_id", userId)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return DEFAULT_TAGS;
    throw error;
  }
  const custom = (data as { custom_tags: string[] }).custom_tags;
  if (!custom || custom.length === 0) return DEFAULT_TAGS;
  return custom.map((name) => ({ name }));
}

export function isDuplicateName(
  tags: TagDef[],
  name: string,
  excludeName?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return tags.some(
    (t) => t.name !== excludeName && t.name.toLowerCase() === normalized
  );
}

export async function saveTags(tags: TagDef[]): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { error } = await client.from("settings").upsert(
    {
      user_id: userId,
      custom_tags: tags.map((t) => t.name),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
