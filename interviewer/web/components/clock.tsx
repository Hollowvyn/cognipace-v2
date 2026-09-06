"use client";

import { useEffect, useState } from "react";

export function SessionClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span
      className="font-serif text-2xl tracking-tight tabular-nums text-paper"
      style={{ fontVariationSettings: '"opsz" 48, "SOFT" 20' }}
      aria-label="session time"
    >
      {mm}:{ss}
    </span>
  );
}
