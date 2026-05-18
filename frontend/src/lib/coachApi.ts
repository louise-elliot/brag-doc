import type { CoachingStyle, UserContext } from "./types";

export type { CoachingStyle, UserContext };

export interface CoachMessage {
  role: "coach" | "user";
  text: string;
  notes?: string[];
}

export interface CoachTurnRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
  coaching_style: CoachingStyle;
  user_context: UserContext | null;
}

export interface CoachTurnResponse {
  text: string;
  notes: string[];
}

export interface CoachReframeRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
  coaching_style: CoachingStyle;
  user_context: UserContext | null;
}

export interface CoachReframeResponse {
  reframed: string;
  notes: string[];
}

async function postJson<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<TRes>;
}

export function coachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse> {
  return postJson<CoachTurnRequest, CoachTurnResponse>("/api/coach/turn", req);
}

export function coachReframe(
  req: CoachReframeRequest
): Promise<CoachReframeResponse> {
  return postJson<CoachReframeRequest, CoachReframeResponse>(
    "/api/coach/reframe",
    req
  );
}
