export interface Entry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  createdAt: string;
}

export const TAGS = [
  "leadership",
  "technical",
  "collaboration",
  "problem-solving",
  "communication",
  "mentoring",
] as const;

export type Tag = (typeof TAGS)[number];
