# Mock Interviewer

A speech-to-speech mock coding interviewer. You paste a problem, talk through
it with a voice interviewer, and the code editor stays locked until you have
actually explained your approach.

The whole product is one idea: **you cannot write code until you can explain
what you are about to write.** Everything in this repo enforces or supports
that gate.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how it works end-to-end.
See [`CLAUDE.md`](./CLAUDE.md) for the working notes: rubric, conventions,
the traps we hit, and deploy checklist.

## Repo layout

```
agent/    Python worker (livekit-agents + OpenAI Realtime)
web/      Next.js app router frontend (TypeScript, LiveKit + CodeMirror + Mermaid)
```

The two are deployed as separate Railway services from the same repo.

## Prerequisites

- Node 20+ (verified on 24) and npm
- Python 3.12+ (verified on 3.14)
- A [LiveKit Cloud](https://cloud.livekit.io) project
  (free tier is enough for development)
- An [OpenAI](https://platform.openai.com) key on a paid account
  with Realtime API access

Both LiveKit URL / key / secret and the OpenAI key are needed on both sides;
mint one set and reuse it. For production, use a **separate** LiveKit
project — sharing credentials would put your laptop in the same worker pool
as the deployed worker.

## Quickstart

Clone, then set up each side.

### Agent

```bash
cd agent
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# edit .env with your LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
# and OPENAI_API_KEY
.venv/bin/python agent.py dev
```

You should see `registered worker` in the log, with `agent_name: "interviewer"`.

### Web

```bash
cd web
npm install
cp .env.example .env.local
# edit .env.local with the same LiveKit values (NEXT_PUBLIC_LIVEKIT_URL,
# LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
npm run dev
```

Open http://localhost:3000, paste a problem, click **begin interview**.

The first message from the interviewer will arrive on the browser about a
second after the room connects. If it doesn't, check the agent log —
LiveKit Cloud requires explicit agent dispatch, which is wired here but is
the first thing to break if either side drifts.

## Development

- `npm run dev` in `web/` — Next.js dev server on `:3000`
- `npm run lint` and `npm run build` in `web/` — CI-shaped checks
- `python agent.py dev` in `agent/` — LiveKit worker in dev mode
  (no file-watch anymore; restart manually)
- `python agent.py console` — talk to the agent through the terminal
  (no browser needed) for quick prompt iteration

## Deploy

See the **Deployment** section of [`CLAUDE.md`](./CLAUDE.md). Two Railway
services, one repo. Do not enable Railway's health check on the agent
(workers dial out; they expose nothing to probe), and never scale the
agent to zero (workers must stay registered to receive jobs).
