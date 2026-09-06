"use client";

import { useState } from "react";

type Props = {
  onStart: (problem: string) => Promise<void>;
};

export function Setup({ onStart }: Props) {
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!problem.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(problem.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-[0.32em] text-vermilion">
          Mock&nbsp;Interviewer
        </span>
        <h1
          className="font-serif text-5xl leading-[1.02] tracking-tight text-paper"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 20' }}
        >
          Talk it through, then write it.
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-stone">
          The editor stays locked until an interviewer has heard you commit to
          an approach, walk a real example, and justify the cost. Voice only.
          Nothing to install.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label
          htmlFor="problem"
          className="text-[10px] uppercase tracking-[0.24em] text-stone"
        >
          the problem
        </label>
        <textarea
          id="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="paste the full problem statement here…"
          spellCheck={false}
          className="min-h-[240px] resize-none rounded-sm border border-slate bg-charcoal/60 p-4 font-mono text-sm text-paper placeholder:text-stone/60 focus:border-amber focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={start}
          disabled={busy || !problem.trim()}
          className="rounded-full bg-paper px-6 py-3 text-xs uppercase tracking-[0.24em] text-ink transition-opacity disabled:opacity-40 hover:enabled:bg-bone"
        >
          {busy ? "connecting…" : "begin interview"}
        </button>
        <span className="text-[10px] uppercase tracking-[0.24em] text-stone">
          mic access will be requested
        </span>
      </div>

      {error && (
        <p className="text-xs text-vermilion" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
