"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { computeDateRange, type Timeframe } from "@/lib/dates";
import { tagColorFromHex, type TagDef } from "@/lib/tags";
import { readSettings, serializeContext } from "@/lib/settings";

interface BragDocProps {
  entries: Entry[];
  tags: TagDef[];
}

type GroupBy = "tag" | "month" | "chronological";

interface BulletGroup {
  tag: string;
  points: string[];
}

const UNTAGGED = "__untagged__";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "last-month", label: "Last month" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "last-year", label: "Last year" },
  { value: "all", label: "All time" },
];

const GROUPBY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "tag", label: "Tag" },
  { value: "month", label: "Month" },
  { value: "chronological", label: "Chronological" },
];

function filterEntries(
  entries: Entry[],
  timeframe: Timeframe,
  selected: Set<string>
): Entry[] {
  const range = computeDateRange(timeframe);
  return entries
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .filter((e) => {
      if (e.tags.length === 0) return selected.has(UNTAGGED);
      return e.tags.some((t) => selected.has(t));
    });
}

export function BragDoc({ entries, tags }: BragDocProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("tag");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    () => new Set([...tags.map((t) => t.name), UNTAGGED])
  );
  const [userPrompt, setUserPrompt] = useState("");
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

  const noTagsSelected = selectedTags.size === 0;
  const generateDisabled = loading || noTagsSelected;

  function toggleTag(name: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setBullets(null);

    try {
      const filtered = filterEntries(entries, timeframe, selectedTags);
      const trimmedPrompt = userPrompt.trim();
      const response = await fetch("/api/generate-brag-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: filtered,
          groupBy,
          ...(trimmedPrompt && { userPrompt: trimmedPrompt }),
          user_context: serializeContext(readSettings()),
        }),
      });

      if (!response.ok) {
        setError("Failed to generate brag doc. Please try again.");
        return;
      }

      const data = await response.json();
      setBullets(data.bullets);
    } catch {
      setError("Failed to generate brag doc. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!bullets) return;
    const text = bullets
      .map((group) => {
        const body = group.points.map((p) => `- ${p}`).join("\n");
        return group.tag ? `${group.tag.toUpperCase()}\n${body}` : body;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setError("Could not copy to clipboard.");
      }
    );
  }

  return (
    <div style={{ paddingTop: "48px" }}>
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "24px 28px",
          marginBottom: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <SettingRow label="Timeframe">
          <SegmentedControl
            ariaLabel="Timeframe"
            options={TIMEFRAME_OPTIONS}
            value={timeframe}
            onChange={setTimeframe}
          />
        </SettingRow>

        <SettingRow label="Organise by">
          <SegmentedControl
            ariaLabel="Organise by"
            options={GROUPBY_OPTIONS}
            value={groupBy}
            onChange={setGroupBy}
          />
        </SettingRow>

        <SettingRow label="Tags">
          <div
            role="group"
            aria-label="Filter tags"
            style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
          >
            {tags.map((tag) => (
              <TagChip
                key={tag.name}
                name={tag.name}
                color={tag.color}
                selected={selectedTags.has(tag.name)}
                onClick={() => toggleTag(tag.name)}
              />
            ))}
            <TagChip
              name="Untagged"
              selected={selectedTags.has(UNTAGGED)}
              onClick={() => toggleTag(UNTAGGED)}
            />
          </div>
        </SettingRow>

        <SettingRow label="Anything else?">
          <textarea
            aria-label="Additional guidance"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Anything you want to emphasize? e.g. 'focus on cross-functional impact', 'this is for a promo case to director level'..."
            rows={2}
            style={{
              width: "100%",
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-primary)",
              resize: "vertical",
              minHeight: "52px",
              outline: "none",
            }}
          />
        </SettingRow>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <button
          onClick={generate}
          disabled={generateDisabled}
          style={{
            padding: "8px 24px",
            background: generateDisabled
              ? "var(--color-surface-raised)"
              : "var(--color-accent)",
            color: generateDisabled
              ? "var(--color-text-tertiary)"
              : "var(--color-base)",
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: generateDisabled ? "not-allowed" : "pointer",
            opacity: generateDisabled ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {noTagsSelected && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-tertiary)",
            }}
          >
            Select at least one tag
          </span>
        )}
      </div>

      {error && (
        <p
          style={{
            color: "var(--color-danger)",
            fontSize: "14px",
            marginTop: "20px",
          }}
        >
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
            marginTop: "24px",
            animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
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

          <div
            style={{ display: "flex", flexDirection: "column", gap: "28px" }}
          >
            {bullets.map((group, groupIndex) => (
              <div key={`${group.tag}-${groupIndex}`}>
                {group.tag && (
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
                )}
                <ul
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
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

          <div
            style={{
              marginTop: "24px",
              borderTop: "1px solid var(--color-border)",
              paddingTop: "20px",
            }}
          >
            <button
              onClick={copyToClipboard}
              style={{
                padding: "8px 20px",
                background: copied
                  ? "var(--color-positive-muted)"
                  : "var(--color-surface-raised)",
                color: copied
                  ? "var(--color-positive)"
                  : "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${
                  copied ? "rgba(76, 175, 130, 0.25)" : "var(--color-border)"
                }`,
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

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: "999px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: selected
                ? "1px solid var(--color-accent-border)"
                : "1px solid var(--color-border)",
              background: selected
                ? "var(--color-accent-muted)"
                : "transparent",
              color: selected
                ? "var(--color-accent)"
                : "var(--color-text-tertiary)",
              letterSpacing: "0.02em",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface SettingRowProps {
  label: string;
  children: React.ReactNode;
}

function SettingRow({ label, children }: SettingRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

interface TagChipProps {
  name: string;
  color?: string;
  selected: boolean;
  onClick: () => void;
}

function TagChip({ name, color, selected, onClick }: TagChipProps) {
  const colors = color ? tagColorFromHex(color) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        fontWeight: 500,
        padding: "5px 12px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: selected && colors
          ? `1px solid ${colors.border}`
          : selected
            ? "1px solid var(--color-text-tertiary)"
            : "1px solid var(--color-border)",
        background: selected && colors
          ? colors.bg
          : selected
            ? "var(--color-surface-raised)"
            : "var(--color-surface)",
        color: selected && colors
          ? colors.color
          : selected
            ? "var(--color-text-primary)"
            : "var(--color-text-tertiary)",
        opacity: selected ? 1 : 0.6,
      }}
    >
      {name}
    </button>
  );
}
