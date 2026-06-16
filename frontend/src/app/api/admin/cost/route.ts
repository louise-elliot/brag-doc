import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return new NextResponse("unauthorized", { status: 401 });
    }

    const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
    const days = new URL(request.url).searchParams.get("days") ?? "30";
    try {
      const upstream = await fetch(
        `${pythonUrl}/admin/cost/summary?days=${encodeURIComponent(days)}`,
        { method: "GET", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("admin cost proxy failed to reach Python service", error);
      return NextResponse.json({ error: "Failed to load cost summary" }, { status: 502 });
    }
  } catch (error) {
    console.error("admin cost proxy handler failed", error);
    return NextResponse.json({ error: "Failed to load cost summary" }, { status: 500 });
  }
}
