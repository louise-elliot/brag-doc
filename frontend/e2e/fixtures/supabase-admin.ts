import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createTestUser(
  email: string
): Promise<{ id: string; accessToken: string; refreshToken: string }> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + "Aa1!",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("user creation failed");

  // Generate a magic-link action token and exchange it for a session
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const user = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: sess, error: vErr } = await user.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (vErr || !sess.session) throw vErr ?? new Error("session exchange failed");

  return {
    id: data.user.id,
    accessToken: sess.session.access_token,
    refreshToken: sess.session.refresh_token,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}
