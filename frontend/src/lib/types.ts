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
  tagline: string;
}

export const COACHING_STYLE_OPTIONS: CoachingStyleOption[] = [
  {
    key: "trusted-mentor",
    label: "The Trusted Mentor",
    descriptor: "I'm warm, empathetic and patient.",
    tagline: "Pick me if you prefer gentle nudges over blunt feedback.",
  },
  {
    key: "hype-woman",
    label: "The Hype Woman",
    descriptor: "I'm high energy, celebratory and unapologetic.",
    tagline: "Pick me if you prefer energy and enthusiasm.",
  },
  {
    key: "direct-challenger",
    label: "The Direct Challenger",
    descriptor: "I'm incisive, sharp, and no-nonsense.",
    tagline: "Pick me if you don't want any of the 'fluff'.",
  },
  {
    key: "bold-coach",
    label: "The Bold Coach",
    descriptor: "I'm playful, irreverent and witty.",
    tagline: "Pick me if you prefer a more informal conversation.",
  },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  coachingStyle: "trusted-mentor",
  contextHeadline: "",
  contextNotes: "",
};
