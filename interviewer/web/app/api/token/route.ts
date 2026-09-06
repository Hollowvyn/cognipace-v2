import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";

export const runtime = "nodejs";

const AGENT_NAME = "interviewer";

export async function POST(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      { error: "server missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET" },
      { status: 500 },
    );
  }

  let displayName = "candidate";
  try {
    const body = (await req.json()) as { displayName?: string };
    if (body?.displayName?.trim()) displayName = body.displayName.trim();
  } catch {
    // empty or non-JSON body is fine, use default
  }

  const room = `interview-${crypto.randomUUID().slice(0, 8)}`;
  const identity = displayName;

  const at = new AccessToken(apiKey, apiSecret, { identity, name: displayName });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  // tells LiveKit Cloud to dispatch the interviewer worker when this room opens
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url, room, identity });
}
