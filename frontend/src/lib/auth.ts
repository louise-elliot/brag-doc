import { getSupabaseBrowserClient } from "./supabase/client";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export async function signOutCurrentUser(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
