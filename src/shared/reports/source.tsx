/**
 * Where report numbers come from (REPORT-TOOL-SPEC §6).
 *
 *   live    : drafts ask getMetric, so they show current data.
 *   record  : finalising renders the report once while recording every answer.
 *   replay  : final reports answer from that recording only, so they never change, even if
 *             the underlying data is corrected later.
 *
 * Blocks and text placeholders call `useAsk()`; they don't know which mode they're in.
 */
import React, { createContext, useContext } from 'react'
import { MetricAccessError, MetricPolicyError, getMetric } from './metrics'
import type { MetricRequest, MetricResult, Viewer } from './types'

export type Ask = (req: MetricRequest) => MetricResult

/** A recorded answer: the result, or the refusal message (refusals are frozen too). */
export type Recorded = { result: MetricResult } | { error: string; kind: 'access' | 'policy' }

/** Stable key for a request, so a replay finds exactly the answer that was recorded. */
export function requestKey(r: MetricRequest): string {
  const scope = {
    pillars: [...r.scope.pillars].sort(),
    interventions: [...r.scope.interventions].sort(),
    cohorts: [...r.scope.cohorts].sort(),
    filters: Object.fromEntries(
      Object.entries(r.scope.filters)
        .filter(([, v]) => v?.length)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, [...v!].sort()]),
    ),
  }
  return JSON.stringify([r.code, scope, r.period.start, r.period.end, r.dateRule, r.breakdown ?? null, r.comparison ?? 'none', r.audience])
}

/** Thrown when a final report asks for a number that wasn't frozen (should never happen). */
export class NotInSnapshotError extends Error {
  constructor() {
    super('This number isn’t part of the finalised version.')
    this.name = 'NotInSnapshotError'
  }
}

const throwRecorded = (rec: Recorded): never => {
  if ('result' in rec) throw new Error('unreachable')
  throw rec.kind === 'access' ? new MetricAccessError(rec.error) : new MetricPolicyError(rec.error)
}

export const liveSource = (viewer: Viewer): Ask => (req) => getMetric(viewer, req)

/** Live answers, with every answer (and refusal) written into `into`. */
export function recordingSource(viewer: Viewer, into: Record<string, Recorded>): Ask {
  return (req) => {
    const key = requestKey(req)
    try {
      const result = getMetric(viewer, req)
      // Deep copy: later changes to anything live can't reach the frozen answer.
      into[key] = { result: structuredClone(result) }
      return result
    } catch (e) {
      if (e instanceof MetricAccessError) into[key] = { error: e.message, kind: 'access' }
      else if (e instanceof MetricPolicyError) into[key] = { error: e.message, kind: 'policy' }
      throw e
    }
  }
}

/** Answers only from a recording. */
export function replaySource(recorded: Record<string, Recorded>): Ask {
  return (req) => {
    const rec = recorded[requestKey(req)]
    if (!rec) throw new NotInSnapshotError()
    if ('error' in rec) throwRecorded(rec)
    return structuredClone((rec as { result: MetricResult }).result)
  }
}

const Ctx = createContext<Ask | null>(null)

export function MetricSource({ ask, children }: { ask: Ask; children: React.ReactNode }) {
  return <Ctx.Provider value={ask}>{children}</Ctx.Provider>
}

/** The current source; falls back to live answers for the given viewer. */
export function useAsk(viewer: Viewer): Ask {
  return useContext(Ctx) ?? liveSource(viewer)
}
