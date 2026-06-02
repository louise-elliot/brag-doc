import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS_HEADERS });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller's token by asking Supabase who they are.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response("unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = user.id;

  // Delete data first (explicit + observable). ON DELETE CASCADE would also handle this.
  const { error: entriesErr } = await admin.from("entries").delete().eq("user_id", userId);
  if (entriesErr) return new Response(JSON.stringify({ error: entriesErr.message }), { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

  const { error: settingsErr } = await admin.from("settings").delete().eq("user_id", userId);
  if (settingsErr) return new Response(JSON.stringify({ error: settingsErr.message }), { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

  const { error: userErr } = await admin.auth.admin.deleteUser(userId);
  if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
});
