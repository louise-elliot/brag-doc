import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export function createProxyRoute(
  upstreamPath: string,
  errorMessage: string
) {
  return async function POST(request: Request) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return new NextResponse("unauthorized", { status: 401 });
    }

    const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
    const body = await request.text();
    try {
      const upstream = await fetch(`${pythonUrl}${upstreamPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body,
      });
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`${upstreamPath} proxy failed to reach Python service`, error);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }
  };
}
