interface CoachNotePillsProps {
  notes: string[] | null;
}

export function CoachNotePills({ notes }: CoachNotePillsProps) {
  if (!notes || notes.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
      }}
    >
      {notes.map((note) => (
        <span
          key={note}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-accent-muted)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent-border)",
          }}
        >
          {note}
        </span>
      ))}
    </div>
  );
}
