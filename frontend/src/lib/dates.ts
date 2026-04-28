function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return formatLocal(new Date());
}

export function localDateFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatLocal(d);
}

export type Timeframe =
  | "last-month"
  | "last-quarter"
  | "ytd"
  | "last-year"
  | "all";

export function computeDateRange(
  timeframe: Timeframe,
  today: Date = new Date()
): { start: string; end: string } {
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (timeframe) {
    case "last-month": {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { start: formatLocal(start), end: formatLocal(end) };
    }
    case "last-quarter": {
      const currentQuarter = Math.floor(month / 3);
      const prevQuarter = (currentQuarter + 3) % 4;
      const prevYear = currentQuarter === 0 ? year - 1 : year;
      const startMonth = prevQuarter * 3;
      const start = new Date(prevYear, startMonth, 1);
      const end = new Date(prevYear, startMonth + 3, 0);
      return { start: formatLocal(start), end: formatLocal(end) };
    }
    case "ytd": {
      return {
        start: formatLocal(new Date(year, 0, 1)),
        end: formatLocal(today),
      };
    }
    case "last-year": {
      return {
        start: formatLocal(new Date(year - 1, 0, 1)),
        end: formatLocal(new Date(year - 1, 11, 31)),
      };
    }
    case "all": {
      return { start: "0000-01-01", end: formatLocal(today) };
    }
  }
}
