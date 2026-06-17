import Anthropic from "@anthropic-ai/sdk";

/**
 * The model the agents run on. Opus 4.8 is the default — the most capable
 * model for the multi-step research and judgement these agents do.
 */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No Anthropic API key found. Set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in your environment and redeploy.",
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * The Anthropic key. Accepts ANTHROPIC_API_KEY (preferred) or CLAUDE_API_KEY
 * as a fallback, since both names are commonly used.
 */
export function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

let client: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client. The agents do long-running web
 * research, so we give the client a generous timeout to ride out the
 * server-side tool loop.
 */
export function getAnthropic(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  if (!client) {
    client = new Anthropic({
      apiKey,
      timeout: 5 * 60 * 1000, // 5 minutes — web research can be slow
      maxRetries: 2,
    });
  }
  return client;
}

export function isConfigured(): boolean {
  return Boolean(getApiKey());
}
