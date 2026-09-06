# Mock Interviewer

A speech-to-speech mock coding interviewer. You paste a problem, talk through
it with a voice interviewer, and the code editor stays locked until you have
actually explained your approach.

The whole product is one idea: **you cannot write code until you can explain
what you are about to write.** Everything in this repo exists to enforce or
support that gate. When a decision is ambiguous, pick the option that makes the
gate more honest.

## Stack

- `agent/` Python worker, `livekit-agents ~=1.4` (verified on 1.7.x), with
  `openai.realtime.RealtimeModel`. `livekit-plugins-noise-cancellation` is
  pinned separately because the `[noise-cancellation]` extra stopped shipping
  the plugin at some point in the 1.7.x line.
- `web/` Next.js app router, TypeScript, `@livekit/components-react`,
  CodeMirror 6 for the editor, Mermaid for the whiteboard diagrams.
- Deployed as two Railway services from one repo.

## Architecture

The gate lives in the agent process, not the browser.

```
browser (Next.js)                      agent worker (Python)
  mic/speaker track  <--- WebRTC --->   OpenAI Realtime (speech to speech)
  gate UI            <--- data ch. ---  update_assessment tool -> Assessment
  problem/hint/code  ---- RPC ------>   start_interview / request_hint / submit_code
```

The model reports scores by calling the `update_assessment` tool. The agent
applies the rules and publishes state on the data channel under topic
`interview.state`. The browser renders what it receives and re-checks the
unlock rule, but the agent is the authority. Never let the browser decide the
gate on its own, and never let the model unlock anything directly.

### The rubric

Three dimensions, each scored 0 to 3 by the model:

- `approach` a correct algorithm and data structure, stated and justified
- `examples` they traced a real input and showed intermediate state
- `complexity` they stated time and space cost and explained why

`PASS = 2`. The editor unlocks when all three reach 2. Scores **ratchet up
only**, so a candidate never loses ground they already earned. The agent also
tracks a `missing` string naming the weakest area, which the UI shows verbatim.

### RPC methods (browser to agent)

- `start_interview({problem})` injects the problem into the chat context and
  triggers the greeting. The agent stays silent until this arrives.
- `request_hint({level})` levels 1 to 3, escalating from "point at the question
  you should be asking" to "explain the insight, then make them say it back".
  Never produces code.
- `submit_code({code})` the interviewer reviews out loud.

The agent also has a `show_diagram(mermaid_source, caption)` function tool it
can call whenever a picture would land better than words. The output is
published on data-channel topic `interview.diagram` and rendered on the
whiteboard as a Mermaid diagram. The interviewer is instructed not to narrate
the diagram after drawing it — it should ask a question about it instead.

## Interviewer behavior

Short turns, one question at a time, spoken language. Never reads code aloud,
never speaks markdown or lists. It interrupts when the candidate goes down a
wrong path, because that is the point of doing this in voice rather than text.
It never solves the problem, and it never inflates a score to move things along.

## Known traps

These are all things that already cost time. Do not rediscover them.

**Realtime models get lazy about tool calls.** They score reliably for a few
turns and then drift into pure conversation, which silently freezes the gate.
Instructions tell the model to call `update_assessment` every turn even when
nothing changed, and a periodic task nudges the chat context as a backstop.
Watch for the `assessment` log line during any session work. If calls still
drop, move scoring to a separate cheap text model fed from the transcript
rather than asking the voice model to do two jobs.

**LiveKit Cloud does not auto-dispatch a bare worker.** livekit-server has a
backward-compat path that dispatches any registered worker when a room is
created without agent config, but LiveKit Cloud does not fire that fallback.
The worker must set `agent_name` in `WorkerOptions`, and the token has to
carry a matching `RoomAgentDispatch` in `roomConfig.agents`. A bare join
against Cloud will produce zero log lines on the worker and look like the
worker is broken — it isn't, it's just never been asked.

**`session.say()` for the greeting can loop the opening.** On older Realtime
paths, a user interruption during `say()` re-threw inside the generation task
and repeated the opening line. The reference code deliberately greets through
`session.generate_reply(instructions=...)` with a short cap instead. Don't
reintroduce `say()` for the opener even if you can't reproduce the loop on
your current version — it's a cheap precaution.

**`chat_ctx.add_message(...)` returns the ChatMessage in 1.7, not the
ChatContext.** Fluent one-liners like
`agent.chat_ctx.copy().add_message(...)` silently pass a ChatMessage into
`update_chat_ctx`, which then explodes inside livekit-agents with
`TypeError: BaseModel.copy() got an unexpected keyword argument 'tools'`.
Build the context in two steps: copy, mutate, hand off.

**`RoomInputOptions` / `RoomOutputOptions` are deprecated.** Use
`RoomOptions(audio_input=AudioInputOptions(noise_cancellation=...))` and pass
`room_options=` to `session.start()`. The old kwargs still work but log a
warning on every job.

**`python agent.py download-files` is deprecated.** The image build uses the
module form: `python -m livekit.agents download-files`.

**Turn detection sets the whole feel.** `semantic_vad` with
`interrupt_response=True`. `eagerness="high"` gives real interruption;
`"auto"` if it starts cutting in while the candidate is thinking out loud.
This is the first knob to touch when the interview feels wrong, before
prompting changes.

**Use a separate LiveKit project for production.** Sharing credentials between
a local `.env` and the deployed worker puts your laptop in the same worker pool
as production, and real sessions can land on it.

## Deployment (Railway)

Agent service: Root Directory `agent`, Dockerfile build, start command
`python agent.py start`. `dev` no longer auto-reloads in 1.7 so it wouldn't
thrash, but `start` is still the right choice in prod — it disables debug
paths. Env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`OPENAI_API_KEY`.

**Leave the health check unset.** Workers dial out over websocket and expose no
inbound port, so a Railway health check probes `$PORT`, finds nothing, and
kills a healthy worker. The optional health endpoint is 8081 if it is ever
needed. **Never enable app sleeping or scale to zero**, since a worker must
stay registered to receive jobs.

Web service: Root Directory `web`, normal Next.js deploy (Railway
auto-detects with Nixpacks). Needs `LIVEKIT_API_KEY` and
`LIVEKIT_API_SECRET` for token minting plus `NEXT_PUBLIC_LIVEKIT_URL` for
the client, all from the same LiveKit project as the agent.

Keep both in the same region, US East by default. Speech-to-speech pays network
latency twice per turn and it is audible.

## Conventions

- Python: type hints on anything crossing a boundary, `logging` not `print`
- TypeScript: no `any` on data-channel payloads, parse and validate at the edge
- Both sides share the gate shape. If you change the rubric, change it in the
  agent, the hook, and this file in the same commit.
- Do not add a way to bypass the gate in production code. A dev-only escape
  hatch behind an env flag is fine.
