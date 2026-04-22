"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

interface BragDocProps {
  entries: Entry[];
}

type DateRange = "30" | "90" | "180" | "all";

interface BulletGroup {
  tag: string;
  points: string[];
}

function filterByRange(entries: Entry[], range: DateRange): Entry[] {
  if (range === "all") return entries;
  const days = parseInt(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

export function BragDoc({ entries }: BragDocProps) {
  const [range, setRange] = useState<DateRange>("all");
  const [bullets, setBullets] = useState<BulletGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (entries.length === 0) {
    return (
      <p
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "14px",
          textAlign: "center",
          paddingTop: "80px",
        }}
      >
        Add some journal entries first
      </p>
    );
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setBullets(null);

    const filtered = filterByRange(entries, range);
    const response = await fetch("/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: filtered }),
    });

    if (!response.ok) {
      setError("Failed to generate brag doc. Please try again.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setBullets(data.bullets);
    setLoading(false);
  }

  function copyToClipboard() {
    if (!bullets) return;
    const text = bullets
      .map(
        (group) =>
          `${group.tag.toUpperCase()}\n${group.points.map((p) => `- ${p}`).join("\n")}`
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ paddingTop: "48px" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "32px" }}>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="30">Last 30 days</option>
          <option value="90">Last quarter</option>
          <option value="180">Last 6 months</option>
          <option value="all">All time</option>
        </select>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "8px 24px",
            background: loading ? "var(--color-surface-raised)" : "var(--color-accent)",
            color: loading ? "var(--color-text-tertiary)" : "var(--color-base)",
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--color-danger)", fontSize: "14px", marginBottom: "20px" }}>
          {error}
        </p>
      )}

      {loading && (
        <div style={{ textAlign: "center", paddingTop: "40px" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.05em",
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          >
            Synthesizing your accomplishments...
          </p>
        </div>
      )}

      {bullets && (
        <div
          style={{
            position: "relative",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "32px 28px",
            animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          {/* Floating label */}
          <div
            style={{
              position: "absolute",
              top: "-10px",
              left: "20px",
              background: "var(--color-surface)",
              padding: "0 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
            }}
          >
            Generated Brag Doc
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {bullets.map((group) => (
              <div key={group.tag}>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    marginBottom: "12px",
                    textTransform: "capitalize",
                  }}
                >
                  {group.tag}
                </h3>
                <ul style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {group.points.map((point, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        fontSize: "14px",
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          border: "1.5px solid var(--color-accent)",
                          flexShrink: 0,
                          marginTop: "7px",
                        }}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Copy button */}
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-border)", paddingTop: "20px" }}>
            <button
              onClick={copyToClipboard}
              style={{
                padding: "8px 20px",
                background: copied ? "var(--color-positive-muted)" : "var(--color-surface-raised)",
                color: copied ? "var(--color-positive)" : "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${copied ? "rgba(76, 175, 130, 0.25)" : "var(--color-border)"}`,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
