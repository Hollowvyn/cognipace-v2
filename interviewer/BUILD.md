# Build plan

Work through these in order. Each stage is a commit. Do not start a stage until
the previous one's check passes, and do not build ahead. Read `CLAUDE.md` first.

---

## 1. Scaffold

Create the two-service layout:

```
agent/    agent.py, requirements.txt, Dockerfile, .env.example
web/      Next.js app router + TypeScript, @livekit/components-react
railway.json
```

`agent/requirements.txt`:

```
livekit-agents[openai,noise-cancellation]~=1.4
python-dotenv~=1.0
```

Do not scaffold UI components yet.

**Check:** `python agent.py dev` connects and registers with LiveKit. `npm run
dev` serves an empty page.

---

## 2. Token endpoint and room join

A route handler at `web/app/api/token/route.ts` that mints a join token from
`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`. One room per session, random name,
identity from a client-supplied display name.

Wire a bare `LiveKitRoom` that joins and publishes mic. No custom UI.

**Check:** you can join, and the agent worker logs an accepted job.

---

## 3. The agent, minimal

`agent/agent.py` with `AgentSession` + `openai.realtime.RealtimeModel`:

- `voice="marin"`, `modalities=["audio"]`, `input_audio_noise_reduction="near_field"`
- `turn_detection` semantic VAD, `create_response=True`,
  `interrupt_response=True`, `eagerness="high"`
- `RoomInputOptions(noise_cancellation=noise_cancellation.BVC())`

Interviewer instructions per the behavior section of `CLAUDE.md`. No tools yet,
no greeting yet.

**Check:** you can hold a spoken conversation and interrupt it mid-sentence and
it actually stops talking.

---

## 4. The gate

This is the core. Take your time here.

An `Assessment` dataclass (`approach`, `examples`, `complexity`, `missing`)
with an `unlocked` property that is `min(...) >= PASS`, `PASS = 2`.

An `Interviewer(Agent)` subclass holding the room, the assessment, and the
problem text. A `@function_tool update_assessment(approach, examples,
complexity, missing)` that clamps each score to 0..3, takes `max()` against the
current value so scores ratchet, and publishes JSON on the data channel under
topic `interview.state` with an added `unlocked` boolean.

The tool's return string tells the model what happened: if it just unlocked,
tell the candidate briefly and then stop talking so they can work. If not, name
the weakest area.

Register three RPC methods on `ctx.room.local_participant`: `start_interview`,
`request_hint`, `submit_code`, per `CLAUDE.md`. `start_interview` adds the
problem to the chat context as a system message, publishes initial state, then
calls `session.generate_reply()` with a fifteen word greeting cap. Do not use
`session.say()`.

Add the periodic task that reminds the model to call `update_assessment` if the
gate has not moved and the interview is live.

**Check:** talk through a problem badly, watch scores stay low. Talk through it
properly, watch all three reach 2 and `unlocked` flip in the logs.

---

## 5. Frontend gate wiring

A `useInterviewGate()` hook: subscribe to `RoomEvent.DataReceived`, filter on
the topic, parse and validate, and re-check `min(...) >= PASS` rather than
trusting the flag alone. Track the agent participant identity and expose
`startInterview`, `requestHint`, `submitCode` wrappers over `performRpc`.

**Check:** meters move on screen in real time as you talk.

---

## 6. The interview UI

This is voice-first, so it is **not** a chat app. Build to these priorities:

- **The rubric is the focal point, not a sidebar.** In voice you cannot scroll
  back to see where you stand, so the three meters plus the `missing` line are
  the only persistent signal the candidate has. Give them real estate.
- **Show who has the floor.** Two live audio levels off the LiveKit tracks,
  yours and the interviewer's. When the interviewer cuts you off it must read
  as intentional, not as a glitch.
- **Collapse the transcript.** Last two or three exchanges by default, the rest
  behind a toggle. Realtime transcription is noisy and a wall of it competes
  with listening.
- **The editor gets the space** the transcript would have taken, because after
  unlock the whole session happens there.
- The lock overlay names which rubric items are still short, in the candidate's
  terms, not as scores.
- A session clock. Interviews are timed and the pressure is part of the point.

Setup screen is a single paste box for the problem plus a start button, which
calls `startInterview` after the room connects.

Hint button escalates 1 to 3 and shows how many are used.

**Check:** run a full session end to end without looking at logs.

---

## 7. Deploy

`agent/Dockerfile` on `python:3.12-slim`, `PYTHONUNBUFFERED=1`, install
requirements, `RUN python agent.py download-files` to bake plugin weights into
the image, `ENTRYPOINT ["python", "agent.py"]`, `CMD ["start"]`.

`railway.json` with `DOCKERFILE` builder, `ON_FAILURE` restart policy.

Follow the deployment section of `CLAUDE.md` exactly, especially the health
check and app sleeping notes.

**Check:** deployed worker picks up a job from the deployed frontend.

---

## Out of scope for now

Auth, persistence of past sessions, multiple concurrent problems, scoring
history, anything resembling analytics. Get one session working well first.
