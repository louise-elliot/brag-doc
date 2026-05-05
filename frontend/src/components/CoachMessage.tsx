import { CoachNotePills } from "./CoachNotePills";

interface CoachMessageProps {
  role: "coach" | "user";
  text: string;
  notes?: string[];
}

export function CoachMessage({ role, text, notes }: CoachMessageProps) {
  const isCoach = role === "coach";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isCoach ? "flex-start" : "flex-end",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isCoach ? "var(--color-accent)" : "var(--color-text-tertiary)",
        }}
      >
        {isCoach ? "Coach" : "You"}
      </span>
      {isCoach && notes && notes.length > 0 && <CoachNotePills notes={notes} />}
      <p
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: isCoach
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          background: isCoach
            ? "var(--color-surface)"
            : "var(--color-surface-raised)",
          border: isCoach
            ? "1px solid var(--color-accent-border)"
            : "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          margin: 0,
          maxWidth: "85%",
        }}
      >
        {text}
      </p>
    </div>
  );
}
