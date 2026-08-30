import { NextResponse } from "next/server";

const GUAVA = "https://app.goguava.ai";

export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const key = process.env.GUAVA_API_KEY;
  if (!key) return NextResponse.json({ transcript: [], error: "No API key" });

  try {
    const r = await fetch(`${GUAVA}/v1/conversations/${callId}/transcript`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok)
      return NextResponse.json({
        transcript: [],
        error: `Guava returned ${r.status}`,
      });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ transcript: [], error: "Unreachable" });
  }
}
