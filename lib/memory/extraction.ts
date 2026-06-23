import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { EXTRACTION_MODEL } from '@/lib/chat/models'
import {
  buildLedgerReference,
  type SessionContext,
} from '@/lib/coaching-logic/session-context'
import { createAdminClient } from '@/lib/supabase/admin'

const extractionSchema = z.object({
  goalsToCreate: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
      })
    )
    .default([]),
  signalsToUpsert: z
    .array(
      z.object({
        type: z.enum(['doubt', 'undervalued_strength', 'avoidance_pattern', 'other']),
        description: z.string().min(1),
        reinforcesExistingSignalId: z.string().uuid().nullable().optional(),
        relatedGoalId: z.string().uuid().nullable().optional(),
      })
    )
    .default([]),
  commitmentsToCreate: z
    .array(
      z.object({
        description: z.string().min(1),
        targetTimeframe: z.string().nullable().optional(),
      })
    )
    .default([]),
  commitmentsToUpdate: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['fulfilled', 'acknowledged_not_done', 'expired']),
      })
    )
    .default([]),
})

type ExtractionResult = z.infer<typeof extractionSchema>

async function runExtractionModel({
  assistantMessage,
  latestUserMessage,
  sessionContext,
}: {
  assistantMessage: string
  latestUserMessage: string
  sessionContext: SessionContext
}) {
  const { object } = await generateObject({
    model: anthropic(EXTRACTION_MODEL),
    schema: extractionSchema,
    system: `You extract structured career-coaching memory updates from a single user/assistant exchange.

Only return durable facts that are useful in future coaching.
Do not create duplicate rows when the user is just repeating an existing theme.
When an existing signal or commitment should be updated, use its exact id from the ledger reference.
Never invent ids.
If nothing should change in a category, return an empty array.

Current ledger reference:
${buildLedgerReference(sessionContext)}`,
    prompt: `Latest user message:
${latestUserMessage}

Assistant reply:
${assistantMessage}`,
  })

  return object
}

async function persistExtraction({
  extraction,
  userId,
}: {
  extraction: ExtractionResult
  userId: string
}) {
  const admin = createAdminClient()

  if (extraction.goalsToCreate.length > 0) {
    const { error } = await admin.from('goals').insert(
      extraction.goalsToCreate.map((goal) => ({
        user_id: userId,
        title: goal.title,
        description: goal.description ?? null,
      }))
    )

    if (error) throw error
  }

  for (const signal of extraction.signalsToUpsert) {
    if (signal.reinforcesExistingSignalId) {
      const { data: existingSignal, error: fetchError } = await admin
        .from('behavioral_signals')
        .select('occurrence_count')
        .eq('id', signal.reinforcesExistingSignalId)
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (existingSignal) {
        const { error: updateError } = await admin
          .from('behavioral_signals')
          .update({
            last_observed_at: new Date().toISOString(),
            occurrence_count: existingSignal.occurrence_count + 1,
          })
          .eq('id', signal.reinforcesExistingSignalId)
          .eq('user_id', userId)

        if (updateError) throw updateError
        continue
      }
    }

    const { error } = await admin.from('behavioral_signals').insert({
      user_id: userId,
      type: signal.type,
      description: signal.description,
      related_goal_id: signal.relatedGoalId ?? null,
    })

    if (error) throw error
  }

  if (extraction.commitmentsToCreate.length > 0) {
    const { error } = await admin.from('commitments').insert(
      extraction.commitmentsToCreate.map((commitment) => ({
        user_id: userId,
        description: commitment.description,
        target_timeframe: commitment.targetTimeframe ?? null,
      }))
    )

    if (error) throw error
  }

  for (const commitment of extraction.commitmentsToUpdate) {
    const { error } = await admin
      .from('commitments')
      .update({
        status: commitment.status,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', commitment.id)
      .eq('user_id', userId)

    if (error) throw error
  }
}

export async function extractAndPersistMemory({
  assistantMessage,
  latestUserMessage,
  sessionContext,
  userId,
}: {
  assistantMessage: string
  latestUserMessage: string
  sessionContext: SessionContext
  userId: string
}) {
  if (!assistantMessage.trim() || !latestUserMessage.trim()) {
    return
  }

  const extraction = await runExtractionModel({
    assistantMessage,
    latestUserMessage,
    sessionContext,
  })

  await persistExtraction({ extraction, userId })
}
