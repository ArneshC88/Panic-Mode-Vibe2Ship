# Panic Mode

An AI agent for the moment a deadline has already become a crisis — not for calm, advance planning.

Built for the Vibe2Ship hackathon (Coding Ninjas x Google for Developers), problem statement: **The Last-Minute Life Saver**.

## What it does

Most productivity tools assume you're organized enough to plan ahead. Panic Mode is built for the opposite moment: it's late, the deadline is close, and you haven't started.

Tell it your situation (e.g. *"I have a 10-page report due in 6 hours and haven't started"*) and it autonomously:

1. **Triages** — checks your tasks and calendar to calculate realistic usable time before the deadline.
2. **Assesses feasibility** — honestly evaluates whether the full task is achievable in that time.
3. **Branches**:
   - If feasible: scopes the task down to a minimum-viable version, then drafts the actual first concrete artifact (outline, checklist, draft).
   - If not feasible: skips the false hope and drafts a ready-to-send damage-control message (extension request, apology, fallback plan) instead.
4. **Reprioritizes** automatically if the situation changes mid-conversation.

## Tech stack

- **Frontend**: React (TypeScript), Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **AI**: Gemini API with native function calling, orchestrating a multi-step autonomous agent loop
- **State**: React hooks + browser local storage for session persistence

## Architecture

`server.ts` exposes a single `/api/chat` endpoint. It runs an agentic loop against the Gemini API: the model is given 5 tools (`get_tasks`, `get_calendar_events`, `scope_down_task`, `draft_action`, `reprioritize`), and the backend keeps calling Gemini and executing whichever tools it requests until the model returns a final text response. Each tool call and its result is logged and surfaced to the frontend as an "Autonomous Triage Log," so the reasoning chain is visible rather than a black box.

`src/App.tsx` is the single-page React frontend: chat interface, live task/calendar side panels that feed directly into the agent's triage step, and a persistent deadline countdown.

## Running locally

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev
```

## Known limitations

- Task and calendar data are mock/local-only for this hackathon build (no real Google Calendar integration yet).
- Subject to Gemini API free-tier rate limits during heavy testing.
