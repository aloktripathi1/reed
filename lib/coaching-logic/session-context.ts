import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BehavioralSignal,
  Commitment,
  Database,
  Goal,
  Session,
} from '@/lib/types'

type SessionRow = Pick<Session, 'id' | 'started_at' | 'opened_with_nudge'>

export type OverdueCommitment = Commitment & {
  dueAt: string
  daysOverdue: number
}

export type SessionContext = {
  activeGoals: Goal[]
  behavioralSignals: BehavioralSignal[]
  recentSessions: SessionRow[]
  overdueCommitment: OverdueCommitment | null
  openCommitments: Commitment[]
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function inferDueDate(commitment: Commitment): Date | null {
  if (!commitment.target_timeframe) {
    return null
  }

  const timeframe = commitment.target_timeframe.trim().toLowerCase()
  const createdAt = new Date(commitment.created_at)
  const explicitDate = new Date(commitment.target_timeframe)

  if (!Number.isNaN(explicitDate.getTime())) {
    return explicitDate
  }

  if (timeframe === 'today') {
    return new Date(createdAt.getTime() + DAY_IN_MS)
  }

  if (timeframe === 'tomorrow') {
    return new Date(createdAt.getTime() + DAY_IN_MS * 2)
  }

  if (timeframe === 'this week') {
    return new Date(createdAt.getTime() + DAY_IN_MS * 7)
  }

  if (timeframe === 'next week') {
    return new Date(createdAt.getTime() + DAY_IN_MS * 14)
  }

  const dayMatch = timeframe.match(/in (\d+) days?/)
  if (dayMatch) {
    return new Date(createdAt.getTime() + Number(dayMatch[1]) * DAY_IN_MS)
  }

  const weekMatch = timeframe.match(/in (\d+) weeks?/)
  if (weekMatch) {
    return new Date(createdAt.getTime() + Number(weekMatch[1]) * DAY_IN_MS * 7)
  }

  return null
}

function getDaysOverdue(dueAt: Date, now: Date) {
  return Math.max(1, Math.floor((now.getTime() - dueAt.getTime()) / DAY_IN_MS))
}

export async function getSessionContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SessionContext> {
  const [goalsResult, signalsResult, commitmentsResult, sessionsResult] =
    await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false }),
      supabase
        .from('behavioral_signals')
        .select('*')
        .eq('user_id', userId)
        .order('last_observed_at', { ascending: false }),
      supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: true }),
      supabase
        .from('sessions')
        .select('id, started_at, opened_with_nudge')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(6),
    ])

  if (goalsResult.error) throw goalsResult.error
  if (signalsResult.error) throw signalsResult.error
  if (commitmentsResult.error) throw commitmentsResult.error
  if (sessionsResult.error) throw sessionsResult.error

  const now = new Date()

  const overdueCommitment =
    commitmentsResult.data
      .map((commitment) => {
        const dueAt = inferDueDate(commitment)
        if (!dueAt || dueAt.getTime() > now.getTime()) {
          return null
        }

        return {
          ...commitment,
          dueAt: dueAt.toISOString(),
          daysOverdue: getDaysOverdue(dueAt, now),
        } satisfies OverdueCommitment
      })
      .filter((value): value is OverdueCommitment => value !== null)[0] ?? null

  return {
    activeGoals: goalsResult.data,
    behavioralSignals: signalsResult.data,
    openCommitments: commitmentsResult.data,
    overdueCommitment,
    recentSessions: sessionsResult.data,
  }
}

export function buildMemorySummary(sessionContext: SessionContext) {
  const goals = sessionContext.activeGoals.length
    ? sessionContext.activeGoals
        .map((goal) => `- ${goal.title}${goal.description ? ` — ${goal.description}` : ''}`)
        .join('\n')
    : '- No active goals recorded yet.'

  const signals = sessionContext.behavioralSignals.length
    ? sessionContext.behavioralSignals
        .slice(0, 5)
        .map(
          (signal) =>
            `- ${signal.type}: ${signal.description} (seen ${signal.occurrence_count} time${signal.occurrence_count === 1 ? '' : 's'})`
        )
        .join('\n')
    : '- No behavioral signals recorded yet.'

  const commitments = sessionContext.openCommitments.length
    ? sessionContext.openCommitments
        .map(
          (commitment) =>
            `- ${commitment.description}${
              commitment.target_timeframe ? ` [timeframe: ${commitment.target_timeframe}]` : ''
            }`
        )
        .join('\n')
    : '- No open commitments recorded.'

  return `Active goals:\n${goals}\n\nBehavioral signals:\n${signals}\n\nOpen commitments:\n${commitments}`
}

export function buildLedgerReference(sessionContext: SessionContext) {
  const goals = sessionContext.activeGoals.length
    ? sessionContext.activeGoals
        .map(
          (goal) =>
            `- [${goal.id}] ${goal.title}${goal.description ? ` — ${goal.description}` : ''}`
        )
        .join('\n')
    : '- none'

  const signals = sessionContext.behavioralSignals.length
    ? sessionContext.behavioralSignals
        .map(
          (signal) =>
            `- [${signal.id}] ${signal.type}: ${signal.description} (count ${signal.occurrence_count})`
        )
        .join('\n')
    : '- none'

  const commitments = sessionContext.openCommitments.length
    ? sessionContext.openCommitments
        .map(
          (commitment) =>
            `- [${commitment.id}] ${commitment.description}${
              commitment.target_timeframe ? ` | timeframe ${commitment.target_timeframe}` : ''
            }`
        )
        .join('\n')
    : '- none'

  return `Goals:\n${goals}\n\nSignals:\n${signals}\n\nOpen commitments:\n${commitments}`
}

export function buildOpeningMessage(sessionContext: SessionContext) {
  const overdue = sessionContext.overdueCommitment

  if (overdue) {
    return `${overdue.daysOverdue} day${overdue.daysOverdue === 1 ? '' : 's'} ago you said you'd ${
      overdue.description
    }${overdue.target_timeframe ? ` by ${overdue.target_timeframe}` : ''}. You haven't closed that loop yet. What happened?`
  }

  return 'What are we working on?'
}
