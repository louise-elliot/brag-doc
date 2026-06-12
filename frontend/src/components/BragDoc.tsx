"use client";

import { useState, useEffect } from "react";
import type { Entry, UserSettings } from "@/lib/types";
import { DEFAULT_USER_SETTINGS } from "@/lib/types";
import { computeDateRange, type Timeframe } from "@/lib/dates";
import type { TagDef } from "@/lib/tags";
import { readSettings, serializeContext } from "@/lib/settings";

interface BragDocProps {
  entries: Entry[];
  tags: TagDef[];
  onRequireConsent: (run: () => void) => void;
}

type GroupBy = "tag" | "month" | "chronological";

interface BulletGroup {
  tag: string;
  points: string[];
}

const UNTAGGED = "__untagged__";

const LOADING_MESSAGES = [
  "Polishing your wins…",
  "Hyping you up…",
  "Doing the bragging so you don't have to…",
  "Making you sound as impressive as you actually are…",
];

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "last-month", label: "Last month" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "last-year", label: "Last year" },
  { value: "all", label: "All time" },
];

const GROUPBY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "tag", label: "By tag" },
  { value: "month", label: "By month" },
  { value: "chronological", label: "Timeline (no sections)" },
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

export function BragDoc({ entries, tags, onRequireConsent }: BragDocProps) {
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
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    readSettings().then(
      (s) => {
        if (!cancelled) setSettings(s);
      },
      () => {
        /* fall back to defaults */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(id);
  }, [loading]);

  if (entries.length === 0) {
    return (
      <div className="pt-12 text-center py-16">
        <p className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-2">
          Nothing to summarize yet
        </p>
        <p className="font-body text-base text-[var(--color-neutral-500)]">
          Add some journal entries first
        </p>
      </div>
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
          user_context: serializeContext(settings),
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
    <div className="pt-12">
      <header className="max-w-[800px] mb-10">
        <h2 className="font-display text-4xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-4">
          Time for a chat with your boss?
        </h2>
        <p
          className="font-body text-base text-[var(--color-neutral-600)]"
          style={{ lineHeight: 1.6 }}
        >
          Let&apos;s get you ready. Summarise the wins you&apos;ve been logging
          into a polished one-pager, ready for your next performance review,
          1:1, or promotion case.
        </p>
      </header>
      <div className="bg-[var(--color-neutral-0)] border border-[var(--color-neutral-200)] rounded-lg p-6 mb-5 flex flex-col gap-5">
        <SettingRow label="Timeframe">
          <SegmentedControl
            ariaLabel="Timeframe"
            options={TIMEFRAME_OPTIONS}
            value={timeframe}
            onChange={setTimeframe}
          />
        </SettingRow>

        <SettingRow label="Sections">
          <SegmentedControl
            ariaLabel="Sections"
            options={GROUPBY_OPTIONS}
            value={groupBy}
            onChange={setGroupBy}
          />
        </SettingRow>

        <SettingRow label="Tags">
          <div
            role="group"
            aria-label="Filter tags"
            className="flex flex-wrap gap-2"
          >
            {tags.map((tag) => (
              <TagChip
                key={tag.name}
                name={tag.name}
                selected={selectedTags.has(tag.name)}
                onClick={() => toggleTag(tag.name)}
              />
            ))}
            <TagChip
              name="untagged"
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
            placeholder="e.g. focus on cross-functional impact"
            rows={2}
            className="w-full bg-[var(--color-neutral-50)] border border-[var(--color-neutral-300)] rounded-md px-4 py-3 font-body text-base text-[var(--color-neutral-700)] placeholder:text-[var(--color-neutral-400)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)] resize-y min-h-[52px] transition-colors"
          />
        </SettingRow>
      </div>

      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={() => onRequireConsent(() => void generate())}
          disabled={generateDisabled}
          className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-neutral-200)] disabled:text-[var(--color-neutral-400)] disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {noTagsSelected && (
          <span className="font-body text-sm text-[var(--color-neutral-500)]">
            Select at least one tag
          </span>
        )}
      </div>

      {error && (
        <div className="mt-5 bg-[var(--color-error-50)] rounded-md px-4 py-3">
          <p className="font-body text-sm text-[var(--color-error-500)]">
            {error}
          </p>
        </div>
      )}

      {loading && (
        <div className="text-center pt-10">
          <p
            key={loadingMessageIndex}
            className="font-body text-sm text-[var(--color-neutral-500)]"
            style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
          >
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
        </div>
      )}

      {bullets && (
        <div className="mt-6 bg-[var(--color-neutral-0)] border border-[var(--color-neutral-200)] rounded-lg px-7 pt-8 pb-6">
          <div className="flex flex-col">
            {bullets.map((group, groupIndex) => (
              <section key={`${group.tag}-${groupIndex}`} className="mt-10">
                {group.tag && (
                  <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-4 capitalize">
                    {group.tag}
                  </h3>
                )}
                <ul className="flex flex-col gap-3">
                  {group.points.map((point, i) => (
                    <li
                      key={i}
                      className="font-body text-base text-[var(--color-neutral-700)] pl-6 relative before:absolute before:left-0 before:top-3 before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-primary-500)]"
                      style={{ lineHeight: 1.75 }}
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-6 border-t border-[var(--color-neutral-200)] pt-5 flex items-center">
            <button
              type="button"
              onClick={copyToClipboard}
              className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Copy to clipboard
            </button>
            {copied && (
              <span
                role="status"
                className="font-body text-sm font-medium bg-[var(--color-success-50)] text-[var(--color-success-500)] rounded-full px-3 py-1 ml-3"
                style={{ animation: "fadeIn 0.2s ease" }}
              >
                Copied
              </span>
            )}
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
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              "font-body text-sm font-medium rounded-full px-4 py-2 transition-colors cursor-pointer",
              active
                ? "bg-[var(--color-neutral-800)] text-white"
                : "text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-700)]",
            ].join(" ")}
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
    <div className="flex flex-col gap-2">
      <span className="font-display text-lg font-medium text-[var(--color-neutral-800)]">
        {label}
      </span>
      {children}
    </div>
  );
}

interface TagChipProps {
  name: string;
  selected: boolean;
  onClick: () => void;
}

function TagChip({ name, selected, onClick }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "font-body text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors border inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]",
        selected
          ? "bg-[var(--color-primary-500)] border-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] hover:border-[var(--color-primary-600)]"
          : "bg-white border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-50)] hover:border-[var(--color-neutral-400)]",
      ].join(" ")}
    >
      {selected && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8l3 3 7-7" />
        </svg>
      )}
      {name}
    </button>
  );
}
