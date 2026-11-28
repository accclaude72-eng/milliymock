"use client";

import { cx } from "@/lib/format-utils";

export interface PublicQuestion {
  id: string;
  n: number;
  materialId: string;
  subjectCode: string;
  topic: string | null;
  type: "Y1" | "O1" | "O";
  stem: string;
  options: { letter: string; html: string }[];
}

/**
 * Renders a bank question. `stem` / option HTML come from the server already sanitised to a
 * small allowlist (b, i, sub, sup, br, span and data: images), so innerHTML is safe here.
 */
export function QuestionStem({ q, className }: { q: PublicQuestion; className?: string }) {
  return <p className={cx("text-[1.05rem] leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: q.stem }} />;
}

export function OptionList({
  q,
  picked,
  correct,
  wrong,
  disabled,
  onPick,
}: {
  q: PublicQuestion;
  picked?: string | null;
  correct?: string | null;
  wrong?: string | null;
  disabled?: boolean;
  onPick?: (letter: string) => void;
}) {
  return (
    <ul className="mt-3 grid gap-2">
      {q.options.map((o) => {
        const isRight = correct === o.letter;
        const isWrong = wrong === o.letter;
        const on = picked === o.letter;
        return (
          <li key={o.letter}>
            <button
              type="button"
              disabled={disabled || !onPick}
              onClick={() => onPick?.(o.letter)}
              aria-pressed={on}
              className={cx(
                "flex w-full items-start gap-3 rounded-[3px] border px-3 py-2.5 text-left transition-colors",
                isRight ? "border-ok bg-ok-soft" : isWrong ? "border-accent bg-accent-soft" : on ? "border-ink bg-paper-2" : "border-hair hover:border-ink",
                (disabled || !onPick) && "cursor-default",
              )}
            >
              <span className="bubble bubble-sm shrink-0" data-filled={on || isRight || isWrong || undefined} style={isRight ? { background: "var(--color-ok)", borderColor: "var(--color-ok)" } : isWrong ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" } : undefined}>
                {o.letter}
              </span>
              <span className="min-w-0 pt-0.5" dangerouslySetInnerHTML={{ __html: o.html }} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
