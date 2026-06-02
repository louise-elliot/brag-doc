import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, userClient } from "./fixtures/supabase-admin";

test.describe("RLS isolation", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };
  let bEntryId: string;

  test.beforeAll(async () => {
    userA = await createTestUser(`rls-a-${Date.now()}@example.test`);
    userB = await createTestUser(`rls-b-${Date.now()}@example.test`);

    const b = userClient(userB.accessToken);
    const { data, error } = await b.from("entries").insert({
      user_id: userB.id,
      date: "2026-05-19",
      prompt: "p",
      original: "user B entry",
      tags: [],
    }).select("id").single();
    if (error) throw error;
    bEntryId = (data as { id: string }).id;
  });

  test.afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  test("user A cannot SELECT user B's entry by id", async () => {
    const a = userClient(userA.accessToken);
    const { data } = await a.from("entries").select("*").eq("id", bEntryId);
    expect(data).toEqual([]);
  });

  test("user A cannot UPDATE user B's entry", async () => {
    const a = userClient(userA.accessToken);
    const { data, error } = await a
      .from("entries")
      .update({ original: "hacked" })
      .eq("id", bEntryId)
      .select("*");
    // Either zero rows affected, or an error — both are acceptable.
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  test("user A cannot DELETE user B's entry", async () => {
    const a = userClient(userA.accessToken);
    const { data, error } = await a.from("entries").delete().eq("id", bEntryId).select("*");
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  test("user A cannot INSERT a row with user B's user_id", async () => {
    const a = userClient(userA.accessToken);
    const { error } = await a.from("entries").insert({
      user_id: userB.id,
      date: "2026-05-19",
      prompt: "p",
      original: "spoofed",
      tags: [],
    });
    expect(error).not.toBeNull();
  });

  test("settings: user A cannot SELECT user B's settings", async () => {
    const b = userClient(userB.accessToken);
    await b.from("settings").upsert({
      user_id: userB.id,
      coaching_style: "hype-woman",
    });

    const a = userClient(userA.accessToken);
    const { data } = await a.from("settings").select("*").eq("user_id", userB.id);
    expect(data).toEqual([]);
  });
});
