# Reed — Roadmap Beyond the Demo

The discipline that held through the whole build: don't add surface area, deepen or extend the one mechanic that's actually proven. Everything here is organized so Phase 1 happens before Phase 2 happens before Phase 3 — skipping ahead is exactly how this turns into Huntr with a chatbot bolted on, the thing it was built specifically not to be.

## Phase 1 — Deepen the Mechanic That's Already Proven

- **Round out the signal types.** CLAUDE.md's data model always included recurring doubts, undervalued strengths, and avoidance patterns alongside commitments — the build leaned hardest on commitments because that's what was provable in a demo. A real product needs the other three actually firing, not just designed.
- **Cross-session pattern detection, not just single overdue items.** Noticing one missed commitment is useful. Noticing "this is the third time you've avoided this category of role" is the thing that actually earns the word *behavioral* instead of *task reminder*.
- **A real first-session experience.** The demo skips the cold-start problem entirely with two seeded fake sessions. A real first-time user has nothing for Reed to react to yet — that first conversation needs to be designed to surface initial goals and doubts naturally, not just "what are we working on" into silence.

## Phase 2 — Extend Delivery, Carefully

- **Proactive outreach outside the app.** A scheduled background job, not the synchronous session-open check, that can send a short nudge if someone hasn't opened the app in a while and something's still unresolved. This is the most natural extension of the existing mechanic, not a new one — same query, different trigger.
- **Notification preferences, quiet hours, opt-out.** Becomes necessary the moment this leaves "only happens when you open the chat."

## Phase 3 — The One Borrowed Idea Actually Worth Taking Seriously

- **A "future self" conversation mode**, used specifically when Reed detects someone stuck on direction rather than execution — uncertain what they want, not behind on a task. This is a real, published mechanic: MIT Media Lab ran a pre-registered trial and found it measurably reduced anxiety and increased people's sense of continuity with their own future. It fits BluBee's actual stated mission, career *uncertainty*, more directly than anything else on this list, and it's backed by evidence rather than a hunch, same standard everything else in this build was held to.

## Phase 4 — Multi-User Reality

- Real onboarding/signup, deliberately skipped for one seeded demo account.
- The scale items already named and deferred in CLAUDE.md §12: compress older sessions into fewer distilled facts as history grows instead of keeping every commitment forever; move extraction off the request path into a queue once concurrent users grow; pgvector (already inside Supabase, no new infra) only if raw transcript semantic search becomes an actual need, not preemptively.

## Phase 5 — Make Legibility a Real Feature, Not Just a Demo Aid

The memory sidebar built to earn trust during the demo is a real feature on its own, not scaffolding to throw away. A real product should let someone see, correct, and delete what's stored about them. This is also where the privacy/data-handling questions deliberately deferred in CLAUDE.md §13 get picked back up for real, not as a known gap anymore.

## What Not to Do, No Matter How Much Runway There Is

- **No job tracker UI, ever**, even at scale. If job-search activity gets folded in further, it stays one more thing Reed reasons about in conversation, never its own Kanban screen. That restraint is what kept this from becoming a worse version of Huntr the entire way through — losing it because there's now time to build more would undo the actual thesis, not strengthen it.
- **No second persona.** The pitch was one mentor who actually knows you. That doesn't improve by splitting it, at any scale.

## If There's a Reason to Move Fast Again

Phase 1 has to come first regardless — proactive outreach built on a thin behavioral model is just spam with better timing. But Phase 3, the future-self mode, is the one piece here that could honestly jump the queue if there's ever a moment to impress quickly again. It's the most novel thing on this list and the most directly tied to what BluBee says it's actually for.
