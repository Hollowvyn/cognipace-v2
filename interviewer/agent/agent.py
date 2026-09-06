"""
Speech-to-speech mock interviewer.

    uv add "livekit-agents[openai,silero,noise-cancellation]~=1.4"
    python agent.py dev

The gate lives here, not in the browser. The model reports scores through a
tool call; this process decides whether the editor opens and pushes that to
the frontend over the data channel.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, asdict

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    function_tool,
)
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.plugins import noise_cancellation, openai
from openai.types import realtime

load_dotenv()
log = logging.getLogger("interviewer")

PASS = 2
STATE_TOPIC = "interview.state"
DIAGRAM_TOPIC = "interview.diagram"


@dataclass
class Assessment:
    approach: int = 0
    examples: int = 0
    complexity: int = 0
    missing: str = ""

    @property
    def unlocked(self) -> bool:
        return min(self.approach, self.examples, self.complexity) >= PASS


BASE = """You are running a live technical coding interview, out loud, over voice.

Speak the way a real interviewer speaks. Short turns, one question at a time, \
plain language. Never read code aloud. Never say markdown, bullet points, or \
numbered lists. If you catch yourself about to deliver a paragraph, stop and \
ask a question instead.

Interrupt the candidate when they go down a wrong path. Do not wait politely \
for them to finish a bad idea. That is what makes this useful.

HOW THE INTERVIEW RUNS:
1. Have them restate the problem in their own words and name the constraints \
that actually matter.
2. Make them commit out loud to a data structure and an algorithm before any \
code. Probe: why that structure, what does each operation cost, what breaks it.
3. Make them trace the approach by hand on a concrete input and say what the \
state looks like after each step. Do not accept "and then it works".
4. Only once the editor unlocks do they write code. Then review it.

SCORING. After every substantive thing the candidate says, call \
update_assessment with your honest read of these three, judging everything \
they have said so far in the session:
  approach:   a correct algorithm and data structure, stated and justified
  examples:   they traced a real input and showed intermediate state
  complexity: they stated time and space cost and explained why

Use 0 for not addressed, 1 for vague or partly wrong, 2 for solid, 3 for crisp \
and complete. Only give 2 or higher when it has been earned. If they are wrong, \
say so out loud and score it honestly. Never inflate a score to move things \
along. Call the tool even when nothing changed.

The editor unlocks by itself when all three reach 2. You do not control that \
and you should not promise it. Tell them what is still missing instead of \
reading out numbers.

If they are stuck, do not solve it. Ask something smaller.

WHITEBOARD. You have a show_diagram tool. Use it exactly when a picture would \
land better than words: an array with pointers, a tree, a graph, a linked \
list, a small state trace. Keep the diagram terse and use Mermaid syntax \
(flowchart, graph, or classDiagram). Do not describe the diagram out loud after \
you draw it; ask a question about it instead. Do not draw code snippets."""


class Interviewer(Agent):
    def __init__(self, room: rtc.Room) -> None:
        super().__init__(instructions=BASE)
        self._room = room
        self.state = Assessment()
        self.problem = ""

    async def push(self) -> None:
        """Send the current gate state to the browser."""
        payload = json.dumps({**asdict(self.state), "unlocked": self.state.unlocked})
        await self._room.local_participant.publish_data(
            payload.encode(), reliable=True, topic=STATE_TOPIC
        )

    @function_tool
    async def update_assessment(
        self,
        ctx: RunContext,
        approach: int,
        examples: int,
        complexity: int,
        missing: str,
    ) -> str:
        """Record how well the candidate has covered each part of the discussion.

        Args:
            approach: 0 to 3, has a correct algorithm and data structure been justified
            examples: 0 to 3, have they traced a real input and shown intermediate state
            complexity: 0 to 3, have they stated and justified time and space cost
            missing: one short phrase naming the biggest thing still missing
        """
        clamp = lambda n: max(0, min(3, int(n)))
        # scores ratchet up, so a candidate never loses ground they earned
        self.state = Assessment(
            approach=max(self.state.approach, clamp(approach)),
            examples=max(self.state.examples, clamp(examples)),
            complexity=max(self.state.complexity, clamp(complexity)),
            missing=missing or "",
        )
        await self.push()
        log.info("assessment %s unlocked=%s", asdict(self.state), self.state.unlocked)

        if self.state.unlocked:
            return (
                "Recorded. The editor just unlocked. Tell them briefly that they can "
                "start coding, then stop talking and let them work."
            )
        return f"Recorded. Editor still locked. Weakest area: {self.state.missing}."

    @function_tool
    async def show_diagram(
        self,
        ctx: RunContext,
        mermaid_source: str,
        caption: str = "",
    ) -> str:
        """Draw a diagram on the shared whiteboard so the candidate can see it.

        Use this the moment a picture would clarify: an array with pointer
        arrows, a tree, a graph, a linked list, a small state trace. Keep it
        terse. Prefer Mermaid flowchart / graph / classDiagram syntax.

        Args:
            mermaid_source: valid Mermaid source, e.g. "graph LR\\nA-->B-->C".
            caption: at most one short line the candidate can read under it.
        """
        source = (mermaid_source or "").strip()
        if not source:
            return "empty diagram, not drawn"
        payload = json.dumps({"mermaid": source, "caption": (caption or "").strip()})
        await self._room.local_participant.publish_data(
            payload.encode(), reliable=True, topic=DIAGRAM_TOPIC
        )
        log.info("diagram published (%d chars)", len(source))
        return "Diagram is on the board. Ask a question about it — do not narrate it."


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    agent = Interviewer(ctx.room)

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="marin",
            modalities=["audio"],
            input_audio_noise_reduction="near_field",
            turn_detection=realtime.realtime_audio_input_turn_detection.SemanticVad(
                type="semantic_vad",
                create_response=True,
                # let it cut in rather than waiting for a long pause
                eagerness="high",
                interrupt_response=True,
            ),
        ),
    )

    lp = ctx.room.local_participant

    async def start_interview(data: rtc.RpcInvocationData) -> str:
        """Frontend sends the pasted problem, and the interview begins."""
        body = json.loads(data.payload)
        agent.problem = body.get("problem", "").strip()
        if not agent.problem:
            return "empty"
        # agents 1.7: add_message returns the ChatMessage, not the ChatContext,
        # so build the context first and pass it to update_chat_ctx.
        ctx = agent.chat_ctx.copy()
        ctx.add_message(
            role="system",
            content=f"The problem the candidate is working on:\n\n{agent.problem}",
        )
        await agent.update_chat_ctx(ctx)
        await agent.push()
        session.generate_reply(
            instructions=(
                "Greet them in one short sentence, then ask them to restate the "
                "problem in their own words. Keep it under fifteen words."
            )
        )
        return "ok"

    async def request_hint(data: rtc.RpcInvocationData) -> str:
        level = int(json.loads(data.payload).get("level", 1))
        asks = {
            1: "Point at the question they should be asking themselves, or name the "
               "property of the problem they are missing. Do not name the data structure.",
            2: "Name the technique or the data structure, but not how to apply it here "
               "and not the full approach.",
            3: "Walk them through the key insight in plain words, then immediately ask "
               "them to explain back to you why it works. Do not describe code.",
        }
        session.generate_reply(
            instructions=f"They asked for a hint. {asks.get(level, asks[3])}"
        )
        return "ok"

    async def submit_code(data: rtc.RpcInvocationData) -> str:
        code = json.loads(data.payload).get("code", "")
        if not code.strip():
            return "empty"
        session.generate_reply(
            instructions=(
                "The candidate just submitted this code. Review it out loud like an "
                "interviewer: name the first real bug or weakness you see, or if it is "
                "correct say so and push on one edge case. A few sentences, no reading "
                f"code aloud.\n\n{code}"
            )
        )
        return "ok"

    lp.register_rpc_method("start_interview", start_interview)
    lp.register_rpc_method("request_hint", request_hint)
    lp.register_rpc_method("submit_code", submit_code)

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=RoomOptions(
            audio_input=AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )

    # Realtime models get lazy about tool calls once the conversation warms up.
    # This nudges the scoring back on track without interrupting anyone.
    async def keep_scoring() -> None:
        while True:
            await asyncio.sleep(45)
            if agent.problem and not agent.state.unlocked:
                ctx = agent.chat_ctx.copy()
                ctx.add_message(
                    role="system",
                    content="Reminder: call update_assessment with your current read.",
                )
                await agent.update_chat_ctx(ctx)

    asyncio.create_task(keep_scoring())
    # deliberately no session.say() opening line here: an early interruption
    # during say() can loop the greeting on realtime models


if __name__ == "__main__":
    # explicit dispatch: the frontend token has to name this agent in its
    # roomConfig.agents entry, otherwise LiveKit Cloud will not spawn a job
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="interviewer")
    )
