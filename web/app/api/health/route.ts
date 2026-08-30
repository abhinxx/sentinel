import { NextResponse } from "next/server";

/** Lets the deployed dashboard show the agent number without a local engine. */
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent_number: process.env.GUAVA_AGENT_NUMBER ?? null,
  });
}
