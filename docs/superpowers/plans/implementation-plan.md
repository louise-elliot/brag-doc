# Confidence Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily wins journal that prompts accomplishment logging, reframes self-critical language with AI, and generates brag doc bullet points.

**Architecture:** Single-page Next.js app (App Router) in `frontend/` with three tabs (Journal, Brag Doc, Settings). Data in localStorage, two API routes proxying Claude Haiku for reframing and brag doc generation.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Vitest, React Testing Library, Playwright, @anthropic-ai/sdk

---

## File Structure

```
frontend/
  .env.local                    # ANTHROPIC_API_KEY
  .gitignore
  package.json
  tsconfig.json
  next.config.ts
  tailwind.config.ts
  vitest.config.ts
  playwright.config.ts
  src/
    app/
      layout.tsx                # Root layout, font imports
      page.tsx                  # Main page, renders App component
      api/
        reframe/
          route.ts              # POST /api/reframe
          route.test.ts         # Unit tests for reframe endpoint
        generate-brag-doc/
          route.ts              # POST /api/generate-brag-doc
          route.test.ts         # Unit tests for brag doc endpoint
    lib/
      entries.ts                # localStorage CRUD for entries
      entries.test.ts           # Unit tests for data layer
      prompts.ts                # Prompt pool and daily selection
      prompts.test.ts           # Unit tests for prompt selection
      types.ts                  # Entry interface, tag constants
    components/
      App.tsx                   # Tab container, state management
      App.test.tsx              # Tab switching tests
      EntryForm.tsx             # Prompt display, text area, tag picker, save
      EntryForm.test.tsx        # Form submission, tag selection tests
      EntryList.tsx             # Past entries list with reframe toggle
      EntryList.test.tsx        # Rendering, toggle tests
      ReframeView.tsx           # Side-by-side original vs reframed
      ReframeView.test.tsx      # Accept/dismiss tests
      BragDoc.tsx               # Generate button, date filter, results, copy
      BragDoc.test.tsx          # Generation flow, copy tests
      Settings.tsx              # Clear data button with confirmation
      Settings.test.tsx         # Clear data tests
      TagPicker.tsx             # Tag selection component
      TagPicker.test.tsx        # Tag toggle tests
  e2e/
    journal.spec.ts             # Full daily flow integration test
    brag-doc.spec.ts            # Brag doc generation integration test
    persistence.spec.ts         # localStorage persistence test
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/tailwind.config.ts`, `frontend/.gitignore`, `frontend/.env.local`, `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`

- [ ] **Step 1: Scaffold Next.js app**

Run from the project root:

```bash
cd frontend && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --no-turbopack
```

Select defaults when prompted. This creates the full Next.js scaffolding with App Router, TypeScript, Tailwind, and ESLint.

- [ ] **Step 2: Install test dependencies**

```bash
cd frontend && npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright @playwright/test
```

- [ ] **Step 3: Install Anthropic SDK**

```bash
cd frontend && npm install @anthropic-ai/sdk
```

- [ ] **Step 4: Create vitest config**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    globals: true,
  },
});
```

Create `frontend/src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create Playwright config**

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

- [ ] **Step 6: Create .env.local**

Create `frontend/.env.local`:

```
ANTHROPIC_API_KEY=your-key-here
```

- [ ] **Step 7: Update .gitignore**

Append to `frontend/.gitignore`:

```
.env.local
```

- [ ] **Step 8: Add test scripts to package.json**

Add to the `"scripts"` section of `frontend/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 9: Strip scaffolding defaults**

Replace `frontend/src/app/page.tsx` with:

```tsx
export default function Home() {
  return <main>Confidence Journal</main>;
}
```

Replace `frontend/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confidence Journal",
  description: "Own your wins. Build your brag doc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Verify setup**

```bash
cd frontend && npm run build && npm run test
```

Expected: Build succeeds, test runner exits with no tests found (that's fine).

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "scaffold Next.js app with test infrastructure"
```

---

### Task 2: Types and Prompt Pool

**Files:**
- Create: `frontend/src/lib/types.ts`, `frontend/src/lib/prompts.ts`, `frontend/src/lib/prompts.test.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/lib/types.ts`:

```typescript
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
```

- [ ] **Step 2: Write failing test for prompts**

Create `frontend/src/lib/prompts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPromptForDate, PROMPTS } from "./prompts";

describe("prompts", () => {
  it("returns a prompt string", () => {
    const prompt = getPromptForDate("2026-04-01");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns the same prompt for the same date", () => {
    const a = getPromptForDate("2026-04-01");
    const b = getPromptForDate("2026-04-01");
    expect(a).toBe(b);
  });

  it("returns different prompts for different dates", () => {
    const prompts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        getPromptForDate(`2026-04-${String(i + 1).padStart(2, "0")}`)
      )
    );
    expect(prompts.size).toBeGreaterThan(1);
  });

  it("has 9 prompts in the pool", () => {
    expect(PROMPTS).toHaveLength(9);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/prompts.test.ts
```

Expected: FAIL -- module `./prompts` not found.

- [ ] **Step 4: Implement prompts**

Create `frontend/src/lib/prompts.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/prompts.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/
git commit -m "add Entry type, tag constants, and prompt pool"
```

---

### Task 3: Data Layer (localStorage CRUD)

**Files:**
- Create: `frontend/src/lib/entries.ts`, `frontend/src/lib/entries.test.ts`

- [ ] **Step 1: Write failing tests for data layer**

Create `frontend/src/lib/entries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  getEntries,
  addEntry,
  updateEntry,
  deleteAllEntries,
  getEntriesByDateRange,
} from "./entries";
import type { Entry } from "./types";

const STORAGE_KEY = "confidence-journal-entries";

function makeEntry(overrides: Partial<Entry> = {}): Omit<Entry, "id" | "createdAt"> {
  return {
    date: "2026-04-01",
    prompt: "What impact did you make today?",
    original: "I helped the team fix a bug",
    reframed: null,
    tags: ["technical"],
    ...overrides,
  };
}

describe("entries data layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no entries exist", () => {
    expect(getEntries()).toEqual([]);
  });

  it("adds an entry and retrieves it", () => {
    const entry = addEntry(makeEntry());
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
    const all = getEntries();
    expect(all).toHaveLength(1);
    expect(all[0].original).toBe("I helped the team fix a bug");
  });

  it("returns entries newest first", () => {
    addEntry(makeEntry({ date: "2026-03-01", original: "first" }));
    addEntry(makeEntry({ date: "2026-04-01", original: "second" }));
    const all = getEntries();
    expect(all[0].original).toBe("second");
    expect(all[1].original).toBe("first");
  });

  it("updates an entry", () => {
    const entry = addEntry(makeEntry());
    updateEntry(entry.id, { reframed: "I resolved a critical bug" });
    const updated = getEntries()[0];
    expect(updated.reframed).toBe("I resolved a critical bug");
    expect(updated.original).toBe("I helped the team fix a bug");
  });

  it("deletes all entries", () => {
    addEntry(makeEntry());
    addEntry(makeEntry());
    deleteAllEntries();
    expect(getEntries()).toEqual([]);
  });

  it("filters entries by date range", () => {
    addEntry(makeEntry({ date: "2026-01-15" }));
    addEntry(makeEntry({ date: "2026-03-15" }));
    addEntry(makeEntry({ date: "2026-04-01" }));
    const filtered = getEntriesByDateRange("2026-03-01", "2026-04-02");
    expect(filtered).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/entries.test.ts
```

Expected: FAIL -- module `./entries` not found.

- [ ] **Step 3: Implement data layer**

Create `frontend/src/lib/entries.ts`:

```typescript
import type { Entry } from "./types";

const STORAGE_KEY = "confidence-journal-entries";

function readEntries(): Entry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeEntries(entries: Entry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getEntries(): Entry[] {
  return readEntries().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function addEntry(
  data: Omit<Entry, "id" | "createdAt">
): Entry {
  const entry: Entry = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const entries = readEntries();
  entries.push(entry);
  writeEntries(entries);
  return entry;
}

export function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "original" | "reframed" | "tags">>
): void {
  const entries = readEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updates };
    writeEntries(entries);
  }
}

export function deleteAllEntries(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getEntriesByDateRange(
  start: string,
  end: string
): Entry[] {
  return getEntries().filter((e) => e.date >= start && e.date <= end);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/entries.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/entries.ts frontend/src/lib/entries.test.ts
git commit -m "add localStorage data layer with CRUD and date filtering"
```

---

### Task 4: TagPicker Component

**Files:**
- Create: `frontend/src/components/TagPicker.tsx`, `frontend/src/components/TagPicker.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/TagPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "./TagPicker";

describe("TagPicker", () => {
  it("renders all tags", () => {
    render(<TagPicker selected={[]} onChange={() => {}} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
    expect(screen.getByText("collaboration")).toBeInTheDocument();
    expect(screen.getByText("problem-solving")).toBeInTheDocument();
    expect(screen.getByText("communication")).toBeInTheDocument();
    expect(screen.getByText("mentoring")).toBeInTheDocument();
  });

  it("toggles a tag on click", async () => {
    const onChange = vi.fn();
    render(<TagPicker selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith(["leadership"]);
  });

  it("removes a tag when already selected", async () => {
    const onChange = vi.fn();
    render(<TagPicker selected={["leadership"]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("visually distinguishes selected tags", () => {
    render(<TagPicker selected={["technical"]} onChange={() => {}} />);
    const tag = screen.getByText("technical");
    expect(tag.className).toMatch(/bg-purple/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/TagPicker.test.tsx
```

Expected: FAIL -- module `./TagPicker` not found.

- [ ] **Step 3: Implement TagPicker**

Create `frontend/src/components/TagPicker.tsx`:

```tsx
"use client";

import { TAGS } from "@/lib/types";

interface TagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
            selected.includes(tag)
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/TagPicker.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TagPicker.tsx frontend/src/components/TagPicker.test.tsx
git commit -m "add TagPicker component"
```

---

### Task 5: EntryForm Component

**Files:**
- Create: `frontend/src/components/EntryForm.tsx`, `frontend/src/components/EntryForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/EntryForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryForm } from "./EntryForm";

describe("EntryForm", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it("displays the prompt", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(
      screen.getByText("What impact did you make today?")
    ).toBeInTheDocument();
  });

  it("submits entry with text and tags", async () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    await userEvent.type(
      screen.getByPlaceholderText("Write about your win..."),
      "Led the design review"
    );
    await userEvent.click(screen.getByText("leadership"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockOnSave).toHaveBeenCalledWith({
      original: "Led the design review",
      tags: ["leadership"],
    });
  });

  it("clears form after save", async () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    const textarea = screen.getByPlaceholderText("Write about your win...");
    await userEvent.type(textarea, "Something great");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(textarea).toHaveValue("");
  });

  it("disables save when text is empty", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/EntryForm.test.tsx
```

Expected: FAIL -- module `./EntryForm` not found.

- [ ] **Step 3: Implement EntryForm**

Create `frontend/src/components/EntryForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";

interface EntryFormProps {
  prompt: string;
  onSave: (data: { original: string; tags: string[] }) => void;
}

export function EntryForm({ prompt, onSave }: EntryFormProps) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ original: text.trim(), tags });
    setText("");
    setTags([]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-lg font-semibold text-white">{prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write about your win..."
        rows={4}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
      />
      <TagPicker selected={tags} onChange={setTags} />
      <button
        type="submit"
        disabled={!text.trim()}
        className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
      >
        Save
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/EntryForm.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EntryForm.tsx frontend/src/components/EntryForm.test.tsx
git commit -m "add EntryForm component with prompt, text input, and tags"
```

---

### Task 6: ReframeView Component

**Files:**
- Create: `frontend/src/components/ReframeView.tsx`, `frontend/src/components/ReframeView.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/ReframeView.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReframeView } from "./ReframeView";

describe("ReframeView", () => {
  const props = {
    original: "I just helped a bit with the project",
    reframed: "I contributed key technical work to the project",
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
  };

  it("shows original and reframed side by side", () => {
    render(<ReframeView {...props} />);
    expect(
      screen.getByText("I just helped a bit with the project")
    ).toBeInTheDocument();
    expect(
      screen.getByText("I contributed key technical work to the project")
    ).toBeInTheDocument();
  });

  it("shows 'Your version' and 'Reframed' labels", () => {
    render(<ReframeView {...props} />);
    expect(screen.getByText("Your version")).toBeInTheDocument();
    expect(screen.getByText("Reframed")).toBeInTheDocument();
  });

  it("calls onAccept when accept is clicked", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(props.onAccept).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss is clicked", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(props.onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/ReframeView.test.tsx
```

Expected: FAIL -- module `./ReframeView` not found.

- [ ] **Step 3: Implement ReframeView**

Create `frontend/src/components/ReframeView.tsx`:

```tsx
"use client";

interface ReframeViewProps {
  original: string;
  reframed: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ReframeView({
  original,
  reframed,
  onAccept,
  onDismiss,
}: ReframeViewProps) {
  return (
    <div className="border border-purple-800 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-400 mb-2">
            Your version
          </p>
          <p className="text-gray-300">{original}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-purple-400 mb-2">
            Reframed
          </p>
          <p className="text-white">{reframed}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded hover:bg-purple-500 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 bg-gray-800 text-gray-400 text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/ReframeView.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReframeView.tsx frontend/src/components/ReframeView.test.tsx
git commit -m "add ReframeView side-by-side comparison component"
```

---

### Task 7: EntryList Component

**Files:**
- Create: `frontend/src/components/EntryList.tsx`, `frontend/src/components/EntryList.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/EntryList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryList } from "./EntryList";
import type { Entry } from "@/lib/types";

const entries: Entry[] = [
  {
    id: "1",
    date: "2026-04-01",
    prompt: "What impact did you make?",
    original: "Led the architecture review",
    reframed: "Drove architectural decisions for the team",
    tags: ["leadership"],
    createdAt: "2026-04-01T18:00:00Z",
  },
  {
    id: "2",
    date: "2026-03-31",
    prompt: "What did you ship?",
    original: "Shipped the new dashboard",
    reframed: null,
    tags: ["technical"],
    createdAt: "2026-03-31T18:00:00Z",
  },
];

describe("EntryList", () => {
  it("renders all entries", () => {
    render(<EntryList entries={entries} />);
    expect(screen.getByText("Led the architecture review")).toBeInTheDocument();
    expect(screen.getByText("Shipped the new dashboard")).toBeInTheDocument();
  });

  it("shows tags for each entry", () => {
    render(<EntryList entries={entries} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("toggles reframed version visibility", async () => {
    render(<EntryList entries={entries} />);
    const toggle = screen.getByText("Show reframed");
    await userEvent.click(toggle);
    expect(
      screen.getByText("Drove architectural decisions for the team")
    ).toBeInTheDocument();
  });

  it("does not show toggle when no reframed version exists", () => {
    render(<EntryList entries={[entries[1]]} />);
    expect(screen.queryByText("Show reframed")).not.toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(<EntryList entries={[]} />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/EntryList.test.tsx
```

Expected: FAIL -- module `./EntryList` not found.

- [ ] **Step 3: Implement EntryList**

Create `frontend/src/components/EntryList.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

interface EntryListProps {
  entries: Entry[];
}

export function EntryList({ entries }: EntryListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (entries.length === 0) {
    return <p className="text-gray-500">No entries yet</p>;
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="border border-gray-800 rounded-lg p-4 space-y-2"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{entry.date}</span>
            <div className="flex gap-2">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-gray-300">{entry.original}</p>
          {entry.reframed && (
            <>
              <button
                onClick={() => toggleExpanded(entry.id)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {expanded.has(entry.id) ? "Hide reframed" : "Show reframed"}
              </button>
              {expanded.has(entry.id) && (
                <p className="text-white border-l-2 border-purple-600 pl-3">
                  {entry.reframed}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/EntryList.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EntryList.tsx frontend/src/components/EntryList.test.tsx
git commit -m "add EntryList component with reframe toggle"
```

---

### Task 8: API Route -- Reframe

**Files:**
- Create: `frontend/src/app/api/reframe/route.ts`, `frontend/src/app/api/reframe/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/app/api/reframe/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "I resolved a critical production issue" }],
        }),
      },
    })),
  };
});

import { POST } from "./route";

describe("POST /api/reframe", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("returns reframed text", async () => {
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "I just helped fix a bug" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reframed).toBe("I resolved a critical production issue");
  });

  it("returns 400 when text is missing", async () => {
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/app/api/reframe/route.test.ts
```

Expected: FAIL -- module `./route` not found.

- [ ] **Step 3: Implement reframe route**

Create `frontend/src/app/api/reframe/route.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a confidence coach for women in tech. Reframe the following accomplishment to be more direct, impactful, and free of self-diminishing language. Preserve the facts but remove hedging, luck-attribution, and team-deflection. Keep approximately the same length. Return only the reframed text, no commentary.`;

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: body.text }],
  });

  const reframed =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ reframed });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/app/api/reframe/route.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/reframe/
git commit -m "add POST /api/reframe endpoint with Claude Haiku"
```

---

### Task 9: API Route -- Generate Brag Doc

**Files:**
- Create: `frontend/src/app/api/generate-brag-doc/route.ts`, `frontend/src/app/api/generate-brag-doc/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/app/api/generate-brag-doc/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                bullets: [
                  {
                    tag: "leadership",
                    points: ["Drove architectural decisions across the team"],
                  },
                ],
              }),
            },
          ],
        }),
      },
    })),
  };
});

import { POST } from "./route";

describe("POST /api/generate-brag-doc", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("returns grouped bullet points", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            id: "1",
            date: "2026-04-01",
            prompt: "What impact?",
            original: "Led the review",
            reframed: null,
            tags: ["leadership"],
            createdAt: "2026-04-01T18:00:00Z",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bullets).toHaveLength(1);
    expect(data.bullets[0].tag).toBe("leadership");
    expect(data.bullets[0].points).toContain(
      "Drove architectural decisions across the team"
    );
  });

  it("returns 400 when entries is missing", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/app/api/generate-brag-doc/route.test.ts
```

Expected: FAIL -- module `./route` not found.

- [ ] **Step 3: Implement brag doc route**

Create `frontend/src/app/api/generate-brag-doc/route.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Entry } from "@/lib/types";

const SYSTEM_PROMPT = `You are a performance review coach for women in tech. Given a list of journal entries about professional accomplishments, synthesize them into concise, impact-focused bullet points grouped by category. Each bullet should be written in strong, confident language suitable for pasting into a performance self-review.

Return JSON in this exact format:
{"bullets": [{"tag": "category name", "points": ["bullet point 1", "bullet point 2"]}]}

Return only the JSON, no other text.`;

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.entries || !Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries array is required" },
      { status: 400 }
    );
  }

  const entries: Entry[] = body.entries;
  const summary = entries
    .map((e) => `[${e.tags.join(", ")}] ${e.original}`)
    .join("\n");

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: summary }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "{}";
  const parsed = JSON.parse(text);

  return NextResponse.json(parsed);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/app/api/generate-brag-doc/route.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/generate-brag-doc/
git commit -m "add POST /api/generate-brag-doc endpoint"
```

---

### Task 10: BragDoc Component

**Files:**
- Create: `frontend/src/components/BragDoc.tsx`, `frontend/src/components/BragDoc.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/BragDoc.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BragDoc } from "./BragDoc";
import type { Entry } from "@/lib/types";

const entries: Entry[] = [
  {
    id: "1",
    date: "2026-04-01",
    prompt: "What impact?",
    original: "Led the review",
    reframed: null,
    tags: ["leadership"],
    createdAt: "2026-04-01T18:00:00Z",
  },
];

describe("BragDoc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows generate button", () => {
    render(<BragDoc entries={entries} />);
    expect(
      screen.getByRole("button", { name: "Generate" })
    ).toBeInTheDocument();
  });

  it("shows date range filter", () => {
    render(<BragDoc entries={entries} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("displays generated bullets", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [
            {
              tag: "leadership",
              points: ["Drove architectural decisions"],
            },
          ],
        }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Drove architectural decisions")
      ).toBeInTheDocument();
    });
  });

  it("copies to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [
            { tag: "leadership", points: ["Drove decisions"] },
          ],
        }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(screen.getByText("Drove decisions")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Copy to clipboard" })
    );
    expect(writeText).toHaveBeenCalled();
  });

  it("shows error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "API error" }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to generate brag doc. Please try again.")
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no entries", () => {
    render(<BragDoc entries={[]} />);
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/BragDoc.test.tsx
```

Expected: FAIL -- module `./BragDoc` not found.

- [ ] **Step 3: Implement BragDoc**

Create `frontend/src/components/BragDoc.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

interface BragDocProps {
  entries: Entry[];
}

type DateRange = "30" | "90" | "180" | "all";

interface BulletGroup {
  tag: string;
  points: string[];
}

function filterByRange(entries: Entry[], range: DateRange): Entry[] {
  if (range === "all") return entries;
  const days = parseInt(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

export function BragDoc({ entries }: BragDocProps) {
  const [range, setRange] = useState<DateRange>("all");
  const [bullets, setBullets] = useState<BulletGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="text-gray-500">Add some journal entries first</p>;
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setBullets(null);

    const filtered = filterByRange(entries, range);
    const response = await fetch("/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: filtered }),
    });

    if (!response.ok) {
      setError("Failed to generate brag doc. Please try again.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setBullets(data.bullets);
    setLoading(false);
  }

  function copyToClipboard() {
    if (!bullets) return;
    const text = bullets
      .map(
        (group) =>
          `${group.tag.toUpperCase()}\n${group.points.map((p) => `- ${p}`).join("\n")}`
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
        >
          <option value="30">Last 30 days</option>
          <option value="90">Last quarter</option>
          <option value="180">Last 6 months</option>
          <option value="all">All time</option>
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-purple-500 transition-colors"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {bullets && (
        <div className="space-y-4">
          {bullets.map((group) => (
            <div key={group.tag}>
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
                {group.tag}
              </h3>
              <ul className="space-y-1">
                {group.points.map((point, i) => (
                  <li key={i} className="text-gray-300">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            onClick={copyToClipboard}
            className="px-4 py-1.5 bg-gray-800 text-gray-300 text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/BragDoc.test.tsx
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BragDoc.tsx frontend/src/components/BragDoc.test.tsx
git commit -m "add BragDoc component with generation, filtering, and clipboard"
```

---

### Task 11: Settings Component

**Files:**
- Create: `frontend/src/components/Settings.tsx`, `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "./Settings";

describe("Settings", () => {
  it("shows clear data button", () => {
    render(<Settings onClearData={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    render(<Settings onClearData={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    expect(
      screen.getByText("This will permanently delete all your journal entries.")
    ).toBeInTheDocument();
  });

  it("calls onClearData when confirmed", async () => {
    const onClearData = vi.fn();
    render(<Settings onClearData={onClearData} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );
    expect(onClearData).toHaveBeenCalled();
  });

  it("cancels without clearing", async () => {
    const onClearData = vi.fn();
    render(<Settings onClearData={onClearData} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearData).not.toHaveBeenCalled();
    expect(
      screen.queryByText("This will permanently delete all your journal entries.")
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/Settings.test.tsx
```

Expected: FAIL -- module `./Settings` not found.

- [ ] **Step 3: Implement Settings**

Create `frontend/src/components/Settings.tsx`:

```tsx
"use client";

import { useState } from "react";

interface SettingsProps {
  onClearData: () => void;
}

export function Settings({ onClearData }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="px-4 py-2 bg-red-900 text-red-300 font-semibold rounded hover:bg-red-800 transition-colors"
        >
          Clear all data
        </button>
      ) : (
        <div className="border border-red-800 rounded-lg p-4 space-y-3">
          <p className="text-red-300">
            This will permanently delete all your journal entries.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onClearData();
                setConfirming(false);
              }}
              className="px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-500 transition-colors"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-1.5 bg-gray-800 text-gray-400 text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/Settings.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "add Settings component with clear data confirmation"
```

---

### Task 12: App Component (Tab Container)

**Files:**
- Create: `frontend/src/components/App.tsx`, `frontend/src/components/App.test.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

vi.mock("@/lib/entries", () => ({
  getEntries: vi.fn().mockReturnValue([]),
  addEntry: vi.fn().mockReturnValue({
    id: "1",
    date: "2026-04-01",
    prompt: "What impact?",
    original: "Test entry",
    reframed: null,
    tags: [],
    createdAt: "2026-04-01T18:00:00Z",
  }),
  updateEntry: vi.fn(),
  deleteAllEntries: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  getPromptForDate: vi.fn().mockReturnValue("What impact did you make today?"),
}));

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Journal tab by default", () => {
    render(<App />);
    expect(
      screen.getByText("What impact did you make today?")
    ).toBeInTheDocument();
  });

  it("switches to Brag Doc tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "Brag Doc" }));
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });

  it("switches to Settings tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("highlights active tab", async () => {
    render(<App />);
    const journalTab = screen.getByRole("tab", { name: "Journal" });
    expect(journalTab.className).toMatch(/border-purple/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/App.test.tsx
```

Expected: FAIL -- module `./App` not found.

- [ ] **Step 3: Implement App**

Create `frontend/src/components/App.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
import { ReframeView } from "./ReframeView";
import { BragDoc } from "./BragDoc";
import { Settings } from "./Settings";
import { getEntries, addEntry, updateEntry, deleteAllEntries } from "@/lib/entries";
import { getPromptForDate } from "@/lib/prompts";
import type { Entry } from "@/lib/types";

type Tab = "journal" | "bragdoc" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "journal", label: "Journal" },
  { key: "bragdoc", label: "Brag Doc" },
  { key: "settings", label: "Settings" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("journal");
  const [entries, setEntries] = useState<Entry[]>(() => getEntries());
  const [reframing, setReframing] = useState<{
    entryId: string;
    original: string;
    reframed: string;
  } | null>(null);
  const [reframeLoading, setReframeLoading] = useState(false);
  const [reframeError, setReframeError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const prompt = getPromptForDate(today);

  const refreshEntries = useCallback(() => {
    setEntries(getEntries());
  }, []);

  async function handleSave(data: { original: string; tags: string[] }) {
    const entry = addEntry({
      date: today,
      prompt,
      original: data.original,
      reframed: null,
      tags: data.tags,
    });
    refreshEntries();

    setReframeLoading(true);
    setReframeError(null);
    try {
      const response = await fetch("/api/reframe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.original }),
      });
      if (!response.ok) throw new Error("Reframe failed");
      const result = await response.json();
      updateEntry(entry.id, { reframed: result.reframed });
      refreshEntries();
      setReframing({
        entryId: entry.id,
        original: data.original,
        reframed: result.reframed,
      });
    } catch {
      setReframeError("Could not reframe your entry. It has been saved as-is.");
    } finally {
      setReframeLoading(false);
    }
  }

  function handleAcceptReframe() {
    if (!reframing) return;
    updateEntry(reframing.entryId, { original: reframing.reframed });
    refreshEntries();
    setReframing(null);
  }

  function handleDismissReframe() {
    setReframing(null);
  }

  function handleClearData() {
    deleteAllEntries();
    refreshEntries();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">CONFIDENCE</h1>
      </header>

      <nav className="flex border-b border-gray-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              tab === key
                ? "border-b-2 border-purple-500 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {tab === "journal" && (
          <div className="space-y-8">
            <EntryForm prompt={prompt} onSave={handleSave} />

            {reframeLoading && (
              <p className="text-gray-500">Reframing your entry...</p>
            )}

            {reframeError && <p className="text-red-400">{reframeError}</p>}

            {reframing && (
              <ReframeView
                original={reframing.original}
                reframed={reframing.reframed}
                onAccept={handleAcceptReframe}
                onDismiss={handleDismissReframe}
              />
            )}

            <div>
              <h2 className="text-lg font-semibold mb-4">Past entries</h2>
              <EntryList entries={entries} />
            </div>
          </div>
        )}

        {tab === "bragdoc" && <BragDoc entries={entries} />}

        {tab === "settings" && <Settings onClearData={handleClearData} />}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/App.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Update page.tsx to render App**

Replace `frontend/src/app/page.tsx` with:

```tsx
"use client";

import { App } from "@/components/App";

export default function Home() {
  return <App />;
}
```

- [ ] **Step 6: Verify the app builds**

```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/App.tsx frontend/src/components/App.test.tsx frontend/src/app/page.tsx
git commit -m "add App component with tab navigation and reframe flow"
```

---

### Task 13: Run All Unit Tests

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && npx vitest run
```

Expected: All tests pass (prompts, entries, TagPicker, EntryForm, ReframeView, EntryList, BragDoc, Settings, App, reframe route, brag-doc route).

- [ ] **Step 2: Fix any failures**

If any tests fail, read the error output and fix. Re-run until all pass.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A frontend/src/
git commit -m "fix: resolve test failures from integration"
```

Only commit if there were fixes. Skip if all tests passed on first run.

---

### Task 14: Playwright Integration Tests

**Files:**
- Create: `frontend/e2e/journal.spec.ts`, `frontend/e2e/brag-doc.spec.ts`, `frontend/e2e/persistence.spec.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
cd frontend && npx playwright install chromium
```

- [ ] **Step 2: Create journal flow test**

Create `frontend/e2e/journal.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("displays a daily prompt", async ({ page }) => {
  await expect(page.locator("main")).toContainText("?");
});

test("saves an entry and shows it in the list", async ({ page }) => {
  await page.fill('textarea[placeholder="Write about your win..."]', "I led the standup today");
  await page.click("text=leadership");
  await page.click('button:has-text("Save")');

  await expect(page.locator("text=I led the standup today")).toBeVisible();
  await expect(page.locator("text=leadership")).toBeVisible();
});

test("save button is disabled when text is empty", async ({ page }) => {
  await expect(page.locator('button:has-text("Save")')).toBeDisabled();
});

test("clears textarea after save", async ({ page }) => {
  const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  await textarea.fill("Something great");
  await page.click('button:has-text("Save")');
  await expect(textarea).toHaveValue("");
});
```

- [ ] **Step 3: Create brag doc test**

Create `frontend/e2e/brag-doc.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("shows empty state on Brag Doc tab with no entries", async ({ page }) => {
  await page.click('button[role="tab"]:has-text("Brag Doc")');
  await expect(page.locator("text=Add some journal entries first")).toBeVisible();
});

test("generate button appears when entries exist", async ({ page }) => {
  await page.fill('textarea[placeholder="Write about your win..."]', "Built the API");
  await page.click("text=technical");
  await page.click('button:has-text("Save")');

  await page.click('button[role="tab"]:has-text("Brag Doc")');
  await expect(page.locator('button:has-text("Generate")')).toBeVisible();
});
```

- [ ] **Step 4: Create persistence test**

Create `frontend/e2e/persistence.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("entries persist across page reloads", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('textarea[placeholder="Write about your win..."]', "Persisted entry");
  await page.click('button:has-text("Save")');
  await expect(page.locator("text=Persisted entry")).toBeVisible();

  await page.reload();
  await expect(page.locator("text=Persisted entry")).toBeVisible();
});

test("clear all data removes entries", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('textarea[placeholder="Write about your win..."]', "To be deleted");
  await page.click('button:has-text("Save")');

  await page.click('button[role="tab"]:has-text("Settings")');
  await page.click('button:has-text("Clear all data")');
  await page.click('button:has-text("Yes, delete everything")');

  await page.click('button[role="tab"]:has-text("Journal")');
  await expect(page.locator("text=No entries yet")).toBeVisible();
});
```

- [ ] **Step 5: Run integration tests**

```bash
cd frontend && npx playwright test
```

Expected: All tests pass. The reframe/brag-doc API tests may fail if no API key is set -- that's expected for CI. The journal, persistence, and settings tests should all pass.

- [ ] **Step 6: Fix any failures and re-run**

If tests fail, read the output, fix the issues, and re-run. Common issues: selectors not matching, timing issues (add `waitFor`).

- [ ] **Step 7: Commit**

```bash
git add frontend/e2e/
git commit -m "add Playwright integration tests for journal, brag doc, and persistence"
```

---

### Task 15: Final Verification and Cleanup

**Files:**
- Modify: `frontend/.gitignore` (if needed)

- [ ] **Step 1: Run full unit test suite**

```bash
cd frontend && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Run integration tests**

```bash
cd frontend && npx playwright test
```

Expected: All tests pass.

- [ ] **Step 3: Build the app**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Start the dev server and verify manually**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000 and verify:
- Journal tab shows a prompt
- Can write an entry, select tags, save
- Entry appears in the list below
- Brag Doc tab works (generate button visible)
- Settings tab has clear data button
- Reframing works if `ANTHROPIC_API_KEY` is set in `.env.local`

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A frontend/
git commit -m "final cleanup and verification"
```

Only commit if there were changes. Skip if everything was clean.
