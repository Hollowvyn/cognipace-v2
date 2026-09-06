"use client";

import { useCallback, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { Setup } from "@/components/setup";
import { Session } from "@/components/session";

type Conn = { token: string; url: string; room: string; identity: string };

export default function Page() {
  const [problem, setProblem] = useState<string>("");
  const [conn, setConn] = useState<Conn | null>(null);

  const begin = useCallback(async (nextProblem: string) => {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "candidate" }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `token endpoint returned ${res.status}`);
    }
    setProblem(nextProblem);
    setConn((await res.json()) as Conn);
  }, []);

  const end = useCallback(() => {
    setConn(null);
    setProblem("");
  }, []);

  if (!conn) {
    return <Setup onStart={begin} />;
  }

  return (
    <LiveKitRoom
      token={conn.token}
      serverUrl={conn.url}
      connect
      audio
      video={false}
      onDisconnected={end}
    >
      <Session
        problem={problem}
        candidateIdentity={conn.identity}
        onDisconnect={end}
      />
    </LiveKitRoom>
  );
}
