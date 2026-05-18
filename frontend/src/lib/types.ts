export interface Entry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  createdAt: string;
  coachNotes: string[] | null;
}

export type CoachingStyle =
  | "trusted-mentor"
  | "hype-woman"
  | "direct-challenger"
  | "bold-coach";

export interface UserContext {
  headline: string;
  notes: string;
}

export interface UserSettings {
  coachingStyle: CoachingStyle;
  contextHeadline: string;
  contextNotes: string;
}

export interface CoachingStyleOption {
  key: CoachingStyle;
  label: string;
  descriptor: string;
}

export const COACHING_STYLE_OPTIONS: CoachingStyleOption[] = [
  {
    key: "trusted-mentor",
    label: "The Trusted Mentor",
    descriptor:
      "Warm, wise, unhurried. Gentle nudges. Best for women who find direct feedback triggering.",
  },
  {
    key: "hype-woman",
    label: "The Hype Woman",
    descriptor:
      "High energy, celebratory, zero tolerance for shrinking. Best for women who need an energy boost and respond well to enthusiasm.",
  },
  {
    key: "direct-challenger",
    label: "The Direct Challenger",
    descriptor:
      "High challenge, low ceremony. Cuts to the chase. Best for women who don't like the 'fluff'.",
  },
  {
    key: "bold-coach",
    label: "The Bold Coach",
    descriptor:
      "Playful, punchy, modern. Best for younger users or anyone who wants coaching to feel less like work.",
  },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  coachingStyle: "trusted-mentor",
  contextHeadline: "",
  contextNotes: "",
};
