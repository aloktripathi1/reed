# Reed — System Architecture & Technology Decisions

**Context that constrains every decision below:** one builder, ~1.5 days, one evaluator (the founder), success measured by a working polished demo that makes the differentiator visible in under a minute. Every choice is optimized for that reality first, with an explicit note on how it evolves if this becomes a real product. Where I'd build differently for a 6-month roadmap vs. for Thursday, I say so.

---

## 1. Overall Product Architecture

**Decision:** A single full-stack monolith. One Next.js app, one Postgres database (Supabase), server-side calls out to an LLM API. One repo, one deploy target.

**Alternatives considered and rejected:**
- *Separate frontend + backend services (e.g., FastAPI backend, React SPA frontend).* This is your default stack from past projects (SachCheck, Lumen) and would be defensible at 2+ weeks. At 1.5 days it doubles the surface area that can break: two deploy targets, CORS, two type systems to keep in sync. Rejected purely on time, not on merit.
- *Microservices / agent-mesh architecture.* Wrong shape entirely. There's one persona and two model calls per turn. Distributing that across services adds latency and failure points with zero benefit at this scale.

**Pattern:** Modular monolith, organized by domain (`chat`, `memory`, `coaching-logic`) rather than by technical layer (`controllers`, `models`, `views`). At this codebase size, anyone — including Claude Code — should be able to find "everything about the proactive nudge" in one folder, not scattered across layers.

**Long-term path:** If this graduates beyond a demo, the natural split is extracting the memory/coaching-logic domain into its own service once it needs to be shared across channels (web, email digests, Slack). Not needed now — noting it so the brief doesn't imply this is the final shape forever.

---

## 2. Frontend Stack

**Decision:** Next.js 15 (App Router), TypeScript, Tailwind, a small set of shadcn/ui primitives as a base, Framer Motion reserved for the handful of state-change animations that matter.

**Reasoning:**
- React Server Components + streaming fit a chat product naturally — the Vercel AI SDK's `useChat`/`streamText` gives token-by-token rendering almost for free, which directly serves "fast and responsive interactions." A laggy chat reads as broken; a streaming one reads as alive, even at identical total latency.
- File-based routing and the Vercel deploy story remove operational overhead you don't have time for.
- You already have working fluency here (RidgeLine, Lumen, prior Next/React work) — in a time-boxed build, using a framework you're fast in is a risk-reduction decision, not a taste decision.

**Alternatives rejected:**
- *Vite + plain React SPA.* Loses RSC/streaming ergonomics for no compensating benefit.
- *SvelteKit.* Smaller AI-tooling ecosystem (Vercel AI SDK is React-first), and introduces a learning-curve risk for no payoff in 1.5 days.

**State management:** Server state via RSC/server actions; client state kept to the absolute minimum needed for streaming UI (no Redux — there is exactly one screen).

---

## 3. Backend Stack

**Decision:** TypeScript end-to-end. Backend = Next.js Route Handlers / Server Actions. No separate Python service.

**Reasoning:** This is the one decision most worth explaining, because it cuts against your default stack. A Python/FastAPI backend is the better long-term fit for an ML-heavy product — but introduces a second language, a second type system, and a second deploy target that must stay in sync with the frontend's types. In a solo 1.5-day build, every integration seam is a place to lose hours to a silent mismatch (field renamed in the DB schema, not renamed in the API contract). One language end-to-end removes that whole bug class. This is a time-boxed trade-off, not a claim that Python is the wrong tool generally — if this became a 2-week build with heavier ML components, I'd reconsider.

**API surface (intentionally small):**
- `POST /api/chat` — streams the persona reply, triggers extraction as a side effect
- `GET /api/session-context` — assembles the structured ledger used to decide whether to open with a proactive nudge

---

## 4. Database

**Decision:** Supabase Postgres for all structured state.

**Reasoning:** The core data — goals, behavioral signals, commitments — is relational, and the differentiator depends on being able to run real queries against it ("any commitment overdue and not yet surfaced"). That's a SQL `WHERE` clause, not a vector search.

**Alternative considered: a dedicated vector DB (Qdrant — used in Lumen) for semantic memory retrieval.**
Rejected for MVP. Semantic retrieval solves a *scale* problem (thousands of memories, need fuzzy recall) this demo doesn't have — a handful of seeded sessions and a few dozen rows. Structured queries are faster to build, faster to run, and — critically for a coaching product demo — fully legible: you can show the founder the *exact row* that triggered a nudge. That legibility is also a feature of real coaching, not just a debug convenience.

**Long-term path:** Supabase ships `pgvector` natively. If raw transcript volume grows and you want semantic search over old conversations (not just structured facts), that extension lives inside the same database — no second infra system. Flagging this now so the brief doesn't accidentally imply a vector DB needs to be bolted on later; it doesn't.

---

## 5. Authentication & Authorization

**Decision:** Supabase Auth, real email/password flow, one seeded demo account pre-loaded with two fabricated prior sessions.

**Reasoning:** The login screen is part of the first impression — "polished, premium-feeling" starts before the chat does, so it's built properly rather than bypassed. But scope is tight: no password reset, no OAuth providers, no email verification. Those are real product requirements for a multi-user app and irrelevant to a one-account demo — explicit, named cut.

**Authorization:** Postgres Row-Level Security scoped to `user_id`, set up correctly from the start. This is nearly free to do right at this scale and is the kind of detail a senior engineer doesn't skip even in a throwaway demo — if the founder looks at the database, this is what signals maturity.

---

## 6. AI Orchestration Layer

**Decision:** Two calls per turn, different models for different jobs.

- **Call A — the persona reply.** Claude Sonnet. Streamed directly to the user. This is the voice of the product; reasoning and tone quality matter most here.
- **Call B — structured extraction.** A cheaper, faster model (Haiku-class). Runs server-side, never shown to the user, writes the delta (new goal, new signal, new commitment) to Postgres.

**Why two calls, not one combined call returning reply-then-JSON:** already debated and settled — a parse failure on a combined response is the single worst failure mode in a live founder demo. Two calls cost roughly 150–400ms more latency; that's cheap insurance against the demo breaking on the one interaction that matters most.

**Why different models for the two calls:** extraction is structured-JSON-in, structured-JSON-out — it doesn't need the more expensive model's reasoning depth. Using one model for everything is the generic choice; matching model cost to task is the senior-engineer one, and it also keeps the visible reply's latency down since the cheap call can run without blocking it.

**Alternative rejected: LangChain or another agent framework.** This is two well-defined calls with a fixed data contract, not a dynamic multi-tool loop. A framework adds abstraction and a dependency surface with no corresponding benefit here — direct SDK calls are easier to debug under time pressure, and knowing when *not* to reach for a framework is itself the right call.

**Model provider note:** Claude is also a deliberate nod to the hackathon relationship; the JD's own tool list leans OpenAI/Azure, so this is worth being upfront about as a judgment call in the brief, not presented as the only valid choice.

---

## 7. Agent Architecture

**Be precise about what this is and isn't.** This is not an autonomous, multi-step, tool-using agent. There's no planning loop and no tool-calling chain. What looks "agentic" in the product (proactive, stateful, remembers your arc) is achieved through:
- A **deterministic rule**, not a model decision, that decides whether to open a session with a nudge: query for any overdue commitment or unaddressed contradiction not yet surfaced, and feed that into the system prompt for that turn if found.
- A **side-effect write** (the extraction call) rather than autonomous action-taking.

**Why deterministic beats "let the model decide":** an actual planning/tool-use agent is a much riskier bet for 1.5 days — nondeterministic control flow is exactly what fails unpredictably in front of an audience. A hand-written rule means the signature demo moment fires the same way every single time you run it, which matters more here than architectural sophistication.

**Long-term path:** the natural evolution is moving the "scan and decide" step into a scheduled background job (Supabase Edge Function / cron) so nudges can be proactively pushed (email, notification) rather than only surfaced on session-open. Explicitly out of scope now — named so it doesn't read as a limitation no one thought about.

---

## 8. Data Storage & Retrieval Strategy

**Decision:** Every turn, the system prompt is assembled from (a) static persona/voice rules, and (b) a **compact structured summary** of current goals, signals, and commitments — not a replay of raw transcript history.

**Why this is the actual mechanism that makes "long-arc memory" work, not just a performance optimization:** the research explicitly identified the failure mode of existing AI memory as a flat, undifferentiated personalization blob. Distillation into typed records — rather than dumping growing transcript history into every prompt — is what keeps this from becoming the same thing with extra steps. It also keeps token cost and latency flat regardless of how many sessions have happened, which matters for both cost and the "fast" requirement.

Raw transcripts are still stored, for audit/debugging — just not replayed wholesale into context.

---

## 9. Caching & Performance

At single-user, low-QPS scale, performance work is almost entirely about *perceived* latency, not throughput.

**What's actually built:**
- Token-by-token streaming for the visible reply.
- Extraction call fired without blocking the visible response.
- Optimistic UI: the user's own message renders instantly client-side, ahead of the round trip.
- A basic index on `(user_id, created_at)` for the commitments/signals tables, since the session-open check is a time-bounded scan. Trivial at this scale, but worth doing and naming — it's the kind of thing that signals awareness even when it doesn't matter yet.

**Explicitly not built:** Redis, CDN-level caching, read replicas. These solve problems this demo doesn't have. Naming what's deliberately skipped is itself part of demonstrating judgment, not an oversight to backfill later.

---

## 10. Observability, Analytics & Monitoring

**Decision:** Lightweight structured logging only — both model calls (prompt, response, latency, token count) logged to a simple table or platform logs. This exists so *you* can debug extraction failures fast while building, not as production observability.

**One thing worth actually building, beyond pure logging:** a small internal view (can be gated behind a hidden route) that dumps the demo user's current structured memory state — goals, signals, commitments — as readable JSON or a simple table. This isn't observability for production use; it's a **demo and trust aid**. If the founder asks "how do I know this is really tracking structured state and not improvising," you flip to this view and show the actual rows that produced the nudge. A real coaching product would plausibly expose a version of this to users too — "see what I'm tracking about you" — so it doubles as a feature seed, not just debug tooling.

**Explicitly cut:** Sentry/Datadog/full APM, product analytics (PostHog/Amplitude). Real needs post-launch, not demo needs — named in the brief as a deliberate "day 2" item so they don't get over-built now.

---

## 11. Deployment & Infrastructure

**Decision:** Vercel for the app, Supabase cloud for DB/auth. No self-hosting.

**Reasoning:** Zero-config deploy, instant preview URLs (useful for iterating and for handing the founder a live link rather than a recording), no infrastructure to maintain. Self-hosting on your own box is your usual style and gives more control, but control isn't the bottleneck here — reliable reachability with zero ongoing maintenance is, especially if the founder opens the link days after you've stopped actively watching it.

**Environments:** One production-like environment. No staging — not worth the overhead for a single-consumer demo.

---

## 12. Scalability Considerations

Stated plainly, for the brief: the current shape (Postgres + structured state + two calls per turn) comfortably handles hundreds of users with no changes. The two points that would actually need work, if this grew:
- **Per-user session volume growing very large** → add a periodic distillation step that compresses older structured facts rather than keeping every commitment forever indefinitely.
- **Concurrent users growing large** → connection pooling (Supabase ships PgBouncer already) and moving the extraction call off the request path into a queue.

Neither is built now. The point of stating this in the brief is so Claude Code doesn't either over-build for scale that doesn't exist, or make a choice now that can't be evolved later.

---

## 13. Security & Privacy

Worth taking seriously even for a demo, because the product's subject matter is someone's job-search anxiety and self-doubt — sensitive personal content, not generic CRUD data.

**Built:** RLS scoped per user as stated in §5; API keys server-side only, never exposed to the client; no third-party analytics logging of conversation content; encryption at rest (Supabase default).

**Explicitly deferred, and named as known rather than overlooked:** SOC2/compliance work, a data retention policy UI, GDPR export/delete flows. Real requirements for a multi-user product, irrelevant for one seeded account — one line in the brief acknowledging this is a deliberate scope cut, not a gap nobody noticed.

---

## 14. Development Workflow & Code Organization

- Single repo, domain-first folder structure: `/chat`, `/memory` (extraction + ledger logic), `/coaching-logic` (session-open rules, persona prompt assembly), UI components separate. Domain cohesion over layer purity at this codebase size — anyone picking this up should find everything about one capability in one place.
- TypeScript strict mode everywhere. This is the cheapest available insurance against exactly the bug class that would otherwise only surface live in front of the founder — mismatched field names between a prompt's expected JSON shape and the DB schema.
- `.env`-based config, nothing hardcoded.
- Small, atomic commits — partly good practice, partly so the brief and commit history together let Claude Code resume coherently if a session is interrupted mid-build.

---

## 15. UI/UX Design System & Component Architecture

This earns real attention because "polished, modern, premium-feeling" is a success criterion in its own right, separate from whether the engineering works.

**Direction:** restraint over decoration. A single calm chat surface — most companion/coaching products fail by adding dashboard chrome around the conversation; the brief explicitly asks for "not flashy for the sake of flashy," which points toward generous whitespace, a considered type scale, one accent color, and motion reserved for state changes that actually mean something (a message arriving, the proactive nudge appearing) rather than decorative animation throughout.

**Component set, kept deliberately small:**
- `MessageBubble` — standard turn rendering
- `ProactiveNudgeCard` — visually distinct from a normal message, not just functionally different. This is a specific, deliberate response to the "the wow moment has to register in seconds" finding from the research — if the nudge looks like just another chat bubble, the differentiator is invisible in a 30-second glance even though it's functioning correctly underneath.
- `SessionMemoryPeek` — the trust/debug view from §10, designed as a real UI element rather than a raw JSON dump, since it may double as a legitimate product feature.

Built on Tailwind plus a handful of shadcn primitives — not a heavy custom component library. The investment matches the actual surface area, which is essentially one screen.

---

## What this adds up to

Nothing here is exotic. The judgment is almost entirely about *restraint* — Postgres over a vector DB, one language over your usual split stack, a deterministic rule over a "real" agent, structured logging over a monitoring stack, one screen over a dashboard. Every cut is named rather than silent, which is also the easiest way to show a founder you made these calls on purpose.

Flag anything here you'd weight differently before this becomes the spine of the Claude Code brief.
