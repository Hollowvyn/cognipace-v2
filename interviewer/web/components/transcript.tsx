"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVoiceAssistant, useTranscriptions } from "@livekit/components-react";

type Line = {
  id: string;
  who: "you" | "interviewer";
  text: string;
  at: number;
};

export function TranscriptTab({
  candidateIdentity,
}: {
  candidateIdentity: string;
}) {
  const [open, setOpen] = useState(false);
  const { agentTranscriptions } = useVoiceAssistant();
  const candidateStreams = useTranscriptions({
    participantIdentities: candidateIdentity ? [candidateIdentity] : [],
  });

  const lines = useMemo<Line[]>(() => {
    const agentLines: Line[] = (agentTranscriptions ?? []).map((s) => ({
      id: `a-${s.id}`,
      who: "interviewer",
      text: s.text,
      at: s.firstReceivedTime ?? 0,
    }));
    const youLines: Line[] = (candidateStreams ?? []).map((s) => ({
      id: `y-${s.streamInfo.id}`,
      who: "you",
      text: s.text,
      at: s.streamInfo.timestamp ?? 0,
    }));
    return [...agentLines, ...youLines].sort((a, b) => a.at - b.at);
  }, [agentTranscriptions, candidateStreams]);

  const unread = lines.length;

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, lines.length]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="transcript-drawer"
        className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-sm border border-r-0 border-slate/80 bg-charcoal/90 px-3 py-6 text-[10px] uppercase tracking-[0.24em] text-stone hover:text-paper"
      >
        <span className="[writing-mode:vertical-rl] rotate-180">
          transcript · {unread}
        </span>
      </button>

      {open && (
        <button
          aria-label="close transcript"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/50"
        />
      )}

      <aside
        id="transcript-drawer"
        aria-hidden={!open}
        className={
          "fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[85vw] flex-col border-l border-slate/80 bg-charcoal/95 backdrop-blur-sm transition-transform duration-300 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between border-b border-slate/60 px-5 py-4">
          <span className="text-[10px] uppercase tracking-[0.24em] text-stone">
            transcript
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-stone hover:text-paper"
          >
            close
          </button>
        </header>
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-5 py-4"
          role="log"
          aria-live="polite"
        >
          {lines.length === 0 ? (
            <p className="text-xs text-stone">
              nothing yet. as soon as you start talking, both sides show up here.
            </p>
          ) : (
            <ol className="space-y-4">
              {lines.map((l) => (
                <li key={l.id} className="text-sm leading-relaxed">
                  <span
                    className={
                      "mr-2 text-[10px] uppercase tracking-[0.24em] " +
                      (l.who === "interviewer" ? "text-amber" : "text-stone")
                    }
                  >
                    {l.who}
                  </span>
                  <span className={l.who === "interviewer" ? "text-paper" : "text-paper/85"}>
                    {l.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
