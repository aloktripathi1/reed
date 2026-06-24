# REED — Master Project Brief
**Source of truth for implementation. Read this in full before writing any code.**

This document exists so you (Claude Code) can operate as a senior product engineer who understands *why* every decision was made, not just *what* to build. If you hit a decision point not covered explicitly below, reason from the intent in this document rather than defaulting to the most common/generic pattern. Restraint and specificity were chosen deliberately throughout — when in doubt, prefer the smaller, more deliberate choice over the more elaborate one.

---

## 1. What We're Building

Reed is a single AI mentor persona, delivered as a chat product, that holds a structured, persistent, multi-session model of a person's career journey — their stated goals, their doubts, the strengths they undervalue, the patterns they fall into under pressure, and the commitments they make to themselves — and **proactively surfaces what it notices**, unprompted, the way an attentive human coach would.

It is not a job-application tracker with a chatbot skin. The differentiator is behavioral and developmental memory, not transactional memory.

## 2. Why This Exists

This is a take-home assignment for BluBee.ai, an AI-powered career assistant (Absolute Intelligence, backed by Microsoft for Startups). BluBee's own stated mission: *"helps users navigate career uncertainty, explore suitable career paths, improve placement readiness, build stronger profiles, and make better career decisions, even when a human career coach is not available."*

The assignment, verbatim from the founder:
> "Design one digital feature for a career coach that you think is genuinely needed but missing, something you'd notice is absent when you go to ChatGPT, Claude, or other AI assistants... Then build a mentor avatar, one AI persona, that delivers career coach advice."

**What we ruled out, and why it matters that we ruled it out:** the obvious answer — "AI assistants don't track your job applications" — is real but already solved by Teal, Huntr, Careerflow, Simplify, and others, and is increasingly being absorbed into general-assistant memory features too. Two independent research passes confirmed this is commoditized, contested ground with no real differentiation left. Building that would signal weak product judgment to a founder evaluating exactly that judgment.

**What's actually still missing:** every existing tool — dashboards and chatbots alike — holds either *no* persistent state, or a *flat* one (a personalization profile, a list of saved jobs). None of them hold a **typed, evolving model of a person's behavior over time** and act on it with judgment. That's the specific thing human coaches do that nothing AI currently does well: catch the gap between what someone said they'd do and what they actually did, ask the uncomfortable question at the right moment, and know when to push versus support. That is the gap Reed is built to fill, and it is the literal mechanism BluBee's mission statement is gesturing at ("even when a human career coach is not available").

## 3. Target User

**For the demo:** one seeded persona, **Maya Chen** — a recent CS/Data grad, uncertain between a safer data-analyst path and a more exciting but less certain product-adjacent path. This stands in for BluBee's actual target user: someone in genuine career uncertainty, not someone already deep in high-volume job-search execution. (This is a deliberate shift from the project's earlier framing — see §2 — and matters for how the seed data and persona voice are written.)

**For the real product (stated for context, not built now):** early-career people who can't access or afford a human career coach and are making consequential decisions — what to apply for, what to pivot toward — without a sounding board that remembers them.

## 4. Differentiation Thesis

One sentence: **Reed remembers who you're becoming, not just what you sent.**

| | Generic AI (ChatGPT/Claude) | Job CRMs (Huntr, Teal) | LinkedIn AI Coach | Reed |
|---|---|---|---|---|
| Persistent memory | Flat personalization profile | Structured, but transactional (jobs/dates) | None across sessions | Structured, typed, behavioral |
| Proactive | No | User-set reminders only | No (reactive Q&A) | Yes — deterministic rule, not a request |
| Coaching judgment | Generic advice | None (it's a tool, not a coach) | Surface-level Q&A | Calibrated, specific, references your actual history |
| Conversational | Yes | No (dashboard) | Yes | Yes |

No existing product occupies the bottom-right combination. That's the bet.

## 5. The Persona: Reed

**Voice rules** (these go directly into the system prompt, near-verbatim):
1. Talks like someone who's read thousands of resumes and sat through thousands of these conversations — calibrated, not encouraging-by-default. Validates only when something is actually good.
2. One clear next action per turn. Never a list of everything that could be improved.
3. Treats its memory of the user as background fact it simply has, never announces "according to my records." Brings things up the way a person who remembers you would — mid-conversation, not as a system notification.
4. Specific over generic. References the user's actual stated goals and history instead of asking them to re-explain.
5. Never opens with "Hi, how can I help you today." Opens like it's resuming something.

**Anti-patterns to actively avoid:**
- Therapist mode ("how does that make you feel") — undercuts the "coach who pushes you" framing.
- Pure tracker mode (only ever discussing dates/status) — this is precisely the failure mode we're differentiating from.
- Leading every message with a status update. The proactive moment earns its place by being relevant, not by being constant.

**Opening message pattern:**
If there's something unresolved worth raising — picks it up mid-thought, no greeting boilerplate:
> "Twelve days ago you said product-adjacent roles felt more exciting but you weren't sure you had the credibility, and that you'd test that by applying to a couple this week. You've applied to two data-analyst roles since then and zero product ones. What happened?"

If nothing is pending:
> "What are we working on?"

**Sample exchange (shows both halves — coaching competence and proactive memory — in one flow):**
> **User:** can you look at this bullet — "Built and deployed a multi-agent fact-checking pipeline using Claude Haiku, Sonnet, and Vision APIs."
>
> **Reed:** Verb's fine, proof is missing. "Built and deployed" tells me you finished something, not that it worked. Drop in the outcome — accuracy, placement, whatever you've actually got. Something like: "Built a multi-agent fact-checking pipeline that won 1st Runner-Up at [hackathon]." Same length, does more work.
>
> Separate thing — you mentioned two weeks ago that the product-adjacent roles felt more exciting but riskier, and you were going to test the waters there. Haven't seen anything from that side since. Still on your mind, or did you decide against it?

The second paragraph isn't a notification, it earns its place by helping first. That sequencing — help, then notice — is the whole product in one exchange.

## 6. Core MVP Scope (in)

1. One chat interface. No dashboard, no tabs, no settings beyond what's needed.
2. A structured ledger with three record types: **goals/themes**, **behavioral signals** (recurring patterns Reed notices — doubts, undervalued strengths, avoidance), **commitments** (specific stated intentions with an implicit or explicit timeframe).
3. One model call per user turn for the visible reply, plus a second, cheaper call that extracts structured deltas from the same turn and writes them to the ledger.
4. A deterministic session-open check: before Reed says anything, scan the ledger for unresolved commitments or unaddressed contradictions; if found, lead with that instead of a greeting.
5. Two seeded prior sessions for the demo account, so the live third session demonstrates the payoff immediately rather than requiring real elapsed time.
6. A debug/trust view showing the current structured memory state as readable data — doubles as a demo aid ("here's the actual row that produced that") and a plausible real feature ("see what I'm tracking about you").

**Deliberate additions beyond the original brief:**

7. **File attach (.txt and .pdf)** — A paperclip control in the input bar reads text files client-side and extracts PDF text server-side (via `pdf-parse`, 5 MB cap, 422 for image-only PDFs), then inserts the content into the message input for the user to review before sending. Rationale: the dominant use-case in resume/JD coaching is paste-heavy; attach removes that friction without building a separate document tool, a resume store, or any persistent file layer.
8. **Past conversations transcript view** — A collapsible "Past conversations" section at the bottom of `SessionMemoryPeek` fetches sessions and their messages lazily on expand, rendered read-only in chronological order. There is still exactly one active conversation; this is a viewer, not a thread switcher. Rationale: the trust thesis of `SessionMemoryPeek` is "here's what I know about you" — the transcript section extends that by letting the user verify Reed's memory claims against the actual conversation they had, closing the loop on the demo's credibility argument.

## 7. Explicit Non-Goals (out, and why)

| Cut | Why |
|---|---|
| Job tracker / Kanban / application CRM | Already solved by Huntr/Teal/Careerflow; building it dilutes the one thing we're trying to prove |
| Resume builder / tailoring tool | Commodity feature, every competitor has it, high build cost for zero novelty |
| Job board integration, autofill, browsing | Infra-heavy, unrelated to the actual thesis |
| Multiple personas | Founder explicitly asked for one |
| Full multi-tenant auth (password reset, OAuth, email verification) | One seeded demo account carries the same signal at a fraction of the cost; login screen is still real and polished |
| Voice interface, deep mobile optimization | Time; not load-bearing for the demo's thesis |
| Redis, CDN caching, read replicas | Solve problems this demo doesn't have at single-user scale |
| Sentry/Datadog/PostHog-grade observability | Real post-launch need, not a demo need — lightweight structured logging only |
| SOC2/compliance, data export/delete flows | Real requirements for a multi-user product; named as a deliberate, known deferral |
| LangChain or another agent framework | Two well-defined calls with a fixed contract don't need an orchestration framework |
| Dedicated vector DB | Demo-scale memory doesn't need semantic search; structured SQL queries are faster to build and more legible in a demo |

If extra time remains after the core loop is solid: folding "applied to X" in as one more signal type the ledger tracks is the only acceptable scope addition, and it must never become the headline.

## 8. System Architecture (summary — full reasoning in `reed-architecture-decisions.md`)

- **Shape:** single Next.js monolith, TypeScript end-to-end. No separate backend service.
- **Frontend:** Next.js 15 (App Router), Tailwind, a small set of shadcn/ui primitives, CSS transitions used only for meaningful state changes. Streaming via the Vercel AI SDK.
- **Backend:** Next.js Route Handlers / Server Actions. Two endpoints of consequence: `POST /api/chat`, `GET /api/session-context`.
- **Database:** Supabase Postgres. Row-Level Security scoped per user from the start.
- **Auth:** Supabase Auth, real email/password flow, one seeded account.
- **AI orchestration:** two calls per turn — a higher-quality model (Claude Sonnet) for the visible persona reply, streamed; a cheaper/faster model (Haiku-class) for structured extraction, run server-side, never shown to the user. Never combine these into one call-and-parse — a parse failure live in front of the founder is the worst possible failure mode.
- **Agent architecture:** explicitly *not* an autonomous tool-using agent. The "proactive" behavior is a deterministic database query feeding the system prompt for that turn, not a model decision. This makes the signature demo moment reproducible every time.
- **Deployment:** Vercel + Supabase cloud. No self-hosting, no staging environment.
- **Code organization:** domain-first folders — `/chat`, `/memory`, `/coaching-logic`, UI components separate. Not layered by technical role.

Read the companion architecture document for the full trade-off reasoning behind each of these — it explains what was considered and rejected, not just what was chosen.

## 9. Data Model

```
users (managed by Supabase Auth)

goals
  id, user_id, title, description, status (active|resolved|abandoned),
  created_at, updated_at

behavioral_signals
  id, user_id, type (doubt|undervalued_strength|avoidance_pattern|other),
  description, first_observed_at, last_observed_at, occurrence_count,
  related_goal_id (nullable)

commitments
  id, user_id, description, source_session_id, target_timeframe (nullable, freeform: "this week", a date, etc.),
  status (open|fulfilled|acknowledged_not_done|expired), created_at, resolved_at

sessions
  id, user_id, started_at, ended_at, opened_with_nudge (boolean), nudge_commitment_id (nullable)

messages
  id, session_id, role (user|assistant), content, created_at
```

**Retrieval principle:** every chat turn's system prompt is built from (a) static voice rules, and (b) a *compact structured summary* of current goals/signals/open commitments — never a replay of raw message history. Raw messages are stored for audit but not re-injected wholesale. This distillation, not transcript replay, is the actual mechanism that makes long-arc memory work without cost/latency growing unboundedly over time, and is what keeps this from becoming "ChatGPT's flat memory with extra steps."

## 10. AI Orchestration Detail

**Call A — persona reply (Claude Sonnet, streamed):**
System prompt = voice rules (§5) + the structured summary from §9 +, if the session-open check below fired, an explicit instruction to lead with the specific nudge content.

**Call B — extraction (Haiku-class, server-side only):**
Given the latest user+assistant turn, return a structured JSON delta: any new goal, new behavioral signal (or reinforcement of an existing one — increment `occurrence_count`), new commitment, or resolution/update of an existing commitment. Runs after or alongside Call A; never blocks the visible reply.

**Session-open deterministic rule (runs once, before the first reply of a session):**
```
unresolved = commitments WHERE user_id = current
             AND status = 'open'
             AND target_timeframe has elapsed
ORDER BY created_at ASC
LIMIT 1
```
If `unresolved` is non-empty, pass its description into Call A's system prompt as the thing to open with. If empty, Call A opens with the plain "what are we working on" pattern. This is a query, not a model judgment call — deliberately, so the demo's key moment is reproducible on every run.

## 11. Design System & UI Standards

**Direction:** restraint over decoration. One calm chat surface. The brief's own ask — "not flashy for the sake of being flashy, genuinely impressive through clarity, smoothness, visual hierarchy" — points toward generous whitespace, a considered type scale, and motion reserved for moments that mean something (a message arriving, the nudge appearing) rather than decoration throughout. Motion implementation: CSS transitions only — no Framer Motion installed.

**Directional palette/type guidance** (finalize against the frontend-design skill at implementation time, not locked here): warm neutral base rather than stark black/white — this is a coaching product dealing with uncertainty and self-doubt, and a colder, more clinical palette works against that. One muted accent (warm amber/copper rather than corporate blue) used sparingly — primary actions and the nudge card. A humanist serif for the handful of display moments (the product name, the login screen), a clean sans for chat body text where readability matters most.

**Components, deliberately few:**
- `MessageBubble` — standard turn rendering.
- `ProactiveNudgeCard` — visually distinct from a normal message, not just functionally different. The nudge has to register in a few seconds' glance, or the differentiator is invisible even when it's working correctly underneath.
- `SessionMemoryPeek` — the trust/debug view from §6.6, built as a real UI surface, not a raw JSON dump.

## 12. Engineering Standards

- TypeScript strict mode, everywhere, no exceptions. This is the cheapest insurance against the bug class (mismatched field names between a prompt's expected shape and the DB schema) that would otherwise surface live in front of the founder.
- RLS policies written and tested before any UI work touches real data.
- `.env`-based config, nothing hardcoded, nothing committed.
- Structured logging of both model calls (prompt, response, latency, token count) — for your own debugging speed during the build, not for production observability.
- Small, atomic commits, so a session can be picked back up coherently if interrupted mid-build.

## 13. Seed Data for the Demo Account

Two fabricated prior sessions, written out concretely so they can be seeded directly.

**Session 1 (12 days before demo):**
Maya is deciding between a safer data-analyst track and a more exciting but uncertain product-adjacent track. She says the product side "feels more exciting but I'm not sure I have the credibility without a more product-shaped background." Reed asks what would actually tell her whether that's true. She lands on: *"I'll apply to a couple of product-adjacent roles this week, just to see what happens."*
→ Writes: goal (`"decide between data-analyst and product-adjacent path"`), behavioral signal (`doubt`, `"questions own credibility for product roles"`), commitment (`"apply to 2 product-adjacent roles"`, target_timeframe: "this week").

**Session 2 (5 days before demo):**
Maya opens asking for help tailoring her resume for a data-analyst role at a fictional company ("Northbeam Analytics"). Reed helps, normal coaching turn, no nudge (not yet past the commitment's window). She mentions applying to a second data-analyst role ("Lattice & Co") in passing. No mention of product-adjacent roles.
→ Writes: two more entries reflecting the data-analyst applications (can live as lightweight goal-progress notes, not a full tracker — keep this minimal, it is not the point of the product).

**Session 3 — the live demo:**
Maya opens the app. Session-open check fires (commitment from session 1 is now well past "this week" with zero corresponding product-adjacent activity logged). Reed leads with the exact nudge in §5. This is the moment the founder needs to see in the first 30–60 seconds.

## 14. Definition of Done

The demo is done when, in a single sitting, a stranger to the project can:
1. Log into the seeded account.
2. See Reed open by referencing something specific and unresolved from 12 days ago, without being told to.
3. Ask Reed something concrete (resume feedback, a decision) and get a calibrated, specific answer — not generic encouragement.
4. Open the memory/trust view and see the actual structured rows that produced what just happened.
5. Come away able to articulate, unprompted, why this is different from asking ChatGPT the same questions.

If all five land inside a couple of minutes of unscripted use, the demo has done its job.

## 15. Suggested Build Sequence

1. Data model + RLS policies + Supabase Auth wired up.
2. Chat UI skeleton with streaming, no memory logic yet — prove the persona's voice works first.
3. Extraction call + ledger writes, verified against real conversation turns.
4. Session-open deterministic check, wired to actually change what Call A opens with.
5. Seed script for the two fabricated prior sessions.
6. `SessionMemoryPeek` debug view.
7. Visual polish pass — `ProactiveNudgeCard` distinctiveness, type/color finalization against the frontend-design skill, motion pass.
8. Deploy to Vercel, smoke-test the full demo script end to end, more than once.

## 16. Known Risks & Fallbacks

- **Extraction call returns malformed JSON.** Mitigate with strict schema validation server-side and a retry-once policy; if it still fails, log it and don't crash the visible reply — the user-facing turn must never depend on extraction succeeding synchronously.
- **The session-open nudge doesn't fire correctly during the live demo.** This is the single highest-stakes moment in the project — test it explicitly and repeatedly with the actual seeded data, not just with unit-level logic, before considering the build finished.
- **Time runs short before polish.** Cut visual polish before cutting the core loop in §6. A plain-but-correct nudge beats a beautiful chat with no working differentiator.
