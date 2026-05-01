import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl =
    process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  try {
    const upstream = await fetch(`${pythonUrl}/generate-brag-doc`, {
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
    console.error("brag doc proxy failed to reach Python service", error);
    return NextResponse.json(
      { error: "Brag doc generation failed" },
      { status: 502 }
    );
  }
}
