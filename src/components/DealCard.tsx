"use client";

import type { Deal } from "@/lib/types";

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

const confidenceColor: Record<string, string> = {
  high: "var(--accent)",
  medium: "var(--warn)",
  low: "var(--muted)",
};

export default function DealCard({
  deal,
  onResell,
}: {
  deal: Deal;
  onResell: (deal: Deal) => void;
}) {
  const positive = deal.profit > 0;
  return (
    <div
      className="fade-up"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 14, padding: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={
            deal.imageUrl ||
            "data:image/svg+xml;utf8," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%2319212d"/><text x="48" y="54" font-size="32" text-anchor="middle" fill="%238a99ad">?</text></svg>',
              )
          }
          width={84}
          height={84}
          style={{
            width: 84,
            height: 84,
            objectFit: "cover",
            borderRadius: 10,
            background: "var(--panel-2)",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "var(--muted)",
              }}
            >
              {deal.source}
            </span>
            <span style={{ color: "var(--border)" }}>•</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {deal.condition}
            </span>
          </div>
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {deal.title}
          </a>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Stat label="Buy" value={money(deal.price, deal.currency)} />
        <Stat
          label="Resale"
          value={money(deal.estimatedResale, deal.currency)}
          border
        />
        <Stat
          label="Profit"
          value={money(deal.profit, deal.currency)}
          accent={positive ? "var(--accent)" : "var(--danger)"}
          border
        />
      </div>

      <div style={{ padding: "12px 16px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: positive ? "var(--accent)" : "var(--danger)",
            }}
          >
            {deal.marginPct > 0 ? "+" : ""}
            {deal.marginPct}% margin
          </span>
          <span
            style={{
              fontSize: 11,
              color: confidenceColor[deal.confidence],
              textTransform: "capitalize",
            }}
          >
            ● {deal.confidence} confidence
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.5,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {deal.reasoning}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 16px 16px" }}>
        <a
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            textAlign: "center",
            padding: "9px 0",
            borderRadius: 9,
            border: "1px solid var(--border)",
            color: "var(--text)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          View listing ↗
        </a>
        <button
          onClick={() => onResell(deal)}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 9,
            border: "none",
            background: "var(--accent)",
            color: "#04140d",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Draft resale →
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  border,
}: {
  label: string;
  value: string;
  accent?: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderLeft: border ? "1px solid var(--border)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--muted)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{ fontSize: 15, fontWeight: 600, color: accent || "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}
