import { NextResponse } from "next/server";
import { isConfigured, MODEL } from "@/lib/anthropic";
import { ebayConfigured } from "@/lib/ebay";

export async function GET() {
  return NextResponse.json({
    anthropic: isConfigured(),
    ebay: ebayConfigured(),
    model: MODEL,
  });
}
