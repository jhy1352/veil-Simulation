import { TurnLatencyMetrics } from '../types';

/**
 * Latency Profiler utility for measuring and logging turn lifecycle checkpoints:
 * T0: Player Input
 * T1: Request Start
 * T2: Context Assembly Complete
 * T3: Gemini Request Start
 * T4: Gemini Response Received
 * T5: Parser Complete
 * T6: State Mutation / Validation Complete
 * T7: UI Update Complete
 */
export class TurnLatencyProfiler {
  private turn: number;
  private model: string;
  private t0: number; // Player Input
  private t1?: number; // Request Start
  private t2?: number; // Context Assembly Complete
  private t3?: number; // Gemini Request Start
  private t4?: number; // Gemini Response Received
  private t5?: number; // Parser Complete
  private t6?: number; // State Mutation Complete
  private t7?: number; // UI Update Complete

  private inputCharCount: number = 0;
  private outputCharCount: number = 0;

  constructor(turn: number, model: string = 'gemini-3.7-flash') {
    this.turn = turn;
    this.model = model;
    this.t0 = performance.now();
  }

  public markRequestStart(inputChars: number = 0) {
    this.t1 = performance.now();
    this.inputCharCount = inputChars;
  }

  public markContextAssemblyComplete() {
    this.t2 = performance.now();
  }

  public markGeminiRequestStart() {
    this.t3 = performance.now();
  }

  public markGeminiResponseReceived(outputChars: number = 0) {
    this.t4 = performance.now();
    this.outputCharCount = outputChars;
  }

  public markParserComplete() {
    this.t5 = performance.now();
  }

  public markStateMutationComplete() {
    this.t6 = performance.now();
  }

  public markUIUpdateComplete(): TurnLatencyMetrics {
    this.t7 = performance.now();
    return this.getReport();
  }

  public getReport(): TurnLatencyMetrics {
    const now = this.t7 || performance.now();
    const t0 = this.t0;
    const t1 = this.t1 || t0;
    const t2 = this.t2 || t1;
    const t3 = this.t3 || t2;
    const t4 = this.t4 || t3;
    const t5 = this.t5 || t4;
    const t6 = this.t6 || t5;
    const t7 = this.t7 || now;

    const contextAssemblyMs = Math.max(0, Math.round(t2 - t1));
    const geminiGenerationMs = Math.max(0, Math.round(t4 - t3));
    const parsingValidationMs = Math.max(0, Math.round(t6 - t4));
    const totalTurnMs = Math.max(0, Math.round(t7 - t0));

    const metrics: TurnLatencyMetrics = {
      turn: this.turn,
      model: this.model,
      t0_playerInput: t0,
      t1_requestStart: t1,
      t2_contextAssemblyComplete: t2,
      t3_geminiRequestStart: t3,
      t4_geminiResponseReceived: t4,
      t5_parserComplete: t5,
      t6_stateMutationComplete: t6,
      t7_uiUpdateComplete: t7,
      contextAssemblyMs,
      geminiGenerationMs,
      parsingValidationMs,
      totalTurnMs,
      inputCharCount: this.inputCharCount,
      outputCharCount: this.outputCharCount,
      retried: false
    };

    console.info(`[Turn ${this.turn} Latency Telemetry]`, {
      total: `${totalTurnMs}ms`,
      contextAssembly: `${contextAssemblyMs}ms`,
      geminiGeneration: `${geminiGenerationMs}ms`,
      validationState: `${parsingValidationMs}ms`,
      model: this.model,
      chars: `in:${this.inputCharCount}/out:${this.outputCharCount}`
    });

    return metrics;
  }
}
