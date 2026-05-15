import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoachPanel } from "./CoachPanel";
import * as coachApi from "@/lib/coachApi";
import { writeSettings } from "@/lib/settings";

const baseEntry = {
  id: "e1",
  original: "I just helped a bit with the migration",
  prompt: "What did you ship?",
  tags: ["technical"],
};

describe("CoachPanel — chatting phase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("fetches the first coach turn on mount and renders it", async () => {
    const turn = vi
      .spyOn(coachApi, "coachTurn")
      .mockResolvedValueOnce({
        text: "Who benefited from the migration?",
        notes: ["vague-language"],
      });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText("Who benefited from the migration?")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("vague-language")).toBeInTheDocument();
    expect(turn).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_text: baseEntry.original,
        prompt: baseEntry.prompt,
        tags: baseEntry.tags,
        conversation: [],
      })
    );
  });

  it("sends the user's reply and renders the next coach turn", async () => {
    vi.spyOn(coachApi, "coachTurn")
      .mockResolvedValueOnce({ text: "Who benefited?", notes: ["vague-language"] })
      .mockResolvedValueOnce({ text: "What did it unblock for them?", notes: [] });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.type(
      screen.getByLabelText(/your reply/i),
      "The platform team"
    );
    await userEvent.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText("The platform team")).toBeInTheDocument();
    expect(
      await screen.findByText("What did it unblock for them?")
    ).toBeInTheDocument();
  });

  it("shows a retry button when the first turn fails", async () => {
    vi.spyOn(coachApi, "coachTurn").mockRejectedValueOnce(new Error("network"));

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/coach didn['']t respond/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onClose when the user closes the panel before reframe", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    const onClose = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={onClose}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("CoachPanel — reframing phase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("calls coachReframe with the full conversation when Reframe it now is clicked", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Who benefited?",
      notes: ["vague-language"],
    });
    const reframeSpy = vi
      .spyOn(coachApi, "coachReframe")
      .mockResolvedValueOnce({ reframed: "Polished version", notes: ["minimising-language"] });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    await waitFor(() => expect(reframeSpy).toHaveBeenCalled());
    expect(reframeSpy.mock.calls[0][0]).toMatchObject({
      entry_text: baseEntry.original,
      conversation: [
        expect.objectContaining({ role: "coach", text: "Who benefited?" }),
      ],
    });
  });

  it("renders ReframeView with reframed text and notes after reframe completes", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Who benefited?",
      notes: [],
    });
    vi.spyOn(coachApi, "coachReframe").mockResolvedValueOnce({
      reframed: "Led the migration that unblocked 40 engineers",
      notes: ["minimising-language", "vague-language"],
    });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    expect(
      await screen.findByDisplayValue(
        "Led the migration that unblocked 40 engineers"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("minimising-language")).toBeInTheDocument();
  });

  it("calls onAccept with the (possibly edited) reframed text and notes when Accept is clicked", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApi, "coachReframe").mockResolvedValueOnce({
      reframed: "Polished",
      notes: ["minimising-language"],
    });
    const onAccept = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={onAccept}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));
    await screen.findByDisplayValue("Polished");
    await userEvent.click(screen.getByRole("button", { name: /^accept$/i }));

    expect(onAccept).toHaveBeenCalledWith("Polished", ["minimising-language"]);
  });

  it("calls onDismiss when Dismiss is clicked on the reframe view", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApi, "coachReframe").mockResolvedValueOnce({
      reframed: "Polished",
      notes: [],
    });
    const onDismiss = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));
    await screen.findByDisplayValue("Polished");
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows a retry button when the reframe call fails", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApi, "coachReframe").mockRejectedValueOnce(new Error("boom"));

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    expect(
      await screen.findByText(/coach didn['']t respond/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("CoachPanel — settings forwarding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("sends the user's coaching_style and serialized user_context on the first turn", async () => {
    writeSettings({
      coachingStyle: "hype-woman",
      contextHeadline: "Senior PM",
      contextNotes: "Pre-promo to director",
    });
    const turn = vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(turn).toHaveBeenCalled());
    expect(turn).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_style: "hype-woman",
        user_context: { headline: "Senior PM", notes: "Pre-promo to director" },
      })
    );
  });

  it("sends user_context: null when both context fields are blank", async () => {
    writeSettings({
      coachingStyle: "trusted-mentor",
      contextHeadline: "",
      contextNotes: "",
    });
    const turn = vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(turn).toHaveBeenCalled());
    expect(turn).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_style: "trusted-mentor",
        user_context: null,
      })
    );
  });

  it("forwards coaching_style and user_context on the reframe call", async () => {
    writeSettings({
      coachingStyle: "bold-coach",
      contextHeadline: "Staff IC",
      contextNotes: "",
    });
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    const reframeSpy = vi
      .spyOn(coachApi, "coachReframe")
      .mockResolvedValueOnce({ reframed: "Polished", notes: [] });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    await waitFor(() => expect(reframeSpy).toHaveBeenCalled());
    expect(reframeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_style: "bold-coach",
        user_context: { headline: "Staff IC", notes: "" },
      })
    );
  });
});
