export const PROMPTS = [
  "What challenge did you navigate?",
  "What decision did you drive forward?",
  "What did you teach or explain to someone?",
  "What problem did you solve?",
  "What did you deliver today?",
  "What feedback did you give that shaped an outcome?",
  "What risk did you take that paid off?",
  "What did you figure out today that was hard?",
  "What's something you did today that you wouldn't have been able to do a year ago?",
  "Did you help someone today?",
  "Was there a moment today where you spoke up when you could have stayed quiet?",
  "Did you mentor, guide or support someone today?"
];

export function getPromptForDate(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return PROMPTS[Math.abs(hash) % PROMPTS.length];
}

export function getRandomPromptExcluding(exclude: string): string {
  const pool = PROMPTS.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
