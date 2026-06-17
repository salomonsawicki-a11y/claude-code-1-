"use client";

import { useEffect, useRef, useState } from "react";
import DealCard from "@/components/DealCard";
import ResellModal from "@/components/ResellModal";
import type { Deal, DiscoverResponse } from "@/lib/types";

const EXAMPLES = [
  "discontinued Lego sets under $80",
  "used DSLR cameras below market",
  "designer sneakers selling under retail",
  "open-box KitchenAid mixers",
];

const STATUS_LINES = [
  "Searching marketplaces and classifieds…",
  "Reading listings and comparing prices…",
  "Looking up retail and recent resale values…",
  "Scoring margins and filtering out the noise…",
  "Ranking the best opportunities…",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [active, setActive] = useState<Deal | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.anthropic)))
      .catch(() => setConfigured(null));
  }, []);

  useEffect(() => {
    if (loading) {
      setStatusIdx(0);
      timer.current = setInterval(
        () => setStatusIdx((i) => (i + 1) % STATUS_LINES.length),
        3500,
      );
    } else if (timer.current) {
      clearInterval(timer.current);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loading]);

  async function search(q?: string) {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery || loading) return;
    if (q) setQuery(q);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minMarginPct: minMargin ? Number(minMargin) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Discovery failed.");
      setResult(data as DiscoverResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1140, margin: "0 auto", padding: "0 20px 80px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#04140d",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>
            Margin
          </span>
        </div>
        <a
          href="https://docs.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
        >
          Powered by Claude agents
        </a>
      </header>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 28px" }}>
        <h1
          style={{
            fontSize: "clamp(30px, 5vw, 46px)",
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: -1,
            fontWeight: 800,
          }}
        >
          Find what&apos;s underpriced.
          <br />
          <span style={{ color: "var(--accent)" }}>Resell it for more.</span>
        </h1>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 16,
            maxWidth: 560,
            margin: "16px auto 0",
            lineHeight: 1.5,
          }}
        >
          AI agents scour the internet for items selling under their resale
          value, rank them by profit, and draft your listings.
        </p>
      </section>

      {configured === false && (
        <SetupBanner />
      )}

      {/* Search */}
      <section
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="What should the agent hunt for?"
            style={{
              flex: "1 1 280px",
              padding: "13px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 15,
              outline: "none",
            }}
          />
          <button
            onClick={() => search()}
            disabled={loading || !query.trim()}
            style={{
              padding: "13px 26px",
              borderRadius: 10,
              border: "none",
              background:
                loading || !query.trim() ? "var(--panel-2)" : "var(--accent)",
              color: loading || !query.trim() ? "var(--muted)" : "#04140d",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading || !query.trim() ? "default" : "pointer",
            }}
          >
            {loading ? "Hunting…" : "Find deals"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <NumberField
            label="Max buy price"
            prefix="$"
            value={maxPrice}
            onChange={setMaxPrice}
            placeholder="any"
          />
          <NumberField
            label="Min margin"
            suffix="%"
            value={minMargin}
            onChange={setMinMargin}
            placeholder="any"
          />
        </div>

        {!result && !loading && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => search(ex)}
                style={{
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Loading */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "var(--muted)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="thinking-dot"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 14 }}>{STATUS_LINES[statusIdx]}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>
            The agent is browsing the live web — this can take 30–90 seconds.
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--danger)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <section className="fade-up">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {result.deals.length} opportunit
              {result.deals.length === 1 ? "y" : "ies"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, maxWidth: 560 }}>
              {result.summary}
            </p>
          </div>

          {result.deals.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
                gap: 16,
              }}
            >
              {result.deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} onResell={setActive} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "var(--muted)",
                fontSize: 14,
              }}
            >
              No verifiable under-retail deals this time. Try a broader search or
              raise your max price.
            </div>
          )}

          {result.citations.length > 0 && (
            <details style={{ marginTop: 24, color: "var(--muted)" }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                Sources the agent consulted ({result.citations.length})
              </summary>
              <ul style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
                {result.citations.slice(0, 20).map((c, i) => (
                  <li key={i}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--muted)" }}
                    >
                      {c.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {active && <ResellModal deal={active} onClose={() => setActive(null)} />}
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 9,
        padding: "8px 12px",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      {prefix && <span style={{ color: "var(--muted)" }}>{prefix}</span>}
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        style={{
          width: 56,
          border: "none",
          background: "transparent",
          color: "var(--text)",
          fontSize: 14,
          outline: "none",
        }}
        className="mono"
      />
      {suffix && <span style={{ color: "var(--muted)" }}>{suffix}</span>}
    </div>
  );
}

function SetupBanner() {
  return (
    <div
      style={{
        background: "rgba(251,191,36,0.08)",
        border: "1px solid rgba(251,191,36,0.3)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        fontSize: 13.5,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: "var(--warn)" }}>Setup needed.</strong> The agents
      need an Anthropic API key. Copy{" "}
      <code className="mono">.env.example</code> to{" "}
      <code className="mono">.env.local</code>, set{" "}
      <code className="mono">ANTHROPIC_API_KEY</code>, and restart the dev
      server. Get a key at{" "}
      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--warn)" }}
      >
        console.anthropic.com
      </a>
      .
    </div>
  );
}
