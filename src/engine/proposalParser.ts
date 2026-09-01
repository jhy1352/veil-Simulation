import { TransitionAction, StateTransitionProposal, ProposalSource, ActionType, CanonicalState, ImmutableHistoricalRecord } from './types';
import { CandidatePacket, HistoricalRecord, NpcRecord, NarrativeSeed, StatType, DEFAULT_NPC_CLASS, DEFAULT_CHAPTER_NAME } from '../types';
import { recoverAndParseProposalOrMeaningTree, recoverSyntaxAndParseJson } from './language/recovery';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from './language/adapter';
import { MeaningNode } from './language/types';

export interface SafeProposalEnvelope {
  requestId: string;
  eventId: string;
  expectedStateVersion: number;
  turn: number;
  timestamp?: string;
  source?: ProposalSource;
}

export interface ParsedGMResponse {
  cleanNarrative: string;
  intentSummary: string;
  untrustedActions: TransitionAction[];
  rawClaims: string[];
  parseError?: string;
  hasProposal: boolean;
  meaningTree?: MeaningNode;
}

function generateProposalId(prefix: string): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    window.crypto.getRandomValues(arr);
    return `${prefix}-${Date.now().toString(36)}-${arr[0].toString(36)}${arr[1].toString(36)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_ACTION_TYPES: Set<string> = new Set<ActionType>([
  'SET_WORLD_METADATA',
  'ADVANCE_TIME',
  'ADD_RUMOR',
  'ADD_NPC',
  'UPDATE_NPC',
  'SET_NPC_STATUS',
  'ADD_FACTION',
  'UPDATE_FACTION',
  'ADD_NARRATIVE_SEED',
  'RESOLVE_NARRATIVE_SEED',
  'ADVANCE_CHAPTER',
  'RECORD_OFFSCREEN_EVENT',
  'UPDATE_CHARACTER_STATS',
  'MODIFY_INVENTORY',
  'SET_CHARACTER_SECRET',
  'RECORD_PHYSICAL_DEFECT',
  'RECORD_DICE_RESULT',
  'OVERWRITE_WORLD_INFO',
  'OVERWRITE_CHARACTER'
]);

/**
 * Pure Proposal and Narrative Parser
 * Splits LLM output into clean prose narrative and untrusted structured transition actions.
 * Guarantees that narrative is NEVER lost even if JSON proposal is malformed.
 */
export function parseGMResponseAndProposal(rawResponse: string): ParsedGMResponse {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return {
      cleanNarrative: '',
      intentSummary: '',
      untrustedActions: [],
      rawClaims: [],
      hasProposal: false
    };
  }

  let cleanNarrative = rawResponse;
  let untrustedActions: TransitionAction[] = [];
  let intentSummary = '';
  const rawClaims: string[] = [];
  let parseError: string | undefined = undefined;
  let hasProposal = false;
  let parsedMeaningTree: MeaningNode | undefined = undefined;

  // 1. Extract and process ```proposal ... ``` or ```json ... ``` blocks
  const codeBlockRegex = /```(?:proposal|json|yaml|markdown|text)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(rawResponse)) !== null) {
    const blockContent = match[1].trim();

    // Check if block content looks like JSON, proposal block, or Meaning Tree
    if (blockContent.startsWith('{') || blockContent.includes('"actions"') || blockContent.includes('"intentSummary"') || blockContent.includes('"atom"')) {
      const recoveryResult = recoverAndParseProposalOrMeaningTree(blockContent);
      if (recoveryResult.success) {
        hasProposal = true;
        if (recoveryResult.intentSummary) {
          intentSummary = recoveryResult.intentSummary;
        }
        if (recoveryResult.meaningTree) {
          parsedMeaningTree = recoveryResult.meaningTree;
        }

        // Add recovered & grammar-verified actions
        for (const action of recoveryResult.proposalActions) {
          if (VALID_ACTION_TYPES.has(action.type)) {
            untrustedActions.push(action);
          } else {
            rawClaims.push(`Unknown action type proposed: ${action.type}`);
          }
        }

        // Add extracted claims
        for (const c of recoveryResult.rawClaims) {
          rawClaims.push(c);
        }

        // Check if raw JSON had un-demoted status assertions
        try {
          const rawObj = JSON.parse(blockContent.replace(/```[a-z]*\n?/g, ''));
          if (rawObj && typeof rawObj === 'object') {
            if (rawObj.verifiedClaims) {
              rawClaims.push(`[DEMOTED_CLAIM] ${JSON.stringify(rawObj.verifiedClaims)}`);
            }
            if (rawObj.status === 'VERIFIED' || rawObj.status === 'CANONICAL') {
              rawClaims.push(`[DEMOTED_STATUS] Untrusted status assertion: ${rawObj.status}`);
            }
          }
        } catch {
          // Ignored if raw string wasn't raw JSON
        }
      } else {
        parseError = `[PROPOSAL_RECOVERY_FAILED] ${recoveryResult.error || 'Failed syntax recovery & grammar verification'}`;
        hasProposal = true;
      }
    } else if (blockContent.includes('[') && blockContent.includes(']')) {
      // Markdown metadata block - store lines purely as raw narrative claims for diagnostic context
      // STRICT SOVEREIGN PRINCIPLE: NEVER synthesize or escalate natural language text into TransitionActions
      const lines = blockContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          rawClaims.push(trimmed);
        }
      }
    }
  }

  // 2. Remove all metadata/proposal code blocks from the raw narrative to produce clean prose for player
  cleanNarrative = rawResponse.replace(/```(?:proposal|json|yaml|markdown|text)?\s*[\s\S]*?```/g, '').trim();

  // If after stripping code blocks narrative is empty, fallback to rawResponse (safety guard)
  if (!cleanNarrative) {
    cleanNarrative = rawResponse.trim();
  }

  return {
    cleanNarrative,
    intentSummary: intentSummary || 'LLM Narrative Turn Actions',
    untrustedActions,
    rawClaims,
    parseError,
    hasProposal,
    meaningTree: parsedMeaningTree
  };
}

/**
 * Builds a safe, fully enveloped StateTransitionProposal combining trusted client metadata and untrusted LLM actions.
 * Enforces MeaningTree authority -> deterministic Runtime Projection -> actions[].
 */
export function buildSafeProposal(
  envelope: SafeProposalEnvelope,
  parsedResult: ParsedGMResponse
): StateTransitionProposal {
  let rootMeaningNode = parsedResult.meaningTree;
  if (!rootMeaningNode) {
    const children = (parsedResult.untrustedActions || []).map(act => actionToMeaningNode(act, 'PROPOSAL'));
    rootMeaningNode = {
      atom: 'INTENT',
      scope: 'PROPOSAL',
      value: parsedResult.intentSummary || 'LLM Narrative Turn Actions',
      children: children.length > 0 ? children : undefined
    };
  }

  const proposal = adaptMeaningTreeToProposal(rootMeaningNode, {
    proposalId: `prop-${envelope.requestId}`,
    requestId: envelope.requestId,
    eventId: envelope.eventId,
    expectedStateVersion: envelope.expectedStateVersion,
    source: envelope.source || 'LLM',
    turn: envelope.turn,
    timestamp: envelope.timestamp || new Date().toISOString(),
    intentSummary: parsedResult.intentSummary || 'LLM Narrative Turn Actions',
  });

  if (parsedResult.rawClaims && parsedResult.rawClaims.length > 0) {
    proposal.rawClaims = [...(proposal.rawClaims || []), ...parsedResult.rawClaims];
  }

  return proposal;
}

/**
 * Transforms an untrusted CandidatePacket into a strictly safe, validated StateTransitionProposal
 * ready for evaluation and atomic commit by SovereignEngine.
 *
 * Implements 8 Narrative Defense Rules:
 * Rule 1 — Blocks un-met NPC meta-knowledge (forces '[미인지 상태]').
 * Rule 2 — Caps active narrative seeds at 3.
 * Rule 3 — Deduplicates narrative seed contents.
 * Rule 4 — Preserves semantic integrity of narrative seed resolution (no fake summaries).
 * Rule 5 — Deduplicates camera offscreen events.
 * Rule 6 — Clamps target DC to 1-20 (no synthetic dice roll values).
 * Rule 7 — Caps upcoming chapters to maximum 3.
 * Rule 8 — Blocks resurrection or re-registration of canonically deceased NPCs.
 */
export function buildSafeProposalFromCandidate(
  currentSnapshot: CanonicalState,
  candidate: CandidatePacket,
  storyTurnCount: number,
  historicalRecords?: readonly (ImmutableHistoricalRecord | HistoricalRecord)[]
): StateTransitionProposal {
  const actions: TransitionAction[] = [];
  const eventId = generateProposalId('evt');
  const requestId = generateProposalId('req');
  const proposalId = `prop-${requestId}`;

  // Helper to check if an NPC is historically dead
  const isNpcHistoricallyDead = (name: string): boolean => {
    const trimmed = name.trim();
    // 1. Check current snapshot
    const snapNpc = currentSnapshot.worldInfo.npcs.find(n => n.name === trimmed || n.id === trimmed);
    if (snapNpc && snapNpc.status === 'DEAD') {
      return true;
    }
    // 2. Check historical records
    if (historicalRecords && historicalRecords.length > 0) {
      for (const rec of historicalRecords) {
        if ('involvedCharacterIds' in rec && Array.isArray((rec as any).involvedCharacterIds)) {
          const histRec = rec as HistoricalRecord;
          if (histRec.involvedCharacterIds.includes(trimmed)) {
            if (
              histRec.recordType === 'NPC_DECEASED' ||
              (histRec.payload && (histRec.payload.status === 'DEAD' || histRec.payload.isDead === true))
            ) {
              return true;
            }
          }
        } else if ('actionType' in rec) {
          const immRec = rec as ImmutableHistoricalRecord;
          if (immRec.actionType === 'SET_NPC_STATUS' && immRec.details.includes(trimmed) && immRec.details.includes('DEAD')) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // 1. NPC Changes (Rule 1 & Rule 8)
  if (Array.isArray(candidate.npcChanges)) {
    for (const npcCand of candidate.npcChanges) {
      if (!npcCand.name || typeof npcCand.name !== 'string' || !npcCand.name.trim()) {
        continue;
      }
      const npcName = npcCand.name.trim();

      // Rule 8: Historical Dead NPC Defense
      if (isNpcHistoricallyDead(npcName)) {
        continue; // Block resurrection/re-registration of deceased NPC
      }

      const existingNpc = currentSnapshot.worldInfo.npcs.find(
        n => n.name === npcName || n.id === npcName
      );

      // Rule 1: 미인지 NPC 메타지식 차단
      const isMet = npcCand.metInStory ?? (existingNpc ? existingNpc.metInStory : false);
      const safeInnerThought = isMet
        ? (npcCand.innerThought?.trim() || (existingNpc ? existingNpc.innerThought : '미상'))
        : '[미인지 상태]';

      if (existingNpc) {
        if (npcCand.isDead) {
          actions.push({
            type: 'SET_NPC_STATUS',
            payload: {
              id: existingNpc.id,
              status: 'DEAD',
              reason: 'LLM Candidate Turn Report'
            }
          });
        } else {
          actions.push({
            type: 'UPDATE_NPC',
            payload: {
              id: existingNpc.id,
              changes: {
                ...(npcCand.alias !== undefined && { alias: npcCand.alias.trim() }),
                ...(npcCand.npcClass !== undefined && { npcClass: npcCand.npcClass }),
                innerThought: safeInnerThought,
                ...(isMet !== undefined && { metInStory: isMet }),
                ...(npcCand.origin !== undefined && { origin: npcCand.origin.trim() }),
                ...(npcCand.background !== undefined && { background: npcCand.background.trim() }),
                ...(npcCand.martialArts !== undefined && { martialArts: npcCand.martialArts.trim() }),
                ...(npcCand.values !== undefined && { values: npcCand.values.trim() }),
                ...(npcCand.affiliation !== undefined && { affiliation: npcCand.affiliation.trim() })
              }
            }
          });
        }
      } else {
        // New NPC Registration
        actions.push({
          type: 'ADD_NPC',
          payload: {
            id: generateProposalId('npc'),
            name: npcName,
            alias: npcCand.alias?.trim() || '',
            npcClass: npcCand.npcClass || DEFAULT_NPC_CLASS,
            innerThought: safeInnerThought,
            impression: isMet ? undefined : '[미인지 상태]',
            metInStory: isMet,
            status: npcCand.isDead ? 'DEAD' : (isMet ? 'ALIVE' : 'UNMET'),
            origin: npcCand.origin?.trim() || '',
            background: npcCand.background?.trim() || '',
            martialArts: npcCand.martialArts?.trim() || '',
            values: npcCand.values?.trim() || '',
            affiliation: npcCand.affiliation?.trim() || ''
          }
        });
      }
    }
  }

  // 2. Narrative Seeds (Rule 2, Rule 3, Rule 4)
  if (Array.isArray(candidate.seedChanges)) {
    const currentActiveSeeds = currentSnapshot.worldInfo.seeds.filter(s => s.status === 'active');
    let availableSlots = Math.max(0, 3 - currentActiveSeeds.length);
    const seenSeedContents = new Set<string>(
      currentSnapshot.worldInfo.seeds.map(s => s.content.trim())
    );

    for (const seed of candidate.seedChanges) {
      if (!seed.content || typeof seed.content !== 'string' || !seed.content.trim()) {
        continue;
      }
      const trimmedContent = seed.content.trim();

      // Rule 4: RESOLVE_NARRATIVE_SEED
      if (seed.status === 'resolved' || seed.action === 'resolve') {
        const matchingSeed = currentSnapshot.worldInfo.seeds.find(
          s => s.content.trim() === trimmedContent || s.id === trimmedContent
        );
        if (matchingSeed && matchingSeed.status === 'active') {
          const resolutionInfo = (seed as any).resolutionSummary;
          if (typeof resolutionInfo === 'string' && resolutionInfo.trim()) {
            actions.push({
              type: 'RESOLVE_NARRATIVE_SEED',
              payload: {
                id: matchingSeed.id,
                resolutionSummary: resolutionInfo.trim()
              }
            });
          }
        }
      } else {
        // Active Narrative Seed
        // Rule 2: Max 3 active seeds limit
        if (availableSlots <= 0) {
          continue;
        }
        // Rule 3: Deduplication
        if (seenSeedContents.has(trimmedContent)) {
          continue;
        }

        seenSeedContents.add(trimmedContent);
        availableSlots--;

        actions.push({
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: generateProposalId('seed'),
            content: trimmedContent,
            status: 'active',
            turnCreated: storyTurnCount
          }
        });
      }
    }
  }

  // 3. Offscreen Events (Rule 5)
  if (Array.isArray(candidate.offscreenEvents)) {
    const existingEvents = new Set<string>(
      (currentSnapshot.worldInfo.cameraOffscreenEvents || []).map(e => e.trim())
    );
    const addedInProposal = new Set<string>();

    for (const off of candidate.offscreenEvents) {
      if (!off.event || typeof off.event !== 'string' || !off.event.trim()) {
        continue;
      }
      const trimmedEvent = off.event.trim();
      if (existingEvents.has(trimmedEvent) || addedInProposal.has(trimmedEvent)) {
        continue;
      }
      addedInProposal.add(trimmedEvent);

      actions.push({
        type: 'RECORD_OFFSCREEN_EVENT',
        payload: {
          id: generateProposalId('offscreen'),
          eventDescription: trimmedEvent,
          timestamp: new Date().toISOString(),
          visibility:
            off.informationAccess === 'PUBLIC'
              ? 'PUBLIC'
              : off.informationAccess === 'FACTION'
              ? 'FACTION_ONLY'
              : 'PRIVATE'
        }
      });
    }
  }

  // 4. Target DC (Rule 6)
  // Note: candidate.recommendedDC is preserved as narrative recommendation,
  // but must NOT emit a RECORD_DICE_RESULT action to prevent polluting Canonical dcHistory without player roll.

  // 5. Chapter Progression (Rule 7)
  if (candidate.chapterChanges) {
    const nextCurrentChapter =
      candidate.chapterChanges.currentChapter?.trim() ||
      currentSnapshot.worldInfo.chapters?.currentChapter ||
      DEFAULT_CHAPTER_NAME;
    const upcoming = (candidate.chapterChanges.upcomingChapters || [])
      .map(c => (typeof c === 'string' ? c.trim() : ''))
      .filter(Boolean)
      .slice(0, 3); // Max 3 upcoming chapters

    actions.push({
      type: 'ADVANCE_CHAPTER',
      payload: {
        currentChapter: nextCurrentChapter,
        upcomingChapters: upcoming
      }
    });
  }

  // 6. Factions
  if (Array.isArray(candidate.factionChanges)) {
    for (const fac of candidate.factionChanges) {
      if (!fac.name || typeof fac.name !== 'string' || !fac.name.trim()) {
        continue;
      }
      const facName = fac.name.trim();
      const existingFac = currentSnapshot.worldInfo.factions.find(f => f.name === facName || f.id === facName);

      if (existingFac) {
        actions.push({
          type: 'UPDATE_FACTION',
          payload: {
            id: existingFac.id,
            changes: {
              ...(fac.description !== undefined && { description: fac.description.trim() }),
              ...(fac.attitudeTowardsPlayer !== undefined && { attitudeTowardsPlayer: fac.attitudeTowardsPlayer.trim() })
            }
          }
        });
      } else {
        actions.push({
          type: 'ADD_FACTION',
          payload: {
            id: generateProposalId('fac'),
            name: facName,
            description: fac.description?.trim() || '',
            attitudeTowardsPlayer: fac.attitudeTowardsPlayer?.trim()
          }
        });
      }
    }
  }

  // 7. Inventory Changes
  if (Array.isArray(candidate.inventoryChanges)) {
    for (const inv of candidate.inventoryChanges) {
      if (!inv.name || typeof inv.name !== 'string' || !inv.name.trim()) {
        continue;
      }
      const isRemove = inv.action === 'remove';
      const cause = (inv as any).cause || (inv as any).acquisition?.cause;
      const cost = (inv as any).cost || (inv as any).acquisition?.cost;
      const verifiedEventId = (inv as any).verifiedEventId || (inv as any).acquisition?.verifiedEventId;
      actions.push({
        type: 'MODIFY_INVENTORY',
        payload: {
          item: {
            id: generateProposalId('item'),
            name: inv.name.trim(),
            quantity: Math.max(1, inv.quantity || 1)
          },
          operation: isRemove ? 'REMOVE' : 'ADD',
          ...(!isRemove && cause ? {
            acquisition: {
              cause: cause,
              cost: cost && typeof cost === 'object' ? {
                id: typeof cost.id === 'string' ? cost.id : undefined,
                name: typeof cost.name === 'string' ? cost.name : undefined,
                quantity: typeof cost.quantity === 'number' ? Math.max(1, cost.quantity) : 1
              } : undefined,
              verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined
            }
          } : {})
        }
      });
    }
  }

  // 8. Stat Changes (Rule: delta clamp -10~+10, final stat clamp 1~30)
  if (Array.isArray(candidate.statChanges) && candidate.statChanges.length > 0) {
    const statsObj: Partial<Record<StatType, number>> = {};
    for (const sc of candidate.statChanges) {
      if (sc.stat && typeof sc.delta === 'number' && !isNaN(sc.delta)) {
        const clampedDelta = Math.max(-10, Math.min(10, sc.delta));
        const currentVal = (currentSnapshot.character.stats as any)[sc.stat] || 10;
        statsObj[sc.stat] = Math.max(1, Math.min(30, currentVal + clampedDelta));
      }
    }
    if (Object.keys(statsObj).length > 0) {
      actions.push({
        type: 'UPDATE_CHARACTER_STATS',
        payload: {
          ...statsObj
        } as any
      });
    }
  }

  // Engine Language Pipeline: Convert Candidate Actions to Meaning Tree & Adapt to Proposal
  const rootMeaningNode: MeaningNode = {
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: `Turn ${storyTurnCount} Candidate State Transition`,
    children: actions.map(act => actionToMeaningNode(act, 'PROPOSAL'))
  };

  const safeProposal = adaptMeaningTreeToProposal(rootMeaningNode, {
    proposalId,
    requestId,
    eventId,
    expectedStateVersion: currentSnapshot.stateVersion,
    source: 'LLM',
    turn: storyTurnCount,
    timestamp: candidate.timestamp || new Date().toISOString(),
    intentSummary: `Turn ${storyTurnCount} Candidate State Transition`,
    originInputId: candidate.candidateId
  });

  if (candidate.rawMetadataBlock) {
    if (!safeProposal.rawClaims) {
      safeProposal.rawClaims = [];
    }
    safeProposal.rawClaims.push(candidate.rawMetadataBlock);
  }

  return safeProposal;
}
