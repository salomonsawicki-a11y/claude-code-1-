import { NextResponse } from "next/server";
import { draftListing } from "@/lib/agents/resell";
import { MissingApiKeyError } from "@/lib/anthropic";
import type { ResellRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: ResellRequest;
  try {
    body = (await request.json()) as ResellRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.deal || !body.marketplace) {
    return NextResponse.json(
      { error: "Both `deal` and `marketplace` are required." },
      { status: 400 },
    );
  }

  try {
    const listing = await draftListing(body);
    return NextResponse.json({ listing });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("resell failed:", err);
    const message = err instanceof Error ? err.message : "Listing draft failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
