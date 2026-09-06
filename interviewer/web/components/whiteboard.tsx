"use client";

import { useEffect, useState } from "react";
import type { TrackReference } from "@livekit/components-core";
import type { Diagram } from "@/hooks/useInterviewGate";
import { WaveformRibbon } from "@/components/waveform-ribbon";

type Props = {
  interviewerTrack: TrackReference | undefined;
  interviewerSpeaking: boolean;
  diagram: Diagram | null;
};

// Load mermaid on the client only; it touches window.
async function renderMermaid(id: string, source: string): Promise<string> {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
    themeVariables: {
      background: "transparent",
      primaryColor: "#22252b",
      primaryTextColor: "#efe9df",
      primaryBorderColor: "#7a756d",
      lineColor: "#8ba889",
      secondaryColor: "#17191d",
      tertiaryColor: "#0d0e10",
      noteBkgColor: "#22252b",
      noteTextColor: "#efe9df",
      noteBorderColor: "#7a756d",
    },
  });
  const { svg } = await mermaid.render(id, source);
  return svg;
}

export function Whiteboard({ interviewerTrack, interviewerSpeaking, diagram }: Props) {
  return (
    <section
      aria-label="whiteboard"
      className="relative overflow-hidden rounded-sm border border-slate/80 bg-charcoal/40 p-6"
    >
      <div className="mb-4 flex items-baseline justify-between text-[10px] uppercase tracking-[0.24em] text-stone">
        <span>interviewer</span>
        <span>{interviewerSpeaking ? "speaking" : "listening"}</span>
      </div>

      <WaveformRibbon track={interviewerTrack} active={interviewerSpeaking} />

      {/*
        Keyed by mermaid source so a new diagram unmounts the previous one and
        starts fresh. This lets DiagramSlot own its own async state without
        needing an effect-driven reset — unmount cleans up.
      */}
      {diagram && (
        <DiagramSlot key={diagram.mermaid} diagram={diagram} />
      )}
    </section>
  );
}

function DiagramSlot({ diagram }: { diagram: Diagram }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderMermaid(`diagram-${diagram.at}`, diagram.mermaid)
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRenderError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [diagram]);

  return (
    <div className="mt-6 border-t border-slate/60 pt-6">
      {svg ? (
        <div
          className="[&_svg]:mx-auto [&_svg]:max-h-72 [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : renderError ? (
        <pre className="whitespace-pre-wrap text-xs text-vermilion/80">
          couldn&apos;t draw that: {renderError}
        </pre>
      ) : (
        <p className="text-xs text-stone">drawing…</p>
      )}
      {diagram.caption && (
        <p className="mt-4 text-center text-sm text-paper/70">
          {diagram.caption}
        </p>
      )}
    </div>
  );
}
