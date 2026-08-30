import { NextResponse } from "next/server";

/**
 * Call placement.
 *
 * Guava's REST API has NO endpoint for placing a single outbound call — the
 * documented /v1 surface is conversations, transcripts, recordings and SMS
 * only. Dialing goes through the Python SDK, which holds a persistent
 * WebSocket ("the Expert") for the duration of the call. Vercel's serverless
 * runtime cannot hold that socket.
 *
 * So this route does the honest thing: it forwards to the local engine when
 * one is reachable, and otherwise returns a clear explanation instead of
 * pretending to dial.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export async function POST(req: Request) {
  let to = "";
  try {
    ({ to_number: to } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  to = (to ?? "").trim();

  if (!E164.test(to)) {
    return NextResponse.json(
      { ok: false, error: "Use E.164 format, e.g. +14155550123" },
      { status: 400 },
    );
  }

  // Verified against the live API: a +33 (FR) destination is rejected by the
  // dialer with error_code 403 "Forbidden". +1 destinations connect normally.
  if (!to.startsWith("+1")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This Guava account is provisioned for +1 (US/Canada) only. Other countries are rejected by the carrier with 403 Forbidden.",
      },
      { status: 400 },
    );
  }

  const engine = process.env.SENTINEL_ENGINE_URL;
  if (!engine) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Outbound dialing needs the supervisor engine running (it holds the call's WebSocket). Guava has no REST endpoint for placing calls. Dial the number on the left instead — inbound works with no engine.",
      },
      { status: 503 },
    );
  }

  try {
    const r = await fetch(`${engine}/api/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_number: to }),
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Supervisor engine unreachable." },
      { status: 502 },
    );
  }
}
