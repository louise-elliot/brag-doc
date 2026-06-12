import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDrawer } from "./SettingsDrawer";
import type { TagDef } from "@/lib/tags";
import { signOutCurrentUser } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  signOutCurrentUser: vi.fn(() => Promise.resolve()),
  getCurrentUser: vi.fn(() =>
    Promise.resolve({ id: "u1", email: "user@example.com" })
  ),
}));

const supabaseFunctionsInvoke = vi.fn();
const supabaseAuthSignOut = vi.fn(() => Promise.resolve());
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    functions: { invoke: supabaseFunctionsInvoke },
    auth: {
      signOut: supabaseAuthSignOut,
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      }),
    },
  }),
}));

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>(
    "@/lib/settings"
  );
  return {
    ...actual,
    readSettings: vi.fn(() =>
      Promise.resolve({
        coachingStyle: "trusted-mentor",
        contextHeadline: "",
        contextNotes: "",
        aiConsent: false,
      })
    ),
    writeSettings: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/tags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tags")>("@/lib/tags");
  return {
    ...actual,
    getTags: vi.fn(() => Promise.resolve([])),
    saveTags: vi.fn(() => Promise.resolve()),
  };
});

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership" },
];

function renderDrawer(open: boolean, overrides: Partial<Parameters<typeof SettingsDrawer>[0]> = {}) {
  const props = {
    open,
    onClose: vi.fn(),
    tags: DEFAULT_TAGS,
    onAddTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onRenameTag: vi.fn(),
    onClearData: vi.fn(),
    aiConsent: false,
    onAiConsentChange: vi.fn(),
    ...overrides,
  };
  const result = render(<SettingsDrawer {...props} />);
  return { ...result, props };
}

describe("SettingsDrawer", () => {
  it("renders nothing when closed", () => {
    renderDrawer(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with role=dialog and aria-modal when open", () => {
    renderDrawer(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("close button calls onClose", async () => {
    const { props } = renderDrawer(true);
    const closeButtons = screen.getAllByRole("button", { name: /close settings/i });
    await userEvent.click(closeButtons[0]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose", () => {
    const { props } = renderDrawer(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("backdrop click calls onClose", async () => {
    const { props, container } = renderDrawer(true);
    // The backdrop is the full-screen button behind the drawer panel
    const backdrop = container.querySelector<HTMLButtonElement>(
      'button.absolute.inset-0'
    )!;
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("default active tab is You — shows ContextCard content", () => {
    renderDrawer(true);
    expect(screen.getByRole("textbox", { name: /job title/i })).toBeInTheDocument();
  });

  it("clicking Coach tab shows CoachingStyleCard content", async () => {
    renderDrawer(true);
    await userEvent.click(screen.getByRole("tab", { name: "Coach" }));
    expect(screen.getByRole("radiogroup", { name: /coach persona/i })).toBeInTheDocument();
  });

  it("clicking Data tab shows CategoriesCard and DataCard content", async () => {
    renderDrawer(true);
    await userEvent.click(screen.getByRole("tab", { name: "Data" }));
    expect(screen.getByRole("button", { name: "Clear all entries" })).toBeInTheDocument();
    expect(screen.getByLabelText("New category name")).toBeInTheDocument();
  });

  it("shows the signed-in email and signs out on click", async () => {
    renderDrawer(true);
    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOutCurrentUser).toHaveBeenCalled());
  });

  it("shows the Privacy tab and toggling consent calls onAiConsentChange", () => {
    const onAiConsentChange = vi.fn();
    const { props } = renderDrawer(true, { onAiConsentChange });
    fireEvent.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(props.onAiConsentChange).toHaveBeenCalledWith(true);
  });
});

describe("SettingsDrawer — Delete account", () => {
  beforeEach(() => {
    supabaseFunctionsInvoke.mockReset();
    supabaseAuthSignOut.mockClear();
  });

  it("requires typing email to enable Delete account button", async () => {
    renderDrawer(true);
    // Wait for AccountCard to load the email
    await screen.findByText("user@example.com");
    fireEvent.click(
      await screen.findByRole("button", { name: /delete account/i })
    );
    const confirmInput = await screen.findByLabelText(/type your email/i);
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "user@example.com" } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("invokes delete-account function and redirects", async () => {
    supabaseFunctionsInvoke.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });
    const originalLocation = window.location;
    delete (window as { location?: Location }).location;
    (window as unknown as { location: { href: string } }).location = {
      href: "",
    };

    renderDrawer(true);
    await screen.findByText("user@example.com");
    fireEvent.click(
      await screen.findByRole("button", { name: /delete account/i })
    );
    fireEvent.change(await screen.findByLabelText(/type your email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(supabaseFunctionsInvoke).toHaveBeenCalledWith("delete-account")
    );
    await waitFor(() => expect(supabaseAuthSignOut).toHaveBeenCalled());
    await waitFor(() => expect(window.location.href).toContain("/sign-in"));

    (window as unknown as { location: Location }).location = originalLocation;
  });

  it("surfaces an inline error when the function returns an error", async () => {
    supabaseFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Something went wrong" },
    });

    renderDrawer(true);
    await screen.findByText("user@example.com");
    fireEvent.click(
      await screen.findByRole("button", { name: /delete account/i })
    );
    fireEvent.change(await screen.findByLabelText(/type your email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong"
    );
    expect(supabaseAuthSignOut).not.toHaveBeenCalled();
  });
});
