import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  try {
    const upstream = await fetch(`${pythonUrl}/coach/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("coach turn proxy failed to reach Python service", error);
    return NextResponse.json(
      { error: "Coach turn failed" },
      { status: 502 }
    );
  }
}
