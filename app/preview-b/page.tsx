import Link from 'next/link'

/* Direction B — the differentiator line itself as the hero, set in Fraunces */
export default function HomepageB() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-8 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="type-label mb-8 text-[var(--text-secondary)]">Reed</p>

        <h1 className="type-display-xl mb-10 text-[var(--text-primary)]" style={{ fontSize: '40px', lineHeight: 1.15 }}>
          Reed remembers who you&apos;re becoming,
          <br />
          not just what you sent.
        </h1>

        <p className="type-body mb-12 mx-auto max-w-sm text-[var(--text-secondary)]">
          An AI mentor that holds a persistent model of your career — your goals, doubts, and
          commitments — and resurfaces what you haven&apos;t yet resolved.
        </p>

        <Link
          className="inline-block rounded-xl bg-[var(--text-primary)] px-8 py-3 type-body-sm font-semibold text-[var(--surface)] transition hover:opacity-80 outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          href="/login"
        >
          Log in
        </Link>
      </div>
    </main>
  )
}
