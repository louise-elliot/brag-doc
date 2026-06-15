const KEY = "byline.hasSeenWelcome";

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function markWelcomeSeen(): void {
  localStorage.setItem(KEY, "1");
}
