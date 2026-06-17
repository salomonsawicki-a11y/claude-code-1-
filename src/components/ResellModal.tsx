"use client";

import { useEffect, useState } from "react";
import type { Deal, Marketplace, ResellListing } from "@/lib/types";

const MARKETPLACES: Marketplace[] = [
  "eBay",
  "Mercari",
  "Poshmark",
  "Facebook Marketplace",
  "Depop",
  "StockX",
  "Etsy",
];

// "List it" deep links to each marketplace's create-listing flow.
const SELL_LINKS: Record<Marketplace, string> = {
  eBay: "https://www.ebay.com/sl/sell",
  Mercari: "https://www.mercari.com/sell/",
  Poshmark: "https://poshmark.com/create-listing",
  "Facebook Marketplace": "https://www.facebook.com/marketplace/create/item",
  Depop: "https://www.depop.com/sell/",
  StockX: "https://stockx.com/sell",
  Etsy: "https://www.etsy.com/your/shops/me/tools/listings/create",
};

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default function ResellModal({
  deal,
  onClose,
}: {
  deal: Deal;
  onClose: () => void;
}) {
  const [marketplace, setMarketplace] = useState<Marketplace>("eBay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ResellListing | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function generate() {
    setLoading(true);
    setError(null);
    setListing(null);
    try {
      const res = await fetch("/api/resell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal, marketplace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to draft listing.");
      setListing(data.listing as ResellListing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!listing) return;
    const text = [
      listing.title,
      "",
      listing.description,
      "",
      listing.bullets.map((b) => `• ${b}`).join("\n"),
      "",
      `Price: ${money(listing.suggestedPrice, listing.currency)}`,
      `Tags: ${listing.tags.join(", ")}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Resale agent</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              {deal.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <label
            style={{
              fontSize: 12,
              color: "var(--muted)",
              display: "block",
              marginBottom: 8,
            }}
          >
            Sell on
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {MARKETPLACES.map((m) => (
              <button
                key={m}
                onClick={() => setMarketplace(m)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  border: `1px solid ${
                    marketplace === m ? "var(--accent)" : "var(--border)"
                  }`,
                  background:
                    marketplace === m ? "var(--accent-dim)" : "transparent",
                  color: marketplace === m ? "var(--accent)" : "var(--text)",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {!listing && (
            <button
              onClick={generate}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: loading ? "var(--panel-2)" : "var(--accent)",
                color: loading ? "var(--muted)" : "#04140d",
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading
                ? "Agent is writing your listing…"
                : `Generate ${marketplace} listing`}
            </button>
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 9,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {listing && (
            <div className="fade-up" style={{ marginTop: 4 }}>
              <Field label="Title">{listing.title}</Field>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  margin: "12px 0",
                }}
              >
                <div
                  style={{
                    background: "var(--panel-2)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Suggested price
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}
                  >
                    {money(listing.suggestedPrice, listing.currency)}
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--panel-2)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Est. net profit (after fees)
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      marginTop: 2,
                      color:
                        listing.estimatedNetProfit >= 0
                          ? "var(--accent)"
                          : "var(--danger)",
                    }}
                  >
                    {money(listing.estimatedNetProfit, listing.currency)}
                  </div>
                </div>
              </div>

              <Field label="Description">
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {listing.description}
                </span>
              </Field>

              <Field label="Highlights">
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {listing.bullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </Field>

              <Field label="Tags">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {listing.tags.map((t, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "var(--panel-2)",
                        color: "var(--muted)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Field>

              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                {listing.pricingRationale}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button
                  onClick={copyAll}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 9,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    fontWeight: 500,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied ✓" : "Copy listing"}
                </button>
                <a
                  href={SELL_LINKS[marketplace]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "11px 0",
                    borderRadius: 9,
                    border: "none",
                    background: "var(--accent)",
                    color: "#04140d",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  List on {marketplace} ↗
                </a>
              </div>
              <button
                onClick={generate}
                disabled={loading}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "9px 0",
                  borderRadius: 9,
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {loading ? "Regenerating…" : "↻ Regenerate"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
