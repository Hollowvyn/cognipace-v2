"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { useTrackVolume } from "@livekit/components-react";
import { LocalAudioTrack } from "livekit-client";

export function MicIndicator() {
  const { microphoneTrack } = useLocalParticipant();
  const audio =
    microphoneTrack?.track instanceof LocalAudioTrack
      ? microphoneTrack.track
      : undefined;
  const level = useTrackVolume(audio);
  const bars = 5;
  const active = Math.min(bars, Math.max(0, Math.round(level * bars * 6)));
  return (
    <div
      className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-stone"
      aria-label="your microphone"
    >
      <span>you</span>
      <span className="flex items-end gap-[2px]">
        {Array.from({ length: bars }, (_, i) => (
          <span
            key={i}
            aria-hidden
            style={{ height: `${4 + i * 3}px` }}
            className={
              "w-[3px] rounded-full transition-colors duration-150 " +
              (i < active ? "bg-paper" : "bg-slate")
            }
          />
        ))}
      </span>
    </div>
  );
}
