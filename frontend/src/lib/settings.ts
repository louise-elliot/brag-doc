import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
  type UserContext,
  type UserSettings,
} from "./types";

const STORAGE_KEY = "confidence-journal-settings";

const VALID_STYLES = new Set<CoachingStyle>(
  COACHING_STYLE_OPTIONS.map((option) => option.key)
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceCoachingStyle(value: unknown): CoachingStyle {
  if (typeof value === "string" && VALID_STYLES.has(value as CoachingStyle)) {
    return value as CoachingStyle;
  }
  return DEFAULT_USER_SETTINGS.coachingStyle;
}

export function readSettings(): UserSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_USER_SETTINGS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
  if (!isPlainObject(parsed)) return DEFAULT_USER_SETTINGS;
  return {
    coachingStyle: coerceCoachingStyle(parsed.coachingStyle),
    contextHeadline:
      typeof parsed.contextHeadline === "string"
        ? parsed.contextHeadline
        : DEFAULT_USER_SETTINGS.contextHeadline,
    contextNotes:
      typeof parsed.contextNotes === "string"
        ? parsed.contextNotes
        : DEFAULT_USER_SETTINGS.contextNotes,
  };
}

export function writeSettings(partial: Partial<UserSettings>): void {
  const next: UserSettings = { ...readSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function serializeContext(settings: UserSettings): UserContext | null {
  if (
    settings.contextHeadline.trim() === "" &&
    settings.contextNotes.trim() === ""
  ) {
    return null;
  }
  return {
    headline: settings.contextHeadline,
    notes: settings.contextNotes,
  };
}
