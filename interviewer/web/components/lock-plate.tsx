"use client";

import type { Gate } from "@/hooks/useInterviewGate";

function frame(gate: Gate): string {
  if (gate.missing) return gate.missing;
  const min = Math.min(gate.approach, gate.examples, gate.complexity);
  if (min === 0) return "start with the approach and the data structure.";
  if (min === 1) return "keep going — you're partway there.";
  return "almost — one more pass through the weakest area.";
}

export function LockPlate({ gate }: { gate: Gate }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 bg-ink/85 backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 px-8 text-center">
        <span className="text-[10px] uppercase tracking-[0.32em] text-vermilion">
          locked
        </span>
        <p
          className="font-serif text-2xl leading-tight text-paper"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 40' }}
        >
          {frame(gate)}
        </p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-stone">
          the editor opens once the interviewer scores approach, examples, and
          complexity at 2 or above. talk it through out loud — you cannot code
          your way past this.
        </p>
      </div>
    </div>
  );
}
