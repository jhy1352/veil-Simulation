/**
 * TRPG 3.1 Sovereign Forensic RAW Collector
 * 
 * Strict Read-Only Runtime Collector for Forensic Preservation.
 * Zero-Mutation, Non-Interfering Observer Pattern.
 */

export const FORENSIC_RAW_STORAGE_KEY = 'TRPG_FORENSIC_RAW_ENABLED_V1';

export function isForensicRawEnabled(): boolean {
  try {
    const val = localStorage.getItem(FORENSIC_RAW_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export function setForensicRawEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FORENSIC_RAW_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save FORENSIC RAW setting to localStorage:', e);
  }
}

let activeRunId: string | null = null;
let activeRunWorldName: string | null = null;

export function getOrInitRunId(worldName: string): string {
  const sanitized = sanitizeWorldName(worldName);
  if (!activeRunId || activeRunWorldName !== sanitized) {
    activeRunWorldName = sanitized;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    activeRunId = `run_${timestamp}_${rand}`;
  }
  return activeRunId;
}

export function resetRunId(): void {
  activeRunId = null;
  activeRunWorldName = null;
}

export function sanitizeWorldName(name: string): string {
  if (!name) return 'default_world';
  // Strip forbidden path characters: / \ : * ? " < > | and control chars
  const sanitized = name
    .replace(/[/\\:*?"<>|\x00-\x1F\x7F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  return sanitized || 'default_world';
}

export interface ForensicTurnPacket {
  runId: string;
  worldName: string;
  turn: number;
  timestamp: string;
  gitCommit?: string;
  playerInput: {
    rawInput: string;
    originInputId?: string;
  };
  modelRuntime: {
    requestedModel: string;
    actualModelVersion?: string;
    responseId?: string;
    serverTimings?: any;
    clientLatency?: any;
  };
  chatContextForensic?: any;
  geminiContentsForensic?: any;
  llmRawResponse?: {
    phase1RawText?: string;
    phase2RawText?: string;
    rawResponseText?: string;
  };
  candidatePipeline: {
    rawCandidatesBlock?: any;
    parsedCandidates?: any;
    recoveryGateResult?: any;
    meaningTrees?: any[];
    candidatesToValidate?: any[];
  };
  preAuth: {
    preAuthResults?: any[];
    allowedCandidatesCount?: number;
    rejectedReasons?: string[];
  };
  authorization: {
    authorizedCandidateId?: number | null;
    authorizedCandidate?: any;
    authorizedCandidatePacket?: any;
    authorizedProposal?: any;
    isFallbackNonMutation?: boolean;
  };
  commit: {
    verdict: string;
    rejectedReasons: string[];
    committedRecordIds: string[];
    commitResultSummary?: any;
    committedActionsCount?: number;
    resultingStateVersion?: number;
  };
  stateBefore: {
    turn: number;
    canonicalState: {
      worldInfo: any;
      character: any;
    };
    engineState: {
      historicalRecordsCount: number;
      diagnostics?: any;
    };
    inventory: any[];
  };
  stateAfter: {
    turn: number;
    canonicalState: {
      worldInfo: any;
      character: any;
    };
    engineState: {
      historicalRecordsCount: number;
      diagnostics?: any;
    };
    inventory: any[];
  };
  historyDelta: any[];
  pipelineSteps: any[];
}

/**
 * Dispatches the raw turn packet to the server's development forensic RAW endpoint.
 * Completely non-blocking and silent fail-safe (observer only).
 */
export async function dispatchForensicRawCapture(packet: ForensicTurnPacket): Promise<{ success: boolean; file?: string; sha256?: string }> {
  try {
    const res = await fetch('/api/dev/forensic-raw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        runId: packet.runId,
        worldName: packet.worldName,
        turn: packet.turn,
        rawPayload: packet
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[FORENSIC RAW] Capture warning from server:', err);
      return { success: false };
    }

    const data = await res.json();
    console.log(`[FORENSIC RAW] Saved turn ${packet.turn} raw -> ${data.file} (SHA256: ${data.sha256?.slice(0, 12)}...)`);
    return data;
  } catch (err) {
    console.warn('[FORENSIC RAW] Dispatch error (observer safe ignored):', err);
    return { success: false };
  }
}
