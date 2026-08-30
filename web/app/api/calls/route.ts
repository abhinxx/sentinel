import { NextResponse } from "next/server";

/** Guava is the datastore. We proxy it so the deployed site has real history. */
const GUAVA = "https://app.goguava.ai";

export const revalidate = 0;

export async function GET() {
  const key = process.env.GUAVA_API_KEY;
  if (!key) {
    return NextResponse.json({
      conversations: [],
      error: "GUAVA_API_KEY not set on the server.",
    });
  }

  try {
    const r = await fetch(`${GUAVA}/v1/conversations?limit=50`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) {
      return NextResponse.json({
        conversations: [],
        error: `Guava returned ${r.status}`,
      });
    }
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({
      conversations: [],
      error: "Could not reach Guava.",
    });
  }
}
