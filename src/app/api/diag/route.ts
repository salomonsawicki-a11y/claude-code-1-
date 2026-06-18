import { NextResponse } from "next/server";
import { getAnthropic, getApiKey, MODEL } from "@/lib/anthropic";

// A one-request self-test: confirms the key is present, valid, and the account
// can actually make a call (i.e. has credits). Lightweight — no web tools — so
// it works even on a weak/cold instance and isolates API issues from hosting.
export const maxDuration = 30;

export async function GET() {
  const keyPresent = Boolean(getApiKey());
  if (!keyPresent) {
    return NextResponse.json({
      keyPresent: false,
      auth: "no_key",
      model: MODEL,
      hint: "Set CLAUDE_API_KEY (or ANTHROPIC_API_KEY) in your host's environment variables and redeploy.",
    });
  }

  try {
    const client = getAnthropic();
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with the single word OK." }],
      },
      { timeout: 20_000, maxRetries: 0 },
    );
    const ok = res.content.some((b) => b.type === "text");
    return NextResponse.json({
      keyPresent: true,
      auth: "ok",
      model: MODEL,
      note: ok
        ? "Key is valid and the account can make calls. If searches still fail, it's the hosting instance (try a paid tier)."
        : "Call succeeded but returned no text.",
    });
  } catch (err) {
    const e = err as {
      status?: number;
      name?: string;
      error?: { error?: { type?: string; message?: string } };
      message?: string;
    };
    const apiMessage = e.error?.error?.message;
    const apiType = e.error?.error?.type;
    let hint = "";
    if (e.status === 401) {
      hint =
        "The key is invalid (often a revoked key, or a stray space). Paste a fresh key and redeploy.";
    } else if (e.status === 400 && /credit|balance|billing/i.test(apiMessage || "")) {
      hint =
        "The account has no credits. Add billing at console.anthropic.com/settings/billing.";
    } else if (e.status === 429) {
      hint = "Rate limited — wait a moment and retry.";
    }
    return NextResponse.json({
      keyPresent: true,
      auth: "failed",
      model: MODEL,
      status: e.status ?? null,
      type: apiType ?? e.name ?? null,
      message: apiMessage ?? e.message ?? "Unknown error",
      hint,
    });
  }
}
