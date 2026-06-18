import { NextResponse } from "next/server";
import { discover } from "@/lib/agents/discovery";
import { MissingApiKeyError } from "@/lib/anthropic";
import type { DiscoverRequest } from "@/lib/types";

// Web research can run for a while — give the route room.
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: DiscoverRequest;
  try {
    body = (await request.json()) as DiscoverRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const isAuto = body.mode === "auto";
  if (!isAuto && (!body.query || !body.query.trim())) {
    return NextResponse.json(
      { error: "A search query is required for a personalized search." },
      { status: 400 },
    );
  }

  try {
    const result = await discover({
      query: (body.query || "").trim(),
      mode: isAuto ? "auto" : "personalized",
      maxPrice: body.maxPrice ? Number(body.maxPrice) : undefined,
      minMarginPct: body.minMarginPct ? Number(body.minMarginPct) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("discover failed:", err);
    const message = err instanceof Error ? err.message : "Discovery failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
