"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useInterviewGate } from "@/hooks/useInterviewGate";
import { Rubric, RubricStrip } from "@/components/rubric";
import { Whiteboard } from "@/components/whiteboard";
import { CodeEditor } from "@/components/code-editor";
import { LockPlate } from "@/components/lock-plate";
import { TranscriptTab } from "@/components/transcript";
import { SessionClock } from "@/components/clock";
import { MicIndicator } from "@/components/mic-indicator";

const STARTER_CODE = `# once unlocked, start writing here.
# the interviewer can review it if you hit "submit code" below.

def solve():
    pass
`;

type Props = {
  problem: string;
  candidateIdentity: string;
  onDisconnect: () => void;
};

export function Session({ problem, candidateIdentity, onDisconnect }: Props) {
  const { gate, diagram, ready, startInterview, requestHint, submitCode } =
    useInterviewGate();
  const { state, audioTrack } = useVoiceAssistant();

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [code, setCode] = useState(STARTER_CODE);
  const [pending, setPending] = useState<"hint" | "submit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // ref-guarded so the once-only hand-off doesn't need setState in the
  // effect body (lint: react-hooks/set-state-in-effect).
  const handoffRef = useRef(false);

  // hand the problem off as soon as the interviewer joins, and only once.
  useEffect(() => {
    if (!ready || handoffRef.current) return;
    handoffRef.current = true;
    const at = Date.now();
    startInterview(problem)
      .then(() => setStartedAt(at))
      .catch((e: unknown) => {
        handoffRef.current = false;
        setNotice(e instanceof Error ? e.message : String(e));
      });
  }, [ready, problem, startInterview]);

  const askHint = useCallback(async () => {
    if (hintLevel >= 3 || pending) return;
    const next = hintLevel + 1;
    setPending("hint");
    setNotice(null);
    try {
      await requestHint(next);
      setHintLevel(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }, [hintLevel, pending, requestHint]);

  const submit = useCallback(async () => {
    if (!code.trim() || pending) return;
    setPending("submit");
    setNotice(null);
    try {
      await submitCode(code);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }, [code, pending, submitCode]);

  const interviewerSpeaking = state === "speaking";
  const connectionLabel = !ready
    ? "waiting for interviewer"
    : state === "speaking"
      ? "interviewer talking"
      : state === "thinking"
        ? "interviewer thinking"
        : state === "listening"
          ? "your turn"
          : state;

  return (
    <>
      <RoomAudioRenderer />
      <StartAudio label="click to enable audio" />
      <TranscriptTab candidateIdentity={candidateIdentity} />

      <div className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col gap-8 px-6 py-6 lg:px-10">
        <header className="flex items-baseline justify-between border-b border-slate/60 pb-4">
          <div className="flex flex-col">
            <span
              className="font-serif text-lg leading-none text-paper"
              style={{ fontVariationSettings: '"opsz" 20, "SOFT" 30' }}
            >
              Mock&nbsp;Interviewer
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.24em] text-stone">
              {connectionLabel}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <MicIndicator />
            {startedAt && <SessionClock startedAt={startedAt} />}
            <button
              onClick={onDisconnect}
              className="text-[10px] uppercase tracking-[0.24em] text-stone hover:text-vermilion"
            >
              end
            </button>
          </div>
        </header>

        {gate.unlocked && (
          <div className="rounded-sm border border-sage/30 bg-sage/5 px-4 py-2">
            <RubricStrip gate={gate} />
          </div>
        )}

        <Whiteboard
          interviewerTrack={audioTrack}
          interviewerSpeaking={interviewerSpeaking}
          diagram={diagram}
        />

        {!gate.unlocked && <Rubric gate={gate} />}

        <div className="relative flex-1 overflow-hidden rounded-sm border border-slate/80 bg-charcoal/70">
          <CodeEditor
            value={code}
            onChange={setCode}
            readOnly={!gate.unlocked}
          />
          {!gate.unlocked && <LockPlate gate={gate} />}
        </div>

        <footer className="flex flex-wrap items-center gap-4 border-t border-slate/60 pt-4">
          <button
            onClick={askHint}
            disabled={!ready || hintLevel >= 3 || pending !== null}
            className="rounded-full border border-amber/60 px-4 py-2 text-xs uppercase tracking-[0.16em] text-amber transition-opacity disabled:opacity-40 hover:enabled:bg-amber/10"
          >
            {pending === "hint"
              ? "asking…"
              : hintLevel >= 3
                ? "no more hints"
                : `hint (${hintLevel}/3)`}
          </button>
          <button
            onClick={submit}
            disabled={!gate.unlocked || !code.trim() || pending !== null}
            className="rounded-full bg-paper px-5 py-2 text-xs uppercase tracking-[0.16em] text-ink transition-opacity disabled:opacity-40 hover:enabled:bg-bone"
          >
            {pending === "submit" ? "sending…" : "submit code"}
          </button>
          <span className="ml-auto text-[10px] uppercase tracking-[0.24em] text-stone">
            {problem.length} chars of problem
          </span>
        </footer>

        {notice && (
          <p className="text-xs text-vermilion" role="alert">
            {notice}
          </p>
        )}
      </div>
    </>
  );
}
