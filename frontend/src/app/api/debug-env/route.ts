import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    debug: true,
    pythonServiceUrlSet: Boolean(process.env.PYTHON_SERVICE_URL),
    pythonServiceUrlValue: process.env.PYTHON_SERVICE_URL ?? null,
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabaseAnonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseAnonKeyPrefix:
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").slice(0, 12),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
