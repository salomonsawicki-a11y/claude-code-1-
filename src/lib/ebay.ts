// Optional real marketplace source: eBay Browse API.
//
// When EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are set, the discovery agent feeds
// live eBay listings into its analysis. Without them, this module no-ops and
// the agent relies solely on Claude's web_search tool.

import type { RawDeal } from "./types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const id = process.env.EBAY_CLIENT_ID!;
  const secret = process.env.EBAY_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    throw new Error(`eBay auth failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

interface EbayItemSummary {
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  image?: { imageUrl?: string };
  categories?: { categoryName?: string }[];
}

/**
 * Search live eBay listings. Returns partial RawDeals (no retail/resale
 * estimate — the agent fills those in). Resolves to [] on any failure so a
 * missing/broken eBay integration never breaks discovery.
 */
export async function searchEbay(
  query: string,
  maxPrice?: number,
  limit = 12,
): Promise<RawDeal[]> {
  if (!ebayConfigured()) return [];
  try {
    const token = await getToken();
    const marketplace = process.env.EBAY_MARKETPLACE_ID || "EBAY_US";
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (maxPrice && maxPrice > 0) {
      params.set("filter", `price:[..${maxPrice}],priceCurrency:USD`);
    }

    const res = await fetch(`${BROWSE_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplace,
      },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    return (data.itemSummaries || [])
      .filter((it) => it.title && it.price?.value)
      .map((it) => ({
        title: it.title!,
        category: it.categories?.[0]?.categoryName || "Other",
        source: "eBay",
        url: it.itemWebUrl || "",
        price: Number(it.price!.value),
        // Unknown until the agent researches it; left at the buy price so the
        // agent is forced to look them up rather than inventing a margin.
        estimatedRetail: Number(it.price!.value),
        estimatedResale: Number(it.price!.value),
        currency: it.price!.currency || "USD",
        condition: it.condition || "Unknown",
        imageUrl: it.image?.imageUrl,
      }));
  } catch {
    return [];
  }
}
