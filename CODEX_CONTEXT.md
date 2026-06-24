# Reed — Codex Handoff Context
**Date:** 2026-06-24  
**Status:** `tsc --noEmit` is CLEAN. App is fully functional. Two feature additions pending.

---

## 1. What Exists & Works

Full Next.js 16 (App Router) app deployed/running with:
- Supabase Auth (email/password), demo account `maya@demo.reed` / `reed-demo-2024`
- Streaming chat via AI SDK v6 (`useChat` + `DefaultChatTransport`)
- Two-model architecture: `claude-sonnet-4-6` (persona, streamed) + `claude-haiku-4-5-20251001` (extraction, silent)
- Structured memory ledger (goals, behavioral_signals, commitments) — extraction runs fire-and-forget after every turn
- Deterministic session-open nudge: if a commitment is overdue, Reed opens with it
- SessionMemoryPeek sidebar: shows goals / behavioral signals / open commitments + collapsible past conversations transcript
- File attach: `.txt` → FileReader client-side, `.pdf` → POST /api/extract-pdf (pdf-parse v2), both injected into textarea
- `next.config.ts` has `serverExternalPackages: ['pdf-parse', 'pdfjs-dist']`

**Seed data:** Maya Chen, 2 prior sessions, commitment "apply to 2 product-adjacent roles" created 12 days ago → fires nudge on login.

---

## 2. Directory Structure

```
/home/alokt/reed/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          ← POST — streams persona reply, triggers extraction
│   │   ├── extract-pdf/route.ts   ← POST — pdf-parse v2, returns { text }
│   │   └── session-context/route.ts ← GET — returns current SessionContext JSON
│   ├── auth/callback/route.ts     ← Supabase auth callback
│   ├── chat/page.tsx              ← Server component — getSessionContext, renders ReedApp
│   ├── login/page.tsx
│   ├── page.tsx                   ← Homepage with nudge card preview
│   ├── layout.tsx                 ← Fraunces (--font-display) + Manrope (--font-body)
│   └── globals.css                ← All design tokens + type utilities (Tailwind v4 @utility)
├── components/
│   ├── reed-app.tsx               ← Main chat UI (useChat, file attach, message rendering)
│   ├── session-memory-peek.tsx    ← Sidebar memory view + PastConversations component
│   └── login-form.tsx
├── lib/
│   ├── chat/
│   │   ├── models.ts              ← PERSONA_MODEL, EXTRACTION_MODEL constants
│   │   └── prompt.ts             ← buildSystemPrompt(sessionContext)
│   ├── coaching-logic/
│   │   └── session-context.ts    ← getSessionContext, buildOpeningMessage, buildMemorySummary, buildLedgerReference
│   ├── memory/
│   │   └── extraction.ts         ← runExtractionModel + persistExtraction (Zod schema)
│   ├── supabase/
│   │   ├── admin.ts              ← createAdminClient() — service role, bypasses RLS
│   │   ├── client.ts             ← createClient() — browser client
│   │   └── server.ts             ← createClient() — server client with async cookies()
│   └── types.ts                  ← Full Database type + Row aliases (Goal, Message, etc.)
├── supabase/migrations/
│   └── 001_initial_schema.sql    ← Applied. All 5 tables + RLS + indexes
├── scripts/
│   └── seed-demo.ts              ← Run with: npm run seed:demo
├── proxy.ts                      ← Next.js 16 middleware (NOT middleware.ts)
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.local                    ← NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, DEMO_USER_PASSWORD
```

---

## 3. Key Technical Facts

| Thing | Value |
|---|---|
| Next.js version | 16 — middleware file is `proxy.ts` (NOT `middleware.ts`). Having both causes fatal 500s. |
| Tailwind | v4 — `@import "tailwindcss"` in CSS, `@tailwindcss/postcss`, `@utility` for customs. No `tailwind.config.ts`. |
| TypeScript | 6.0.3 strict mode |
| AI SDK | `ai ^6.0.209` — `useChat`, `DefaultChatTransport`, `UIMessage`, `convertToModelMessages`, `streamText`, `generateObject` |
| pdf-parse | v2.4.5 — named export `{ PDFParse }`, NOT default. `new PDFParse({ data: buffer })` then `.getText()`. route.ts already uses this correctly. |
| Supabase JS | `@supabase/ssr ^0.12.0` — async `cookies()` in server client |
| DB transport body | `body` in `DefaultChatTransport` is `Resolvable<object>` — can be a `() => object` function for dynamic per-request values |

---

## 4. Design Tokens (globals.css)

```css
--bg:           #f7f5f2   /* warm cream, page background */
--surface:      #fffdfa   /* slightly lighter, cards/header */
--border:       #e8e2d8
--text-primary: #1f1b16
--text-secondary: #6b6358
```

Type utilities: `type-display-xl` (40px Fraunces), `type-display-md` (26px Fraunces), `type-body` (17px Manrope), `type-body-sm` (14px Manrope), `type-label` (11px uppercase Manrope 600).

Orange accent: `orange-500` (#f97316) — used for nudge card, focus rings, badges.

---

## 5. Database Schema (current — 001_initial_schema.sql applied)

```sql
messages (id, session_id, role, content, created_at)
sessions (id, user_id, started_at, ended_at, opened_with_nudge, nudge_commitment_id)
commitments (id, user_id, description, source_session_id, target_timeframe, status, created_at, resolved_at)
goals (id, user_id, title, description, status, created_at, updated_at)
behavioral_signals (id, user_id, type, description, first_observed_at, last_observed_at, occurrence_count, related_goal_id)
```

RLS on all tables. Messages scoped via sessions subquery.

---

## 6. Two Tasks Pending

### Task A — Attachment UX overhaul (REQUIRES DB MIGRATION FIRST)

**Current broken UX:** selecting a file dumps its text into the textarea.

**Required UX:** attachment-as-object, same pattern as ChatGPT/Claude.

#### Step A1 — DB Migration
Run this SQL in the **Supabase dashboard SQL Editor** (cannot be applied programmatically without the DB password):

```sql
alter table public.messages add column attachment_filename text;
alter table public.messages add column attachment_text text;
```

#### Step A2 — Update `lib/types.ts`
Add to `messages` Row, Insert, Update:
```typescript
attachment_filename: string | null  // Row
attachment_text: string | null       // Row

attachment_filename?: string | null  // Insert
attachment_text?: string | null       // Insert

attachment_filename?: string | null  // Update
attachment_text?: string | null       // Update
```

#### Step A3 — Rewrite `components/reed-app.tsx`

Replace current textarea-injection approach with:

**New state:**
```typescript
const [pendingAttachment, setPendingAttachment] = useState<{ filename: string; text: string } | null>(null)
const sendingAttachmentRef = useRef<{ filename: string; text: string } | null>(null)
const [messageAttachments, setMessageAttachments] = useState<Record<number, string>>({})
```

**Transport body becomes a function (reads ref at call time):**
```typescript
transport: new DefaultChatTransport({
  api: '/api/chat',
  body: () => ({
    openingMessage: initialOpeningMessage,
    overdueCommitmentId: initialOverdueCommitmentId,
    sessionId: initialSessionId,
    attachmentFilename: sendingAttachmentRef.current?.filename ?? null,
    attachmentText: sendingAttachmentRef.current?.text ?? null,
  }),
})
```

**handleFileSelect:** instead of `appendToInput(text)`, do `setPendingAttachment({ filename: file.name, text })`

**Remove:** `appendToInput` function entirely.

**handleSubmit changes:**
```typescript
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const trimmed = input.trim()
  if (!trimmed && !pendingAttachment) return   // allow send with attachment + no caption
  if (status !== 'ready') return

  const textarea = formRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
  if (textarea) textarea.style.height = 'auto'

  // Snapshot for message index tracking
  const attachmentSnapshot = pendingAttachment
  if (attachmentSnapshot) {
    setMessageAttachments((prev) => ({ ...prev, [messages.length]: attachmentSnapshot.filename }))
  }

  // Load into ref BEFORE clearing state (transport reads it during sendMessage)
  sendingAttachmentRef.current = pendingAttachment

  setInput('')
  setPendingAttachment(null)

  await sendMessage({ text: trimmed || ' ' })

  sendingAttachmentRef.current = null
}
```

**Attachment chip component** (render above textarea when pendingAttachment is set):
```tsx
function AttachmentChip({ filename, onRemove }: { filename: string; onRemove: () => void }) {
  return (
    <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
      {/* file icon SVG */}
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round"
        strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="type-body-sm text-[var(--text-primary)] max-w-[200px] truncate">{filename}</span>
      <button
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] outline-none focus-visible:ring-1 focus-visible:ring-orange-500 rounded"
        onClick={onRemove}
        type="button"
        aria-label="Remove attachment"
      >
        <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round"
          strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
          <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
```

In the input bar, above the textarea row:
```tsx
{pendingAttachment && (
  <AttachmentChip filename={pendingAttachment.filename} onRemove={() => setPendingAttachment(null)} />
)}
```

**MessageBubble** — add attachment chip rendering. Pass `messageAttachments[index]` as `attachmentFilename` prop. If set, show `AttachmentChip` (without remove button) above the message text. Never render raw attachment text.

```tsx
function MessageBubble({ message, index, attachmentFilename }: { message: UIMessage; index: number; attachmentFilename?: string }) {
  // ... existing logic ...
  // Add above the <p> that renders text:
  // {attachmentFilename && <AttachmentChip filename={attachmentFilename} />}  (no onRemove prop)
}
```

In the messages map:
```tsx
{messages.map((message, index) => (
  <MessageBubble
    index={index}
    key={message.id}
    message={message}
    attachmentFilename={messageAttachments[index]}
  />
))}
```

#### Step A4 — Update `app/api/chat/route.ts`

Accept attachment fields from request body:
```typescript
const { messages, openingMessage, overdueCommitmentId, sessionId, attachmentFilename, attachmentText } = 
  (await request.json()) as {
    messages: UIMessage[]
    openingMessage: string
    overdueCommitmentId: string | null
    sessionId: string
    attachmentFilename: string | null
    attachmentText: string | null
  }
```

When persisting user message, add the new columns:
```typescript
await admin.from('messages').insert({
  session_id: sessionId,
  role: 'user',
  content: latestUserText,
  attachment_filename: attachmentFilename ?? null,
  attachment_text: attachmentText ?? null,
})
```

Build effective user text for model calls (inject attachment content):
```typescript
const latestUserEffective = attachmentText
  ? [latestUserText, `[Attached file: ${attachmentFilename}]\n${attachmentText}`]
      .filter(Boolean).join('\n\n')
  : latestUserText
```

For `streamText`, augment the last user message in model messages with attachment text. The `convertToModelMessages(messages)` returns `ModelMessage[]`. Augment:
```typescript
let modelMessages = await convertToModelMessages(messages)
if (attachmentText) {
  const lastUserIdx = modelMessages.reduce((acc, msg, i) => msg.role === 'user' ? i : acc, -1)
  if (lastUserIdx !== -1) {
    const lastUser = modelMessages[lastUserIdx]
    const inject = `\n\n[Attached file: ${attachmentFilename}]\n${attachmentText}`
    modelMessages = [
      ...modelMessages.slice(0, lastUserIdx),
      {
        ...lastUser,
        content: typeof lastUser.content === 'string'
          ? lastUser.content + inject
          : [...(lastUser.content as { type: string; text: string }[]), { type: 'text', text: inject }],
      },
      ...modelMessages.slice(lastUserIdx + 1),
    ]
  }
}
```

Pass `latestUserEffective` (not `latestUserText`) to `extractAndPersistMemory` so the extraction model sees the resume content.

#### Step A5 — Update `components/session-memory-peek.tsx` transcript

The transcript query already fetches `content`. Add `attachment_filename` to the select and show the same chip in transcript messages (without remove button).

---

### Task B — UI consistency + homepage commit

**B1 — Consistent site header (wordmark top-left, same size/weight, all three pages):**

The chat page already has it in `reed-app.tsx`:
```tsx
<header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6">
  <span className="type-display-md text-[var(--text-primary)]">Reed</span>
  ...
</header>
```

For `app/page.tsx` (homepage): Add identical header bar at top. Remove the centered `<h1 className="type-display-xl">Reed</h1>` — the header handles the wordmark. Keep the nudge card + CTA below.

For `app/login/page.tsx`: Same header bar. Remove the centered `<h1>Reed</h1>` from inside the card area. Keep the tagline `<p>` and the card. Adjust layout from `items-center justify-center` to `flex-col` with header at top.

**B2 — Background/token audit:** No hard-coded white found. `body { background: var(--bg) }` covers everything. No `bg-white` anywhere. Clean.

**B3 — Homepage is already correct:** `app/page.tsx` already renders the real nudge card with seeded copy — not a description, the actual card. No choice to make here.

---

## 7. Critical Constraint

**`proxy.ts` is the middleware file** (Next.js 16). Never create `middleware.ts` in the project root — having both causes a fatal 500 on every route. The error message is: `"Both middleware file './middleware.ts' and proxy file './proxy.ts' are detected."`.

---

## 8. Supabase DB Access (migration blocker)

Cannot run DDL programmatically because:
- PostgREST (what `@supabase/supabase-js` uses) blocks DDL
- No DB password available (`.env.local` only has service role JWT, not PostgreSQL password)
- Management API (`api.supabase.com/v1/`) requires a personal access token (not service role key)
- Direct PostgreSQL connections fail (hostname doesn't resolve, likely paused or IPv6-only)
- Supabase CLI is installed (`npx supabase v2.107.0`) but not logged in

**User action required:** Run this in the Supabase dashboard SQL Editor before testing Task A:
```sql
alter table public.messages add column attachment_filename text;
alter table public.messages add column attachment_text text;
```

---

## 9. env.local Reference

```
NEXT_PUBLIC_SUPABASE_URL=https://nnkbcctbcpfsqruykipr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← server-only, never NEXT_PUBLIC_
ANTHROPIC_API_KEY=sk-ant-api03-...
DEMO_USER_PASSWORD=reed-demo-2024
```

Demo account: `maya@demo.reed` / `reed-demo-2024`

---

## 10. How to Verify When Done

1. `npx tsc --noEmit` → zero errors  
2. Select a `.txt` file → chip appears above input, input stays empty, typing still works  
3. Send the message → chip shows above sent message in chat, no raw text visible  
4. Ask a follow-up "do I have good Python skills?" → Reed answers using resume content  
5. Select a `.pdf` resume → same as txt flow  
6. All three pages (homepage, login, chat) have identical header bar with "Reed" top-left  
