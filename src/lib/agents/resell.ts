import { getAnthropic, MODEL } from "../anthropic";
import type { Marketplace, ResellListing, ResellRequest } from "../types";

// Approximate selling-fee rate per marketplace, used to estimate net profit.
const MARKETPLACE_FEES: Record<Marketplace, number> = {
  eBay: 0.135,
  Mercari: 0.1,
  Poshmark: 0.2,
  "Facebook Marketplace": 0.05,
  Depop: 0.1,
  StockX: 0.12,
  Etsy: 0.095,
};

const LISTING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "SEO-optimized listing title" },
    description: {
      type: "string",
      description: "Compelling marketplace description, 2-4 short paragraphs",
    },
    suggestedPrice: { type: "number", description: "Recommended list price" },
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "3-6 key selling points / specs",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "5-10 search keywords / hashtags for this marketplace",
    },
    category: { type: "string", description: "Best-fit marketplace category" },
    pricingRationale: {
      type: "string",
      description: "One sentence explaining the suggested price",
    },
  },
  required: [
    "title",
    "description",
    "suggestedPrice",
    "bullets",
    "tags",
    "category",
    "pricingRationale",
  ],
} as const;

export async function draftListing(req: ResellRequest): Promise<ResellListing> {
  const client = getAnthropic();
  const { deal, marketplace } = req;

  const system = `You are the resale-listing agent for "Margin". Given an item a
user is reselling and a target marketplace, write a high-converting listing
tailored to that marketplace's audience, tone, and search behavior. Price it to
sell reasonably quickly while protecting margin. Be accurate and never overstate
condition.`;

  const userPrompt = `Draft a listing for ${marketplace}.

Item: ${deal.title}
Category: ${deal.category}
Condition: ${deal.condition}
I'm buying it for: ${deal.price} ${deal.currency}
Typical retail: ${deal.estimatedRetail} ${deal.currency}
Estimated resale value: ${deal.estimatedResale} ${deal.currency}
Context: ${deal.reasoning}

Optimize the title and tags for ${marketplace} search. Suggest a price in ${deal.currency}.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: { type: "json_schema", schema: LISTING_SCHEMA },
    },
  } as Parameters<typeof client.messages.create>[0]);

  const textBlock = (response as { content: { type: string; text?: string }[] }).content.find(
    (b) => b.type === "text",
  );
  if (!textBlock?.text) {
    throw new Error("The resell agent returned no listing.");
  }

  const draft = JSON.parse(textBlock.text) as Omit<
    ResellListing,
    "currency" | "estimatedNetProfit"
  >;

  const feeRate = MARKETPLACE_FEES[marketplace] ?? 0.12;
  const net = draft.suggestedPrice * (1 - feeRate) - deal.price;

  return {
    ...draft,
    currency: deal.currency,
    estimatedNetProfit: Math.round(net * 100) / 100,
  };
}
