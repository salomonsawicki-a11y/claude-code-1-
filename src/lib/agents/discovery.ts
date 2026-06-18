import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "../anthropic";
import { searchEbay, ebayConfigured } from "../ebay";
import type {
  Deal,
  DiscoverRequest,
  DiscoverResponse,
  RawDeal,
} from "../types";

// Rough blended marketplace + payment fee used to keep profit estimates honest.
const RESALE_FEE_RATE = 0.13;

const SYSTEM = `You are the sourcing agent for "Margin", a resale-arbitrage platform.
Your job: search the live internet for real, currently-available items that are
selling for noticeably LESS than what they can be resold for, and return them as
structured deals.

Rules:
- Use the web_search and web_fetch tools to find ACTUAL listings that exist right
  now (marketplaces, classifieds, liquidation/outlet sites, clearance pages).
- For every candidate, determine: the current asking price, the typical retail
  price, and a realistic resale price based on recent comparable sales.
- Only include items where resale price is clearly above the asking price.
- Never invent prices or URLs. If you cannot verify a real listing URL, drop it.
- Prefer a smaller set of high-confidence, verifiable deals over many shaky ones.
- Diversify sources where possible.

When you are completely done researching, output your FINAL answer as a single
fenced JSON code block (\`\`\`json) and nothing after it, matching exactly:

{
  "summary": "1-3 sentences on what you searched and found",
  "deals": [
    {
      "title": "string",
      "category": "string",
      "source": "marketplace or site name",
      "url": "direct listing URL",
      "price": 0,
      "estimatedRetail": 0,
      "estimatedResale": 0,
      "currency": "USD",
      "condition": "New | Used - Like New | Used - Good | ...",
      "imageUrl": "https://... (optional, omit if unknown)",
      "confidence": "low | medium | high",
      "reasoning": "why this is underpriced vs. resale, citing what you found"
    }
  ]
}

All prices are numbers in the listing's currency. Return 3-6 strong deals.
Work efficiently: a few searches, then output the JSON. Don't over-research.`;

interface AgentJson {
  summary?: string;
  deals?: RawDeal[];
}

/** Pull the last fenced ```json block out of the agent's text. */
function extractJson(text: string): AgentJson | null {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const candidate = fences.length
    ? fences[fences.length - 1][1]
    : // fall back to the last {...} span if the model forgot the fence
      text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate.trim()) as AgentJson;
  } catch {
    return null;
  }
}

/** Turn a raw agent deal into a scored, validated Deal (or null if invalid). */
function scoreDeal(raw: RawDeal, index: number): Deal | null {
  const price = Number(raw.price);
  const estimatedResale = Number(raw.estimatedResale);
  const estimatedRetail = Number(raw.estimatedRetail) || estimatedResale;
  if (!raw.title || !raw.url || !(price > 0) || !(estimatedResale > 0)) {
    return null;
  }
  const netResale = estimatedResale * (1 - RESALE_FEE_RATE);
  const profit = Math.round((netResale - price) * 100) / 100;
  const marginPct = Math.round((profit / price) * 1000) / 10;

  return {
    id: `${Date.now().toString(36)}-${index}`,
    title: raw.title,
    category: raw.category || "Other",
    source: raw.source || "Unknown",
    url: raw.url,
    price,
    estimatedRetail,
    estimatedResale,
    currency: raw.currency || "USD",
    condition: raw.condition || "Unknown",
    imageUrl: raw.imageUrl,
    profit,
    marginPct,
    confidence: raw.confidence || "medium",
    reasoning: raw.reasoning || "",
  };
}

/** Collect plain text and web-search citations from a finished message. */
function harvest(content: Anthropic.ContentBlock[]): {
  text: string;
  citations: { title: string; url: string }[];
} {
  let text = "";
  const citations: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const block of content) {
    if (block.type === "text") {
      text += block.text;
    }
    // web_search_tool_result blocks carry the sources the agent consulted.
    const anyBlock = block as unknown as {
      type: string;
      content?: { url?: string; title?: string }[];
    };
    if (anyBlock.type === "web_search_tool_result" && Array.isArray(anyBlock.content)) {
      for (const r of anyBlock.content) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          citations.push({ url: r.url, title: r.title || r.url });
        }
      }
    }
  }
  return { text, citations };
}

export async function discover(req: DiscoverRequest): Promise<DiscoverResponse> {
  const client = getAnthropic();
  const isAuto = req.mode === "auto" || !req.query.trim();

  // Seed with live eBay listings when configured and we have a query to search.
  let seed = "";
  if (ebayConfigured() && req.query.trim()) {
    const ebayDeals = await searchEbay(req.query, req.maxPrice);
    if (ebayDeals.length) {
      seed =
        `\n\nHere are live eBay listings for "${req.query}" to investigate ` +
        `(verify each, then research retail/resale value):\n` +
        JSON.stringify(ebayDeals, null, 2);
    }
  }

  const constraints = [
    req.maxPrice ? `Only items with an asking price at or below ${req.maxPrice} USD.` : "",
    req.minMarginPct
      ? `Only items whose resale margin is at least ${req.minMarginPct}%.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const userPrompt = isAuto
    ? `AUTONOMOUS HUNT. No specific item was requested — YOU decide what to look ` +
      `for. Scan the live web for the best resale-arbitrage opportunities ` +
      `available right now. Pick a diverse mix across high-resale-velocity ` +
      `categories (e.g. sneakers, consumer electronics, Lego sets, trading ` +
      `cards, designer apparel, small appliances, collectibles) and hunt for ` +
      `genuinely underpriced listings: clearance, liquidation, open-box, ` +
      `mispriced used items, and sold-out items reselling above original. ` +
      `Favor variety over many items from one category. ${constraints}` +
      (req.query.trim() ? ` Optional focus hint: ${req.query}.` : "")
    : `Find under-retail resale opportunities for: ${req.query}. ${constraints}` +
      seed;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  // Hosting platforms cap serverless functions (~60s on Vercel Hobby). Keep the
  // whole agent run inside a soft deadline so we return whatever we found
  // rather than getting killed mid-request.
  const DEADLINE_MS = 52_000;
  const startedAt = Date.now();

  // Manual loop so we can ride out the server-side web-search tool (pause_turn).
  let finalContent: Anthropic.ContentBlock[] = [];
  for (let i = 0; i < 3; i++) {
    const remaining = DEADLINE_MS - (Date.now() - startedAt);
    if (remaining < 8_000) break; // not enough time for another round
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 6000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 5 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
        ] as Anthropic.Messages.ToolUnion[],
        messages,
      },
      { timeout: remaining },
    );

    finalContent = response.content;
    if (response.stop_reason === "pause_turn") {
      // Server tool loop hit its limit — re-send to let it continue.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    break;
  }

  const { text, citations } = harvest(finalContent);
  const parsed = extractJson(text);

  const deals = (parsed?.deals || [])
    .map(scoreDeal)
    .filter((d): d is Deal => d !== null)
    .filter((d) => (req.maxPrice ? d.price <= req.maxPrice : true))
    .filter((d) => (req.minMarginPct ? d.marginPct >= req.minMarginPct : true))
    .sort((a, b) => b.profit - a.profit);

  return {
    deals,
    summary:
      parsed?.summary ||
      (deals.length
        ? `Found ${deals.length} opportunities for "${req.query}".`
        : `No verifiable under-retail deals found for "${req.query}". Try a broader or different search.`),
    citations,
  };
}
