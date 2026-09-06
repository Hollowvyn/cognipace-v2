"use client";

import { useCallback, useEffect, useState } from "react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

const STATE_TOPIC = "interview.state";
const DIAGRAM_TOPIC = "interview.diagram";
const PASS = 2;

export type Gate = {
  approach: number;
  examples: number;
  complexity: number;
  missing: string;
  unlocked: boolean;
};

export type Diagram = {
  mermaid: string;
  caption: string;
  at: number;
};

const EMPTY_GATE: Gate = {
  approach: 0,
  examples: 0,
  complexity: 0,
  missing: "",
  unlocked: false,
};

export function useInterviewGate() {
  const room = useRoomContext();
  const [gate, setGate] = useState<Gate>(EMPTY_GATE);
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [agentId, setAgentId] = useState<string>("");

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _p?: RemoteParticipant,
      _k?: unknown,
      topic?: string,
    ) => {
      if (topic === STATE_TOPIC) {
        try {
          const next = JSON.parse(new TextDecoder().decode(payload));
          setGate({
            approach: next.approach ?? 0,
            examples: next.examples ?? 0,
            complexity: next.complexity ?? 0,
            missing: next.missing ?? "",
            // trust the agent, but the rule is cheap to check twice
            unlocked:
              !!next.unlocked &&
              Math.min(next.approach, next.examples, next.complexity) >= PASS,
          });
        } catch {
          /* ignore malformed frames */
        }
      } else if (topic === DIAGRAM_TOPIC) {
        try {
          const next = JSON.parse(new TextDecoder().decode(payload));
          if (typeof next.mermaid === "string" && next.mermaid.trim()) {
            setDiagram({
              mermaid: next.mermaid,
              caption: typeof next.caption === "string" ? next.caption : "",
              at: Date.now(),
            });
          }
        } catch {
          /* ignore malformed frames */
        }
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  useEffect(() => {
    const sync = () => {
      const agent = [...room.remoteParticipants.values()].find(
        (p) => p.isAgent || p.identity.startsWith("agent"),
      );
      setAgentId(agent?.identity ?? "");
    };
    sync();
    room.on(RoomEvent.ParticipantConnected, sync);
    room.on(RoomEvent.ParticipantDisconnected, sync);
    return () => {
      room.off(RoomEvent.ParticipantConnected, sync);
      room.off(RoomEvent.ParticipantDisconnected, sync);
    };
  }, [room]);

  const call = useCallback(
    async (method: string, payload: Record<string, unknown>) => {
      if (!agentId) throw new Error("interviewer has not joined yet");
      return room.localParticipant.performRpc({
        destinationIdentity: agentId,
        method,
        payload: JSON.stringify(payload),
        responseTimeout: 15000,
      });
    },
    [room, agentId],
  );

  return {
    gate,
    diagram,
    ready: !!agentId,
    startInterview: (problem: string) => call("start_interview", { problem }),
    requestHint: (level: number) => call("request_hint", { level }),
    submitCode: (code: string) => call("submit_code", { code }),
  };
}
