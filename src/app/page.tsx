"use client";

import { useEffect, useRef, useState } from "react";
import DealCard from "@/components/DealCard";
import ResellModal from "@/components/ResellModal";
import type { Deal, DiscoverResponse, InventoryItem } from "@/lib/types";

const INVENTORY_KEY = "margin:inventory:v1";

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

type Mode = "auto" | "personalized";
type View = "discover" | "inventory";

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

export default function Home() {
  const [view, setView] = useState<View>("discover");
  const [mode, setMode] = useState<Mode>("auto");
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [active, setActive] = useState<Deal | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load inventory + config on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      if (raw) setInventory(JSON.parse(raw) as InventoryItem[]);
    } catch {
      /* ignore corrupt storage */
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.anthropic)))
      .catch(() => setConfigured(null));
  }, []);

  // Persist inventory whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    } catch {
      /* ignore quota errors */
    }
  }, [inventory]);

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

  function inInventory(id: string) {
    return inventory.some((i) => i.id === id);
  }

  function addToInventory(deal: Deal) {
    setInventory((prev) =>
      prev.some((i) => i.id === deal.id)
        ? prev
        : [{ ...deal, acquiredAt: Date.now(), status: "owned" }, ...prev],
    );
  }

  function removeFromInventory(deal: Deal) {
    setInventory((prev) => prev.filter((i) => i.id !== deal.id));
  }

  function markListed(deal: Deal) {
    setInventory((prev) =>
      prev.map((i) => (i.id === deal.id ? { ...i, status: "listed" } : i)),
    );
  }

  async function search(opts?: { q?: string; mode?: Mode }) {
    const useMode = opts?.mode ?? mode;
    const searchQuery = (opts?.q ?? query).trim();
    if (useMode === "personalized" && !searchQuery) return;
    if (loading) return;
    if (opts?.q !== undefined) setQuery(opts.q);
    if (opts?.mode) setMode(opts.mode);
    setView("discover");
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: useMode,
          query: searchQuery,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minMarginPct: minMargin ? Number(minMargin) : undefined,
        }),
      });
      const text = await res.text();
      let data: DiscoverResponse & { error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        // Non-JSON body = the hosting platform returned an error/timeout page.
        throw new Error(
          res.status === 504 || /timeout|timed out/i.test(text)
            ? "The hunt took too long and timed out. Try again, narrow it with a search term, or set a max price to speed it up."
            : `Search failed (${res.status}). Please try again.`,
        );
      }
      if (!res.ok) throw new Error(data.error || "Discovery failed.");
      setResult(data as DiscoverResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const potentialProfit = inventory.reduce((sum, i) => sum + (i.profit || 0), 0);

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

        {/* Nav */}
        <nav style={{ display: "flex", gap: 6 }}>
          <NavTab
            active={view === "discover"}
            onClick={() => setView("discover")}
          >
            Discover
          </NavTab>
          <NavTab
            active={view === "inventory"}
            onClick={() => setView("inventory")}
          >
            Inventory
            {inventory.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  background: "var(--accent)",
                  color: "#04140d",
                  borderRadius: 20,
                  padding: "1px 7px",
                  fontWeight: 700,
                }}
              >
                {inventory.length}
              </span>
            )}
          </NavTab>
        </nav>
      </header>

      {configured === false && <SetupBanner />}

      {view === "discover" ? (
        <>
          {/* Hero */}
          <section style={{ textAlign: "center", padding: "28px 0 24px" }}>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 44px)",
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
                margin: "14px auto 0",
                lineHeight: 1.5,
              }}
            >
              Let the seeker agent hunt on its own, or point it at exactly what
              you want.
            </p>
          </section>

          {/* Mode toggle */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <ModeButton active={mode === "auto"} onClick={() => setMode("auto")}>
              🤖 Auto-hunt
            </ModeButton>
            <ModeButton
              active={mode === "personalized"}
              onClick={() => setMode("personalized")}
            >
              🎯 Search for something
            </ModeButton>
          </div>

          {/* Search panel */}
          <section
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
            }}
          >
            {mode === "personalized" ? (
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
                  style={primaryBtn(loading || !query.trim())}
                >
                  {loading ? "Hunting…" : "Find deals"}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    flex: "1 1 280px",
                    margin: 0,
                    fontSize: 14,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  The agent picks high-resale categories itself and scans the web
                  for the best underpriced finds — no input needed.
                </p>
                <button
                  onClick={() => search({ mode: "auto" })}
                  disabled={loading}
                  style={primaryBtn(loading)}
                >
                  {loading ? "Hunting…" : "Run auto-hunt"}
                </button>
              </div>
            )}

            <div
              style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}
            >
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

            {mode === "personalized" && !result && !loading && (
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
                    onClick={() => search({ q: ex, mode: "personalized" })}
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

          {loading && <LoadingState line={STATUS_LINES[statusIdx]} />}

          {error && !loading && <ErrorBox>{error}</ErrorBox>}

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
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    margin: 0,
                    maxWidth: 560,
                  }}
                >
                  {result.summary}
                </p>
              </div>

              {result.deals.length > 0 ? (
                <div style={gridStyle}>
                  {result.deals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      context="discover"
                      inInventory={inInventory(deal.id)}
                      onAdd={addToInventory}
                    />
                  ))}
                </div>
              ) : (
                <EmptyNote>
                  No verifiable under-retail deals this time. Try auto-hunt again
                  or broaden your filters.
                </EmptyNote>
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
        </>
      ) : (
        /* ---- Inventory view ---- */
        <section className="fade-up" style={{ paddingTop: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              Your inventory
            </h2>
            {inventory.length > 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {inventory.length} item{inventory.length === 1 ? "" : "s"} ·{" "}
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {money(potentialProfit)} potential profit
                </span>
              </div>
            )}
          </div>

          {inventory.length === 0 ? (
            <EmptyNote>
              Nothing here yet. Hunt for deals under <strong>Discover</strong>,
              then hit <strong>“+ Bought it”</strong> on anything you purchase to
              track it here — and send it to the reseller agent in one click.
            </EmptyNote>
          ) : (
            <div style={gridStyle}>
              {inventory.map((item) => (
                <div key={item.id} style={{ position: "relative" }}>
                  {item.status === "listed" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 2,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        borderRadius: 6,
                        padding: "3px 7px",
                      }}
                    >
                      Listed
                    </span>
                  )}
                  <DealCard
                    deal={item}
                    context="inventory"
                    onResell={setActive}
                    onRemove={removeFromInventory}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {active && (
        <ResellModal
          deal={active}
          onClose={() => setActive(null)}
          onListed={markListed}
        />
      )}
    </main>
  );
}

/* ---------------- presentational helpers ---------------- */

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
  gap: 16,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "13px 26px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "var(--panel-2)" : "var(--accent)",
    color: disabled ? "var(--muted)" : "#04140d",
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "default" : "pointer",
  };
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--border)" : "transparent"}`,
        background: active ? "var(--panel)" : "transparent",
        color: active ? "var(--text)" : "var(--muted)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 16px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

function LoadingState({ line }: { line: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
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
      <div style={{ fontSize: 14 }}>{line}</div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>
        The agent is browsing the live web — this can take 30–90 seconds.
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 24px",
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6,
        background: "var(--panel)",
        border: "1px dashed var(--border)",
        borderRadius: 14,
      }}
    >
      {children}
    </div>
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
      need an Anthropic API key. Set{" "}
      <code className="mono">ANTHROPIC_API_KEY</code> in your environment (on
      Vercel: Project → Settings → Environment Variables) and redeploy. Locally,
      copy <code className="mono">.env.example</code> to{" "}
      <code className="mono">.env.local</code>. Get a key at{" "}
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
