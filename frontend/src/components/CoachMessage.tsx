import { CoachNotePills } from "./CoachNotePills";

interface CoachMessageProps {
  role: "coach" | "user";
  text: string;
  notes?: string[];
}

export function CoachMessage({ role, text, notes }: CoachMessageProps) {
  const isCoach = role === "coach";
  return (
    <div className={`flex flex-col gap-2 ${isCoach ? "items-start" : "items-end"}`}>
      <span className="font-[var(--font-body)] text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
        {isCoach ? "Coach" : "You"}
      </span>
      {isCoach && notes && notes.length > 0 && <CoachNotePills notes={notes} />}
      <p
        className={
          isCoach
            ? "font-[var(--font-body)] text-base text-[var(--color-neutral-700)] bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md px-5 py-4 max-w-[85%]"
            : "font-[var(--font-body)] text-base text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] rounded-md px-5 py-4 max-w-[85%]"
        }
        style={{ lineHeight: 1.6 }}
      >
        {text}
      </p>
    </div>
  );
}
