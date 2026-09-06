"use client";

import { useMemo } from "react";
import { useMultibandTrackVolume } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-core";

type Props = {
  track: TrackReference | undefined;
  active: boolean;
};

const BAR_COUNT = 56;

export function WaveformRibbon({ track, active }: Props) {
  const bands = useMultibandTrackVolume(track, {
    bands: BAR_COUNT,
    updateInterval: 45,
  });

  // Fill until real data arrives so the ribbon is never empty.
  const values = useMemo(() => {
    if (bands && bands.length === BAR_COUNT) return bands;
    return new Array(BAR_COUNT).fill(0);
  }, [bands]);

  return (
    <div
      className="flex h-16 items-center gap-[3px]"
      role="img"
      aria-label="interviewer audio"
    >
      {values.map((v, i) => {
        const height = Math.max(4, Math.min(64, v * 90));
        return (
          <span
            key={i}
            aria-hidden
            className={
              "w-[3px] rounded-full transition-[height,background-color] duration-150 " +
              (active ? "bg-paper/80" : "bg-stone/50")
            }
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}
