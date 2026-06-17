# Margin — AI resale arbitrage agents

Margin is a web app where AI agents do the legwork of resale arbitrage:

1. **Discover** — a Claude agent searches the live internet (`web_search` +
   `web_fetch`) for real items selling **below their resale value**, then ranks
   them by estimated profit and margin.
2. **Analyze** — every deal is scored server-side (buy price vs. realistic
   resale, minus a marketplace-fee estimate) so the numbers you see are honest.
3. **Resell** — pick a marketplace and a second Claude agent drafts an
   optimized listing (title, description, price, tags) you can copy and post.

Built with **Next.js (App Router) + TypeScript** and the **Anthropic SDK**,
running on **`claude-opus-4-8`**.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure your key
cp .env.example .env.local
#   then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run
npm run dev
#   open http://localhost:3000
```

Get an Anthropic API key at <https://console.anthropic.com/settings/keys>.

The app runs without a key, but the agents will return a clear "setup needed"
message until one is set (visible as a banner on the home page).

---

## How it works

```
        you ──▶ /api/discover ──▶ Discovery agent (Claude + web_search/web_fetch)
                                        │  finds real listings, estimates retail & resale
                                        ▼
                              ranked, profit-scored Deals  ──▶  UI
                                        │
        you pick a deal + marketplace   ▼
                you ──▶ /api/resell ──▶ Resell agent (Claude + structured output)
                                        │  writes an optimized listing draft
                                        ▼
                            copy it / open the marketplace's sell page
```

### Key files

| Path | Role |
| --- | --- |
| `src/lib/agents/discovery.ts` | Discovery agent — web research → scored deals |
| `src/lib/agents/resell.ts` | Resell agent — deal → marketplace listing |
| `src/lib/ebay.ts` | Optional live eBay Browse source (pluggable) |
| `src/lib/anthropic.ts` | Anthropic client + model selection |
| `src/app/api/*` | API routes (`discover`, `resell`, `health`) |
| `src/app/page.tsx` | Dashboard UI |

---

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ | Powers both agents |
| `ANTHROPIC_MODEL` | — | Override the model (default `claude-opus-4-8`) |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | — | Feed live eBay listings into discovery |
| `EBAY_MARKETPLACE_ID` | — | eBay marketplace (default `EBAY_US`) |

### Adding more real marketplace sources

`src/lib/ebay.ts` is the template: it authenticates, searches, and returns
partial `RawDeal`s that the discovery agent then verifies and values. Add a
sibling module for any marketplace with a public search API and feed its results
into the agent's prompt seed in `discovery.ts`.

---

## Notes & limits

- **Estimates, not guarantees.** Retail/resale figures come from the agent's web
  research and are approximations. Always verify before buying.
- **No automated purchasing or posting.** "List on \<marketplace\>" deep-links to
  that marketplace's create-listing flow with your drafted copy ready to paste.
  Fully automated posting requires per-marketplace OAuth (e.g. the eBay Sell
  API) and is a deliberate, separate integration point.
- **Ephemeral by design.** There's no database; results live in the browser
  session. Add persistence (Postgres/SQLite) if you want saved watchlists.
