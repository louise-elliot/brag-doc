export interface Entry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  createdAt: string;
}
