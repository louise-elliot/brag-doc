"use client";

import { useEffect, useState } from "react";
import {
  AccountCard,
  ContextCard,
  CoachingStyleCard,
  CategoriesCard,
  DataCard,
  PrivacyCard,
} from "./Settings";
import type { TagDef } from "@/lib/tags";

type Section = "you" | "coach" | "data" | "privacy";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onClearData: () => void;
  aiConsent: boolean;
  onAiConsentChange: (value: boolean) => void;
}

const SECTIONS: { key: Section; label: string }[] = [
  { key: "you", label: "You" },
  { key: "coach", label: "Coach" },
  { key: "data", label: "Data" },
  { key: "privacy", label: "Privacy" },
];

export function SettingsDrawer({
  open,
  onClose,
  tags,
  onAddTag,
  onDeleteTag,
  onRenameTag,
  onClearData,
  aiConsent,
  onAiConsentChange,
}: SettingsDrawerProps) {
  const [section, setSection] = useState<Section>("you");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-xl flex flex-col"
        style={{ animation: "drawerSlideIn 0.3s ease both" }}
      >
        <header className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-[var(--color-neutral-200)]">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)]">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="font-body text-2xl leading-none text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-100)] rounded-md w-10 h-10 flex items-center justify-center transition-colors cursor-pointer"
          >
            ×
          </button>
        </header>
        <nav role="tablist" aria-label="Settings sections" className="flex gap-6 px-8 border-b border-[var(--color-neutral-200)]">
          {SECTIONS.map(({ key, label }) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(key)}
                className={[
                  "font-body text-sm font-medium pb-3 pt-2 -mb-px border-b-2 transition-colors cursor-pointer",
                  active
                    ? "text-[var(--color-neutral-800)] border-[var(--color-primary-500)]"
                    : "text-[var(--color-neutral-500)] border-transparent hover:text-[var(--color-neutral-700)]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="flex flex-col gap-8">
            {section === "you" && <ContextCard />}
            {section === "coach" && <CoachingStyleCard />}
            {section === "data" && (
              <>
                <CategoriesCard
                  tags={tags}
                  onAddTag={onAddTag}
                  onDeleteTag={onDeleteTag}
                  onRenameTag={onRenameTag}
                />
                <DataCard
                  confirming={confirming}
                  onConfirm={() => setConfirming(true)}
                  onCancel={() => setConfirming(false)}
                  onClearData={() => {
                    onClearData();
                    setConfirming(false);
                  }}
                />
              </>
            )}
            {section === "privacy" && (
              <PrivacyCard value={aiConsent} onChange={onAiConsentChange} />
            )}
            <AccountCard />
          </div>
        </div>
      </aside>
    </div>
  );
}
