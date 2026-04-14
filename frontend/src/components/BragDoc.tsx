"use client";

import type { Entry } from "@/lib/types";

interface BragDocProps {
  entries: Entry[];
}

export function BragDoc({ entries }: BragDocProps) {
  if (entries.length === 0) {
    return (
      <p
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "14px",
          textAlign: "center",
          paddingTop: "80px",
        }}
      >
        Add some journal entries first
      </p>
    );
  }

  return (
    <p
      style={{
        color: "var(--color-text-tertiary)",
        fontSize: "14px",
        textAlign: "center",
        paddingTop: "80px",
      }}
    >
      Brag doc generation coming soon
    </p>
  );
}
