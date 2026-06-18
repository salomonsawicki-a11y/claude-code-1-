// Shared domain types for the Margin arbitrage platform.

export type Confidence = "low" | "medium" | "high";

/** A single under-retail opportunity surfaced by the discovery agent. */
export interface Deal {
  id: string;
  title: string;
  category: string;
  /** Where the item is currently listed (e.g. "eBay", "Craigslist", "StockX"). */
  source: string;
  /** Direct URL to the listing. */
  url: string;
  /** Current asking price, in `currency`. */
  price: number;
  /** Typical new/retail price for this item. */
  estimatedRetail: number;
  /** Realistic price you could resell it for, after the market is considered. */
  estimatedResale: number;
  currency: string;
  condition: string;
  imageUrl?: string;
  /** Gross profit estimate (resale - price - estimated fees). Computed server-side. */
  profit: number;
  /** Margin as a percentage of the buy price. Computed server-side. */
  marginPct: number;
  confidence: Confidence;
  /** The agent's one- or two-sentence rationale for why this is a deal. */
  reasoning: string;
}

/** Raw shape the discovery agent is asked to emit (before server-side scoring). */
export interface RawDeal {
  title: string;
  category: string;
  source: string;
  url: string;
  price: number;
  estimatedRetail: number;
  estimatedResale: number;
  currency?: string;
  condition?: string;
  imageUrl?: string;
  confidence?: Confidence;
  reasoning?: string;
}

export interface DiscoverRequest {
  query: string;
  /** "auto" = the agent picks categories itself; "personalized" = use `query`. */
  mode?: "auto" | "personalized";
  maxPrice?: number;
  minMarginPct?: number;
}

export interface DiscoverResponse {
  deals: Deal[];
  /** Human-readable summary of what the agent did. */
  summary: string;
  /** Sources the agent consulted, when available. */
  citations: { title: string; url: string }[];
}

export type Marketplace =
  | "eBay"
  | "Mercari"
  | "Poshmark"
  | "Facebook Marketplace"
  | "Depop"
  | "StockX"
  | "Etsy";

/** A deal the user has acquired; lives in the browser-side inventory. */
export interface InventoryItem extends Deal {
  /** When it was added to inventory (epoch ms). */
  acquiredAt: number;
  /** "owned" once bought; "listed" once a resale draft has been generated. */
  status: "owned" | "listed";
}

export interface ResellRequest {
  deal: Deal;
  marketplace: Marketplace;
}

/** An optimized resale listing draft produced by the resell agent. */
export interface ResellListing {
  title: string;
  description: string;
  suggestedPrice: number;
  currency: string;
  bullets: string[];
  tags: string[];
  category: string;
  /** Estimated profit if it sells at suggestedPrice, after the marketplace's fees. */
  estimatedNetProfit: number;
  pricingRationale: string;
}
