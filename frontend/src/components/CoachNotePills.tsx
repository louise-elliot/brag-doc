interface CoachNotePillsProps {
  notes: string[] | null;
}

export function CoachNotePills({ notes }: CoachNotePillsProps) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {notes.map((note, idx) => (
        <span
          key={idx}
          className="font-[var(--font-body)] text-xs font-medium px-3 py-1 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
        >
          {note}
        </span>
      ))}
    </div>
  );
}
