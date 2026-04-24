export interface TagDef {
  name: string;
  color: string;
}

export interface TagColor {
  color: string;
  bg: string;
  border: string;
}

export const PALETTE: string[] = [
  "#D4863C",
  "#6B8AE0",
  "#4CAF82",
  "#C978D6",
  "#E0C46B",
  "#E07272",
  "#8AB4B8",
  "#B89878",
];

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
  { name: "collaboration", color: "#4CAF82" },
  { name: "problem-solving", color: "#C978D6" },
  { name: "communication", color: "#E0C46B" },
  { name: "mentoring", color: "#E07272" },
];

const STORAGE_KEY = "confidence-journal:tags";

function read(): TagDef[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TagDef[]) : null;
  } catch {
    return null;
  }
}

function write(tags: TagDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

export function getTags(): TagDef[] {
  const stored = read();
  if (stored === null) {
    write(DEFAULT_TAGS);
    return [...DEFAULT_TAGS];
  }
  return stored;
}

export function saveTags(tags: TagDef[]): void {
  write(tags);
}

export function nextUnusedColor(tags: TagDef[]): string {
  const used = new Set(tags.map((t) => t.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[tags.length % PALETTE.length];
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function tagColorFromHex(hex: string): TagColor {
  const rgb = hexToRgb(hex);
  return {
    color: hex,
    bg: `rgba(${rgb},0.12)`,
    border: `rgba(${rgb},0.3)`,
  };
}

export function tagColorFor(
  tags: TagDef[],
  name: string
): TagColor | null {
  const match = tags.find((t) => t.name === name);
  return match ? tagColorFromHex(match.color) : null;
}

export function isDuplicateName(
  tags: TagDef[],
  name: string,
  excludeName?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return tags.some(
    (t) => t.name !== excludeName && t.name.toLowerCase() === normalized
  );
}
