# Merging the interviewer into another repo

This bundle is designed to drop into a bigger repo as one self-contained
subtree. Following this guide, a Claude Code session opened in the target
repo will pick up the interviewer's context automatically when you start
working inside the subtree.

## What to copy (and skip)

Copy the interviewer bundle in as `interviewer/` at the target repo root
(or under whatever parent makes sense, e.g. `apps/interviewer/`,
`services/interviewer/`). Move these:

```
interviewer/agent/            except .dockerignore and Dockerfile
interviewer/web/              in its entirety
interviewer/CLAUDE.md
interviewer/ARCHITECTURE.md
interviewer/README.md         (optional — trim if it duplicates your top-level README)
interviewer/agent/.env.example
interviewer/web/.env.example
```

**Skip** (you're not deploying this as its own service):

- `agent/Dockerfile`
- `agent/railway.json`
- `agent/.dockerignore`
- `BUILD.md` (build-history from this repo; noise in the target)
- `MERGE_GUIDE.md` (this file — you'll consult it once)

**Never copy** `agent/.env` or `web/.env` / `web/.env.local`. Those hold
your local credentials. Create fresh ones in the target repo (they're
gitignored). See the env setup section below.

## Target layout after merge

```
<target repo>/
├── ... your existing code ...
├── CLAUDE.md                       ← add the pointer below
└── interviewer/
    ├── CLAUDE.md                   ← interviewer's own working notes
    ├── ARCHITECTURE.md
    ├── README.md                   ← optional
    ├── agent/
    │   ├── agent.py
    │   ├── requirements.txt
    │   ├── .env.example
    │   └── .env                    ← create locally, gitignored
    └── web/
        ├── app/, components/, hooks/, ...
        ├── package.json
        ├── .env.example
        └── .env.local              ← create locally, gitignored
```

## Tell Claude Code about the subtree

The interviewer's own `CLAUDE.md` is comprehensive but only loads when
Claude is working inside the `interviewer/` subtree. Your target repo's
root `CLAUDE.md` should carry a short signpost so Claude notices the
subtree before wandering into it. Add something like this to your root
`CLAUDE.md`:

```markdown
## Sub-projects

- `interviewer/` — speech-to-speech mock coding interviewer. Self-contained
  two-service bundle (`interviewer/agent/` Python worker,
  `interviewer/web/` Next.js app) that share a LiveKit project. Read
  `interviewer/CLAUDE.md` before modifying anything inside; read
  `interviewer/ARCHITECTURE.md` if you need to reason about the gate,
  the rubric, or how the agent and browser talk.
```

Adjust the path if you nested it deeper (e.g. `apps/interviewer/`).

That's the whole pointer. Do not paste the interviewer's rubric,
conventions, or trap notes into the root `CLAUDE.md` — Claude will load
the nested one when it starts working in the subtree, and duplicating is
how the two drift.

## Env setup (create fresh, do not copy)

Same LiveKit project on both sides; different files on disk.

**`interviewer/agent/.env`** (copy the example, fill in your values):

```
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
OPENAI_API_KEY=sk-...
```

**`interviewer/web/.env.local`**:

```
NEXT_PUBLIC_LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
```

Confirm your target repo's `.gitignore` already covers `.env` and
`.env.local`. If it doesn't, add them before staging.

## Dependencies

The two sides don't share a dependency tree; install each on its own.

```bash
# agent
cd interviewer/agent
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# web
cd interviewer/web
npm install
```

If your target repo already uses a monorepo tool (pnpm workspaces, Turborepo,
Nx), you'll need to add `interviewer/web/` to that config; the interviewer's
web is otherwise a standalone Next.js app.

## Sanity check the merge

Two commands in two terminals:

```bash
# terminal 1
cd interviewer/agent
.venv/bin/python agent.py dev
# expect: "registered worker" with agent_name: "interviewer"

# terminal 2
cd interviewer/web
npm run dev
# open http://localhost:3000
```

The full end-to-end check is stage 5's from the original build: paste a
problem, talk through it, watch the rubric meters ratchet and the editor
unlock. If nothing happens on the worker side after you join the room,
you've probably hit the explicit-dispatch trap — see the "LiveKit Cloud
does not auto-dispatch a bare worker" note in `interviewer/CLAUDE.md`.

## If you decide to deploy later

You skipped the Dockerfile and `railway.json`. When you're ready to deploy,
either:

1. Grab them from this reference repo
   (`agent/Dockerfile`, `agent/railway.json`, `agent/.dockerignore`) and
   drop them into `interviewer/agent/`. Set Railway's Root Directory for
   the agent service to `interviewer/agent`.
2. Or roll your own using whatever deploy tooling your target repo
   already uses. The requirements are just: run
   `python -m livekit.agents download-files` at build time, then
   `python agent.py start` as the entrypoint, no inbound port, no health
   check, no scale-to-zero. `interviewer/CLAUDE.md` explains why on each.

The web side is a normal Next.js app and deploys with whatever your target
repo uses for its other Next.js services.
