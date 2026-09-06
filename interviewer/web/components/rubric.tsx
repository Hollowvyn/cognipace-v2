"use client";

import type { Gate } from "@/hooks/useInterviewGate";

const ROWS: Array<{ key: "approach" | "examples" | "complexity"; label: string }> = [
  { key: "approach", label: "approach" },
  { key: "examples", label: "examples" },
  { key: "complexity", label: "complexity" },
];

function segmentColor(score: number, index: number): string {
  // index is 1..3; score is 0..3
  if (score < index) return "bg-transparent border-stone/40";
  if (score === 1) return "bg-amber border-amber";
  return "bg-sage border-sage";
}

export function Rubric({ gate }: { gate: Gate }) {
  return (
    <section
      aria-label="rubric"
      className="rounded-sm border border-slate/80 bg-charcoal/60 p-6"
    >
      <div className="mb-5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] text-stone">
          rubric
        </span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-stone">
          {gate.unlocked ? "unlocked" : "locked"}
        </span>
      </div>
      <div className="grid gap-3">
        {ROWS.map(({ key, label }) => {
          const score = gate[key];
          return (
            <div key={key} className="flex items-center gap-4">
              <span className="w-28 text-sm tracking-wide text-paper/80">
                {label}
              </span>
              <div className="flex flex-1 gap-1.5">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={
                      "h-4 flex-1 rounded-[1px] border transition-colors duration-300 " +
                      segmentColor(score, i)
                    }
                  />
                ))}
              </div>
              <span className="w-6 text-right text-xs tabular-nums text-stone">
                {score}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-5 min-h-[1.5rem] text-sm text-vermilion/90">
        {gate.missing ? (
          <>
            <span className="mr-2 text-stone">still missing</span>
            {gate.missing}
          </>
        ) : gate.unlocked ? (
          <span className="text-sage">all three earned. the editor is yours.</span>
        ) : (
          <span className="text-stone">
            waiting for the interviewer to score your first turn…
          </span>
        )}
      </p>
    </section>
  );
}

export function RubricStrip({ gate }: { gate: Gate }) {
  return (
    <div
      aria-label="rubric summary"
      className="flex items-center gap-5 text-xs text-stone"
    >
      {ROWS.map(({ key, label }) => (
        <span key={key} className="flex items-center gap-2">
          <span className="uppercase tracking-[0.18em]">{label.slice(0, 4)}</span>
          <span className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                aria-hidden
                className={
                  "h-1.5 w-4 rounded-[1px] " +
                  (gate[key] >= i
                    ? gate[key] === 1
                      ? "bg-amber"
                      : "bg-sage"
                    : "bg-slate")
                }
              />
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
