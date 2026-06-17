import Anthropic from "@anthropic-ai/sdk";

/**
 * The model the agents run on. Opus 4.8 is the default — the most capable
 * model for the multi-step research and judgement these agents do.
 */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
    this.name = "MissingApiKeyError";
  }
}

let client: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client. The agents do long-running web
 * research, so we give the client a generous timeout to ride out the
 * server-side tool loop.
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 5 * 60 * 1000, // 5 minutes — web research can be slow
      maxRetries: 2,
    });
  }
  return client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
