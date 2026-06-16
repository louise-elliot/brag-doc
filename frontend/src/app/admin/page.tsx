"use client";

import { useEffect, useState } from "react";

interface DailyRow {
  day: string;
  cost_usd: number;
  request_count: number;
}
interface BreakdownRow {
  endpoint: string;
  model: string;
  cost_usd: number;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
}
interface CostSummary {
  budget_usd: number;
  today_spend_usd: number;
  daily: DailyRow[];
  breakdown: BreakdownRow[];
}

type State =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error" }
  | { kind: "ready"; data: CostSummary };

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function AdminCostPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/admin/cost?days=30")
      .then(async (r) => {
        if (r.status === 403) return setState({ kind: "forbidden" });
        if (!r.ok) return setState({ kind: "error" });
        setState({ kind: "ready", data: (await r.json()) as CostSummary });
      })
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading")
    return <main className="max-w-[800px] mx-auto p-8 font-body">Loading…</main>;
  if (state.kind === "forbidden")
    return <main className="max-w-[800px] mx-auto p-8 font-body">Not authorized</main>;
  if (state.kind === "error")
    return (
      <main className="max-w-[800px] mx-auto p-8 font-body">
        Could not load cost summary.
      </main>
    );

  const d = state.data;
  const pct = d.budget_usd > 0 ? Math.min(100, (d.today_spend_usd / d.budget_usd) * 100) : 0;

  return (
    <main className="max-w-[800px] mx-auto p-8 font-body text-[var(--color-neutral-700)]">
      <h1 className="font-display text-3xl text-[var(--color-neutral-800)] mb-6">Cost</h1>

      <section className="mb-10">
        <p className="text-sm text-[var(--color-neutral-500)] mb-1">Today</p>
        <p className="text-2xl font-display text-[var(--color-neutral-800)]">
          {usd(d.today_spend_usd)} <span className="text-base text-[var(--color-neutral-500)]">/ {usd(d.budget_usd)}</span>
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-neutral-200)]">
          <div
            className="h-2 rounded-full bg-[var(--color-primary-500)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl text-[var(--color-neutral-800)] mb-3">Last 30 days</h2>
        <ul className="text-sm">
          {d.daily.map((row) => (
            <li key={row.day} className="flex justify-between py-1 border-b border-[var(--color-neutral-200)]">
              <span>{row.day}</span>
              <span>{usd(row.cost_usd)} · {row.request_count} reqs</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-[var(--color-neutral-800)] mb-3">By endpoint &amp; model</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-neutral-500)]">
              <th className="py-1">Endpoint</th><th>Model</th><th className="text-right">Cost</th><th className="text-right">Reqs</th>
            </tr>
          </thead>
          <tbody>
            {d.breakdown.map((row) => (
              <tr key={`${row.endpoint}-${row.model}`} className="border-t border-[var(--color-neutral-200)]">
                <td className="py-1">{row.endpoint}</td>
                <td>{row.model}</td>
                <td className="text-right">{usd(row.cost_usd)}</td>
                <td className="text-right">{row.request_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
