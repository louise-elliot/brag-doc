export const PROMPTS = [
  "What impact did you make today?",
  "What challenge did you navigate?",
  "What decision did you drive forward?",
  "What did you teach or explain to someone?",
  "What problem did you solve that others hadn't?",
  "What did you ship or deliver?",
  "What feedback did you give that shaped an outcome?",
  "What risk did you take that paid off?",
  "What did you figure out that was hard?",
];

export function getPromptForDate(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return PROMPTS[Math.abs(hash) % PROMPTS.length];
}
