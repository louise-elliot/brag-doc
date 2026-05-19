export interface TagDef {
  name: string;
}

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
];

const STORAGE_KEY = "byline:tags";
const LEGACY_STORAGE_KEY = "confidence-journal:tags";

function read(): TagDef[] | null {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      raw = legacy;
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (parsed as Array<{ name: string }>).map((t) => ({ name: t.name }));
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
