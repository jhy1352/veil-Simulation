/**
 * Non-mutating Candidate Lifecycle Collector
 * Tracks Stage 0~5 Candidate Dispositions and validates Pipeline Invariants.
 */

export type PipelineStage =
  | 'STAGE_0_EXTRACTION'
  | 'STAGE_1_RECOVERY_GATE'
  | 'STAGE_2_SEMANTIC_TRANSLATION'
  | 'STAGE_3_DIVERSITY_GATE'
  | 'STAGE_4_ENGINE_PREAUTH'
  | 'STAGE_5_COMMIT_GATE';

export type CandidateStageStatus = 'PASS' | 'REJECT' | 'QUARANTINED' | 'NOT_REACHED' | 'NOT_SELECTED' | 'COMMITTED';

export const PIPELINE_STAGES: PipelineStage[] = [
  'STAGE_0_EXTRACTION',
  'STAGE_1_RECOVERY_GATE',
  'STAGE_2_SEMANTIC_TRANSLATION',
  'STAGE_3_DIVERSITY_GATE',
  'STAGE_4_ENGINE_PREAUTH',
  'STAGE_5_COMMIT_GATE'
];

export interface StageDisposition {
  stage: PipelineStage;
  status: CandidateStageStatus;
  reason?: string;
  timestamp: string;
}

export interface CandidateLifecycleTrace {
  candidateKey: string; // `${requestId}_${candidateId}`
  requestId: string;
  candidateId: number;
  label: string;
  stages: Record<PipelineStage, StageDisposition>;
  finalDisposition: CandidateStageStatus;
  terminalStage: PipelineStage;
}

export interface InvariantValidationResult {
  valid: boolean;
  violations: string[];
}

export interface TelemetryReport {
  requestId: string;
  turn: number;
  blockExtraction: {
    extracted: boolean; // Triage block unit (binary: true/false)
    rawBlockLength: number;
  };
  rawCandidateCount: number; // Candidate item unit (N >= 0)
  candidates: CandidateLifecycleTrace[];
  invariants: InvariantValidationResult;
  matrix: Record<PipelineStage, Record<CandidateStageStatus, number>>;
}

export class CandidateLifecycleCollector {
  private requestId: string;
  private turn: number;
  private blockExtracted: boolean = false;
  private rawBlockLength: number = 0;
  private expectedUpstreamCandidateCount: number = 0;
  private tracesMap = new Map<number, CandidateLifecycleTrace>();

  constructor(requestId: string, turn: number) {
    this.requestId = requestId;
    this.turn = turn;
  }

  public initExtraction(rawCandidatesBlockText: string | null, expectedUpstreamCount: number = 0): void {
    this.blockExtracted = Boolean(rawCandidatesBlockText);
    this.rawBlockLength = rawCandidatesBlockText ? rawCandidatesBlockText.length : 0;
    if (expectedUpstreamCount > 0) {
      this.expectedUpstreamCandidateCount = expectedUpstreamCount;
    }
  }

  private getOrCreateTrace(candidateId: number, label?: string): CandidateLifecycleTrace {
    let trace = this.tracesMap.get(candidateId);
    if (!trace) {
      const emptyStages = {} as Record<PipelineStage, StageDisposition>;
      const now = new Date().toISOString();
      for (const st of PIPELINE_STAGES) {
        emptyStages[st] = {
          stage: st,
          status: 'NOT_REACHED',
          timestamp: now
        };
      }
      trace = {
        candidateKey: `${this.requestId}_${candidateId}`,
        requestId: this.requestId,
        candidateId,
        label: label || `Candidate ${candidateId}`,
        stages: emptyStages,
        finalDisposition: 'NOT_REACHED',
        terminalStage: 'STAGE_0_EXTRACTION'
      };
      this.tracesMap.set(candidateId, trace);
    }
    if (label && trace.label === `Candidate ${candidateId}`) {
      trace.label = label;
    }
    return trace;
  }

  public recordStage0And1(recoveryGateResult: {
    totalInputCount: number;
    passedCandidates: Array<{ candidateId: number; label?: string }>;
    quarantinedCandidates: Array<any>;
  }): void {
    const now = new Date().toISOString();
    this.expectedUpstreamCandidateCount = recoveryGateResult.totalInputCount;

    // Register passed candidates
    for (const c of recoveryGateResult.passedCandidates) {
      const trace = this.getOrCreateTrace(c.candidateId, c.label);
      trace.stages.STAGE_0_EXTRACTION = {
        stage: 'STAGE_0_EXTRACTION',
        status: 'PASS',
        timestamp: now
      };
      trace.stages.STAGE_1_RECOVERY_GATE = {
        stage: 'STAGE_1_RECOVERY_GATE',
        status: 'PASS',
        timestamp: now
      };
      trace.finalDisposition = 'PASS';
      trace.terminalStage = 'STAGE_1_RECOVERY_GATE';
    }

    // Register quarantined candidates
    let quarantineIndex = 900;
    for (const q of recoveryGateResult.quarantinedCandidates) {
      const cid = typeof q?.candidate?.candidateId === 'number'
        ? q.candidate.candidateId
        : (typeof q?.candidateId === 'number' ? q.candidateId : ++quarantineIndex);
      const label = q?.candidate?.label || q?.label || `Corrupted Candidate ${cid}`;
      const reasons = Array.isArray(q?.reasons) ? q.reasons.join('; ') : (q?.error || 'CORRUPTED_CANDIDATE_STRUCTURE');

      const trace = this.getOrCreateTrace(cid, label);
      trace.stages.STAGE_0_EXTRACTION = {
        stage: 'STAGE_0_EXTRACTION',
        status: 'PASS',
        timestamp: now
      };
      trace.stages.STAGE_1_RECOVERY_GATE = {
        stage: 'STAGE_1_RECOVERY_GATE',
        status: 'QUARANTINED',
        reason: reasons,
        timestamp: now
      };
      trace.finalDisposition = 'QUARANTINED';
      trace.terminalStage = 'STAGE_1_RECOVERY_GATE';
    }
  }

  public recordStage2SemanticTranslation(translationResults: Array<{
    candidate: { candidateId: number; label?: string };
    status: string;
    errors?: ReadonlyArray<string> | string[];
  }>): void {
    const now = new Date().toISOString();
    for (const tr of translationResults) {
      const cid = tr.candidate.candidateId;
      const trace = this.getOrCreateTrace(cid, tr.candidate.label);

      if (trace.stages.STAGE_1_RECOVERY_GATE.status === 'PASS') {
        if (tr.status === 'COMPILED') {
          trace.stages.STAGE_2_SEMANTIC_TRANSLATION = {
            stage: 'STAGE_2_SEMANTIC_TRANSLATION',
            status: 'PASS',
            timestamp: now
          };
          trace.finalDisposition = 'PASS';
          trace.terminalStage = 'STAGE_2_SEMANTIC_TRANSLATION';
        } else {
          trace.stages.STAGE_2_SEMANTIC_TRANSLATION = {
            stage: 'STAGE_2_SEMANTIC_TRANSLATION',
            status: 'REJECT',
            reason: tr.errors && tr.errors.length > 0 ? Array.from(tr.errors).join('; ') : `COMPILATION_FAILED_${tr.status}`,
            timestamp: now
          };
          trace.finalDisposition = 'REJECT';
          trace.terminalStage = 'STAGE_2_SEMANTIC_TRANSLATION';
        }
      }
    }
  }

  public recordStage3DiversityGate(candidatesToValidate: Array<{ candidate: { candidateId: number } }>): void {
    const now = new Date().toISOString();
    const validatedIds = new Set(candidatesToValidate.map(c => c.candidate.candidateId));

    for (const trace of this.tracesMap.values()) {
      if (trace.stages.STAGE_2_SEMANTIC_TRANSLATION.status === 'PASS') {
        if (validatedIds.has(trace.candidateId)) {
          trace.stages.STAGE_3_DIVERSITY_GATE = {
            stage: 'STAGE_3_DIVERSITY_GATE',
            status: 'PASS',
            timestamp: now
          };
          trace.finalDisposition = 'PASS';
          trace.terminalStage = 'STAGE_3_DIVERSITY_GATE';
        } else {
          trace.stages.STAGE_3_DIVERSITY_GATE = {
            stage: 'STAGE_3_DIVERSITY_GATE',
            status: 'REJECT',
            reason: 'DIVERSITY_FILTERED_DUPLICATE_MEANING_TREE',
            timestamp: now
          };
          trace.finalDisposition = 'REJECT';
          trace.terminalStage = 'STAGE_3_DIVERSITY_GATE';
        }
      }
    }
  }

  public recordStage4PreAuth(preAuthResults: Array<{
    candidateId: number;
    preAuthStatus?: 'ALLOW' | 'REJECT' | string;
    preAuthReasons?: string[];
  }>): void {
    const now = new Date().toISOString();
    const resultMap = new Map(preAuthResults.map(p => [p.candidateId, p]));

    for (const trace of this.tracesMap.values()) {
      if (trace.stages.STAGE_3_DIVERSITY_GATE.status === 'PASS') {
        const res = resultMap.get(trace.candidateId);
        if (res && res.preAuthStatus === 'ALLOW') {
          trace.stages.STAGE_4_ENGINE_PREAUTH = {
            stage: 'STAGE_4_ENGINE_PREAUTH',
            status: 'PASS',
            timestamp: now
          };
          trace.finalDisposition = 'PASS';
          trace.terminalStage = 'STAGE_4_ENGINE_PREAUTH';
        } else if (res) {
          trace.stages.STAGE_4_ENGINE_PREAUTH = {
            stage: 'STAGE_4_ENGINE_PREAUTH',
            status: 'REJECT',
            reason: res.preAuthReasons && res.preAuthReasons.length > 0 ? res.preAuthReasons.join('; ') : 'PREAUTH_DENY',
            timestamp: now
          };
          trace.finalDisposition = 'REJECT';
          trace.terminalStage = 'STAGE_4_ENGINE_PREAUTH';
        } else {
          // PreAuth was not executed for this candidate: keep as NOT_REACHED
          trace.stages.STAGE_4_ENGINE_PREAUTH = {
            stage: 'STAGE_4_ENGINE_PREAUTH',
            status: 'NOT_REACHED',
            reason: 'PREAUTH_NOT_EXECUTED',
            timestamp: now
          };
          trace.finalDisposition = 'PASS';
          trace.terminalStage = 'STAGE_3_DIVERSITY_GATE';
        }
      }
    }
  }

  public recordStage5Commit(selectedCandidateId: number | null, isCommitted: boolean): void {
    const now = new Date().toISOString();

    for (const trace of this.tracesMap.values()) {
      if (trace.stages.STAGE_4_ENGINE_PREAUTH.status === 'PASS') {
        if (trace.candidateId === selectedCandidateId) {
          if (isCommitted) {
            trace.stages.STAGE_5_COMMIT_GATE = {
              stage: 'STAGE_5_COMMIT_GATE',
              status: 'COMMITTED',
              timestamp: now
            };
            trace.finalDisposition = 'COMMITTED';
            trace.terminalStage = 'STAGE_5_COMMIT_GATE';
          } else {
            trace.stages.STAGE_5_COMMIT_GATE = {
              stage: 'STAGE_5_COMMIT_GATE',
              status: 'NOT_REACHED',
              reason: 'COMMIT_NOT_EXECUTED',
              timestamp: now
            };
            trace.finalDisposition = 'PASS';
            trace.terminalStage = 'STAGE_4_ENGINE_PREAUTH';
          }
        } else {
          trace.stages.STAGE_5_COMMIT_GATE = {
            stage: 'STAGE_5_COMMIT_GATE',
            status: 'NOT_SELECTED',
            reason: 'NOT_SELECTED_BY_PHASE2',
            timestamp: now
          };
          trace.finalDisposition = 'NOT_SELECTED';
          trace.terminalStage = 'STAGE_5_COMMIT_GATE';
        }
      }
    }
  }

  public generateReport(): TelemetryReport {
    const candidatesList = Array.from(this.tracesMap.values()).sort((a, b) => a.candidateId - b.candidateId);
    const rawCandidateCount = this.expectedUpstreamCandidateCount > 0
      ? this.expectedUpstreamCandidateCount
      : candidatesList.length;

    // Initialize matrix
    const matrix = {} as Record<PipelineStage, Record<CandidateStageStatus, number>>;
    for (const st of PIPELINE_STAGES) {
      matrix[st] = { PASS: 0, REJECT: 0, QUARANTINED: 0, NOT_REACHED: 0, NOT_SELECTED: 0, COMMITTED: 0 };
    }

    // Populate matrix
    for (const trace of candidatesList) {
      for (const st of PIPELINE_STAGES) {
        const status = trace.stages[st].status;
        matrix[st][status] = (matrix[st][status] || 0) + 1;
      }
    }

    // Validate 4 Invariants
    const violations: string[] = [];

    // Invariant 0 (Candidate Cardinality): Upstream expected count == Collector trace count
    if (this.expectedUpstreamCandidateCount > 0 && candidatesList.length !== this.expectedUpstreamCandidateCount) {
      violations.push(
        `Invariant 0 (Candidate Cardinality Violation): expected upstream count (${this.expectedUpstreamCandidateCount}) !== lifecycle traces count (${candidatesList.length})`
      );
    }

    // Invariant 1: Sum of states per stage == total candidate count
    for (const st of PIPELINE_STAGES) {
      const sum = matrix[st].PASS + matrix[st].REJECT + matrix[st].QUARANTINED + matrix[st].NOT_REACHED + matrix[st].NOT_SELECTED + matrix[st].COMMITTED;
      if (sum !== rawCandidateCount) {
        violations.push(`Invariant 1 Violation at ${st}: sum of statuses (${sum}) !== rawCandidateCount (${rawCandidateCount})`);
      }
    }

    // Invariant 2: Only previous stage PASS can be evaluated in next stage (must not be NOT_REACHED)
    for (let i = 1; i < PIPELINE_STAGES.length; i++) {
      const prevStage = PIPELINE_STAGES[i - 1];
      const currStage = PIPELINE_STAGES[i];

      for (const trace of candidatesList) {
        const prevStatus = trace.stages[prevStage].status;
        const currStatus = trace.stages[currStage].status;

        if (prevStatus !== 'PASS') {
          if (currStatus !== 'NOT_REACHED') {
            violations.push(
              `Invariant 2/3 Violation for Candidate ${trace.candidateId} at ${currStage}: evaluated as '${currStatus}' despite previous stage ${prevStage} status being '${prevStatus}'`
            );
          }
        }
      }
    }

    // Invariant 4: Total Candidates == COMMITTED + REJECT + QUARANTINED + NOT_SELECTED + PASS (uncommitted) + NOT_REACHED
    let terminalCount = 0;
    for (const trace of candidatesList) {
      if (['COMMITTED', 'REJECT', 'QUARANTINED', 'NOT_SELECTED', 'PASS', 'NOT_REACHED'].includes(trace.finalDisposition)) {
        terminalCount++;
      }
    }

    if (terminalCount !== rawCandidateCount) {
      violations.push(
        `Invariant 4 Violation: terminal disposition count (${terminalCount}) !== rawCandidateCount (${rawCandidateCount})`
      );
    }

    return {
      requestId: this.requestId,
      turn: this.turn,
      blockExtraction: {
        extracted: this.blockExtracted,
        rawBlockLength: this.rawBlockLength
      },
      rawCandidateCount,
      candidates: candidatesList,
      invariants: {
        valid: violations.length === 0,
        violations
      },
      matrix
    };
  }
}
