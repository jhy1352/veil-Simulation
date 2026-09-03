import { TransitionAction, StateTransitionProposal, ProposalSource, ActionType, CanonicalState, ImmutableHistoricalRecord, VerifiedClaim, ExternalEvidence, UntrustedClaim } from './types';
import { CandidatePacket, HistoricalRecord, NpcRecord, NarrativeSeed, StatType, DEFAULT_NPC_CLASS, DEFAULT_CHAPTER_NAME, EntityReferenceBundle } from '../types';
import { recoverAndParseProposalOrMeaningTree, recoverSyntaxAndParseJson } from './language/recovery';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from './language/adapter';
import { MeaningNode } from './language/types';
import { ImmigrationGate } from './immigrationGate';
import {
  buildInventoryIdentityGraph,
  resolveCandidateInventoryIdentity,
  resolveInventoryItemIdentity,
  resolveNpcIdentity,
  resolveFactionIdentity,
  resolveNarrativeSeedIdentity,
  resolveCharacterIdentity
} from './index/entityIdentityResolver';

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

export function generateProposalId(prefix: string): string {
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

function toImmutableRecords(
  records?: readonly (ImmutableHistoricalRecord | HistoricalRecord)[]
): ImmutableHistoricalRecord[] {
  if (!records || records.length === 0) return [];
  return records.map((r, idx) => {
    if ('actionType' in r && typeof (r as any).actionType === 'string') {
      return r as ImmutableHistoricalRecord;
    }
    const hr = r as HistoricalRecord;
    return {
      recordId: hr.recordId || `rec-${idx}`,
      eventId: hr.recordId || `evt-${idx}`,
      proposalId: `prop-${idx}`,
      turn: hr.turn || 0,
      timestamp: hr.createdAt || new Date().toISOString(),
      source: (hr.source === 'USER_INPUT' ? 'PLAYER' : hr.source === 'AI_GM_METADATA' ? 'LLM' : 'ENGINE_INTERNAL') as ProposalSource,
      actionType: hr.recordType as ActionType,
      details: JSON.stringify(hr.payload || {}),
      stateVersionAfterCommit: 1
    };
  });
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
  const verifiedClaims: VerifiedClaim[] = [];
  const eventId = generateProposalId('evt');
  const requestId = generateProposalId('req');
  const proposalId = `prop-${requestId}`;
  const immutableHistory = toImmutableRecords(historicalRecords);
  const identityGraph = buildInventoryIdentityGraph(currentSnapshot, immutableHistory);

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

  // 1. NPC Changes (Rule 1 & Rule 8 & Universal Identity Continuity)
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

      // Resolve NPC Identity against Sovereign Engine Indices
      const resolution = resolveNpcIdentity(
        currentSnapshot,
        immutableHistory,
        npcName,
        npcCand.entityReference,
        identityGraph
      );

      // Identity Authority Chain: AMBIGUOUS and CONFLICT block canonical mutation
      if (resolution.status === 'AMBIGUOUS' || resolution.status === 'CONFLICT') {
        continue;
      }

      if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
        const canonicalNpcId = resolution.canonicalId!;
        const existingNpc = currentSnapshot.worldInfo.npcs.find(n => n.id === canonicalNpcId);

        // Rule 1: 미인지 NPC 메타지식 차단
        const isMet = npcCand.metInStory ?? (existingNpc ? existingNpc.metInStory : false);
        const safeInnerThought = isMet
          ? (npcCand.innerThought?.trim() || (existingNpc ? existingNpc.innerThought : '미상'))
          : '[미인지 상태]';

        if (npcCand.isDead) {
          actions.push({
            type: 'SET_NPC_STATUS',
            payload: {
              id: canonicalNpcId,
              status: 'DEAD',
              reason: 'LLM Candidate Turn Report'
            }
          });
          const evId = `ev-gate-${canonicalNpcId}-status-${storyTurnCount}`;
          const evidence: ExternalEvidence = {
            evidenceId: evId,
            entityId: canonicalNpcId,
            attribute: 'status',
            value: 'DEAD',
            source: 'RECOVERY_GATE_CANDIDATE',
            turn: currentSnapshot.turn,
            timestamp: new Date().toISOString()
          };
          const claimCandidate: UntrustedClaim = {
            targetEntityId: canonicalNpcId,
            targetAttribute: 'status',
            claimedValue: 'DEAD',
            claimedEvidenceIds: [evId]
          };
          const admission = ImmigrationGate.admit(claimCandidate, [evidence], currentSnapshot, immutableHistory);
          if (admission.admitted && admission.verifiedClaim) {
            verifiedClaims.push(admission.verifiedClaim);
          }
        } else {
          const changes: any = {
            ...(npcCand.alias !== undefined && { alias: npcCand.alias.trim() }),
            ...(npcCand.npcClass !== undefined && { npcClass: npcCand.npcClass }),
            innerThought: safeInnerThought,
            ...(isMet !== undefined && { metInStory: isMet }),
            ...(npcCand.origin !== undefined && { origin: npcCand.origin.trim() }),
            ...(npcCand.background !== undefined && { background: npcCand.background.trim() }),
            ...(npcCand.martialArts !== undefined && { martialArts: npcCand.martialArts.trim() }),
            ...(npcCand.values !== undefined && { values: npcCand.values.trim() }),
            ...(npcCand.affiliation !== undefined && { affiliation: npcCand.affiliation.trim() })
          };

          actions.push({
            type: 'UPDATE_NPC',
            payload: {
              id: canonicalNpcId,
              changes
            }
          });

          for (const [attrKey, attrVal] of Object.entries(changes)) {
            if (attrVal !== undefined) {
              const evId = `ev-gate-${canonicalNpcId}-${attrKey}-${storyTurnCount}`;
              const evidence: ExternalEvidence = {
                evidenceId: evId,
                entityId: canonicalNpcId,
                attribute: attrKey,
                value: attrVal,
                source: 'RECOVERY_GATE_CANDIDATE',
                turn: currentSnapshot.turn,
                timestamp: new Date().toISOString()
              };
              const claimCandidate: UntrustedClaim = {
                targetEntityId: canonicalNpcId,
                targetAttribute: attrKey,
                claimedValue: attrVal,
                claimedEvidenceIds: [evId]
              };
              const admission = ImmigrationGate.admit(claimCandidate, [evidence], currentSnapshot, immutableHistory);
              if (admission.admitted && admission.verifiedClaim) {
                verifiedClaims.push(admission.verifiedClaim);
              }
            }
          }
        }
      } else if (resolution.status === 'NOVEL') {
        // Verified New NPC Registration (Engine issues ID)
        const newNpcId = generateProposalId('npc');
        const isMet = npcCand.metInStory ?? false;
        const safeInnerThought = isMet
          ? (npcCand.innerThought?.trim() || '미상')
          : '[미인지 상태]';

        actions.push({
          type: 'ADD_NPC',
          payload: {
            id: newNpcId,
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
            affiliation: npcCand.affiliation?.trim() || '',
            ...(npcCand.entityReference ? {
              entityReference: {
                ...npcCand.entityReference,
                resolvedEntityId: newNpcId
              }
            } : {})
          }
        });
      }
    }
  }

  // 2. Narrative Seeds (Rule 2, Rule 3, Rule 4 & Universal Identity Continuity)
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

      const resolution = resolveNarrativeSeedIdentity(
        currentSnapshot,
        immutableHistory,
        trimmedContent,
        seed.entityReference,
        identityGraph
      );

      // Identity Authority Chain: AMBIGUOUS and CONFLICT block canonical mutation
      if (resolution.status === 'AMBIGUOUS' || resolution.status === 'CONFLICT') {
        continue;
      }

      // Rule 4: RESOLVE_NARRATIVE_SEED
      if (seed.status === 'resolved' || seed.action === 'resolve') {
        if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
          const canonicalSeedId = resolution.canonicalId!;
          const matchingSeed = currentSnapshot.worldInfo.seeds.find(s => s.id === canonicalSeedId);
          if (matchingSeed && matchingSeed.status === 'active') {
            const resolutionInfo = (seed as any).resolutionSummary;
            if (typeof resolutionInfo === 'string' && resolutionInfo.trim()) {
              actions.push({
                type: 'RESOLVE_NARRATIVE_SEED',
                payload: {
                  id: canonicalSeedId,
                  resolutionSummary: resolutionInfo.trim()
                }
              });
            }
          }
        }
      } else {
        // Active Narrative Seed
        if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
          // Already exists in canon or history, skip duplicate
          continue;
        }

        if (resolution.status === 'NOVEL') {
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

          const newSeedId = generateProposalId('seed');
          actions.push({
            type: 'ADD_NARRATIVE_SEED',
            payload: {
              id: newSeedId,
              content: trimmedContent,
              status: 'active',
              turnCreated: storyTurnCount,
              ...(seed.entityReference ? {
                entityReference: {
                  ...seed.entityReference,
                  resolvedEntityId: newSeedId
                }
              } : {})
            }
          });
        }
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

  // 6. Factions (Universal Identity Continuity)
  if (Array.isArray(candidate.factionChanges)) {
    for (const fac of candidate.factionChanges) {
      if (!fac.name || typeof fac.name !== 'string' || !fac.name.trim()) {
        continue;
      }
      const facName = fac.name.trim();

      // Resolve Faction Identity against Sovereign Engine Indices
      const resolution = resolveFactionIdentity(
        currentSnapshot,
        immutableHistory,
        facName,
        fac.entityReference,
        identityGraph
      );

      // Identity Authority Chain: AMBIGUOUS and CONFLICT block canonical mutation
      if (resolution.status === 'AMBIGUOUS' || resolution.status === 'CONFLICT') {
        continue;
      }

      if (resolution.status === 'EXACT' || resolution.status === 'RECOVERED') {
        const canonicalFacId = resolution.canonicalId!;
        actions.push({
          type: 'UPDATE_FACTION',
          payload: {
            id: canonicalFacId,
            changes: {
              ...(fac.description !== undefined && { description: fac.description.trim() }),
              ...(fac.attitudeTowardsPlayer !== undefined && { attitudeTowardsPlayer: fac.attitudeTowardsPlayer.trim() })
            }
          }
        });
      } else if (resolution.status === 'NOVEL') {
        const newFacId = generateProposalId('fac');
        actions.push({
          type: 'ADD_FACTION',
          payload: {
            id: newFacId,
            name: facName,
            description: fac.description?.trim() || '',
            attitudeTowardsPlayer: fac.attitudeTowardsPlayer?.trim(),
            ...(fac.entityReference ? {
              entityReference: {
                ...fac.entityReference,
                resolvedEntityId: newFacId
              }
            } : {})
          }
        });
      }
    }
  }

  // 7. Inventory Changes with Entity Identity Continuity
  if (Array.isArray(candidate.inventoryChanges)) {
    for (const inv of candidate.inventoryChanges) {
      if (!inv.name || typeof inv.name !== 'string' || !inv.name.trim()) {
        continue;
      }
      const isRemove = inv.action === 'remove';
      const ev = inv.entityReference?.evidence;
      const cause = (inv as any).cause || (inv as any).acquisition?.cause || ev?.cause;
      const cost = (inv as any).cost || (inv as any).acquisition?.cost || ev?.cost;
      const verifiedEventId = (inv as any).verifiedEventId || (inv as any).acquisition?.verifiedEventId || ev?.verifiedEventId;

      // Resolve Identity against Sovereign Engine Indices
      const resolution = resolveCandidateInventoryIdentity(
        currentSnapshot,
        immutableHistory,
        inv,
        identityGraph
      );

      // Identity Authority Chain: AMBIGUOUS and CONFLICT block canonical mutation
      if (resolution.status === 'AMBIGUOUS' || resolution.status === 'CONFLICT') {
        continue;
      }

      // Canonical ID determination:
      // - EXACT / RECOVERED: uses the confirmed canonical ID
      // - NOVEL: Engine generates a new ID (LLM never dictates ID)
      const canonicalId = (resolution.status === 'EXACT' || resolution.status === 'RECOVERED')
        ? resolution.canonicalId!
        : generateProposalId('item');

      let normalizedCause = cause;
      let effectiveCost: { id: string; name: string; quantity: number } | undefined = undefined;

      if (!isRemove) {
        const hasCostObject = cost && typeof cost === 'object';
        const isExchangeCause = cause === 'RESOURCE_EXCHANGE' || cause === 'PURCHASE' || cause === 'BUY' || cause === 'EXCHANGE' || cause === 'TRADE';

        if (isExchangeCause || hasCostObject) {
          normalizedCause = 'RESOURCE_EXCHANGE';

          let costName: string | undefined = undefined;
          let costQuantity = 1;
          let costRef: EntityReferenceBundle | undefined = undefined;

          if (hasCostObject) {
            if (typeof cost.name === 'string' && cost.name.trim()) {
              costName = cost.name.trim();
            } else if (typeof cost.id === 'string' && cost.id.trim()) {
              const entity = identityGraph.entities.get(cost.id.trim());
              if (entity && entity.entityType === 'ITEM') {
                costName = entity.name;
              }
            }
            costQuantity = typeof cost.quantity === 'number' ? Math.max(1, cost.quantity) : 1;
            costRef = (cost as any).entityReference || (typeof (cost as any).id === 'string' && (cost as any).id.trim() ? {
              entityType: 'ITEM' as const,
              claimedEntityId: (cost as any).id.trim(),
              evidence: {}
            } : undefined);
          } else {
            const removedItem = candidate.inventoryChanges?.find(i =>
              (i.action === 'remove' || (i.action as string) === 'DROP' || (i.action as string) === 'CONSUME') && (i.name || (i as any).id)
            );
            if (removedItem) {
              if (typeof removedItem.name === 'string' && removedItem.name.trim()) {
                costName = removedItem.name.trim();
              } else if (typeof (removedItem as any).id === 'string' && (removedItem as any).id.trim()) {
                const entity = identityGraph.entities.get((removedItem as any).id.trim());
                if (entity && entity.entityType === 'ITEM') {
                  costName = entity.name;
                }
              }
              costQuantity = Math.max(1, removedItem.quantity || 1);
              costRef = removedItem.entityReference || (typeof (removedItem as any).id === 'string' && (removedItem as any).id.trim() ? {
                entityType: 'ITEM' as const,
                claimedEntityId: (removedItem as any).id.trim(),
                evidence: {}
              } : undefined);
            }
          }

          // Strict Fail-Closed: If cost item is missing or cannot be identified, reject mutation
          if (!costName) {
            continue;
          }

          // Resolve Cost Item Identity strictly against Sovereign Engine Indices
          const costResolution = resolveInventoryItemIdentity(
            currentSnapshot,
            immutableHistory,
            costName,
            costRef,
            identityGraph
          );

          // EXACT and RECOVERED only; AMBIGUOUS, CONFLICT, or lack of canonicalId fails closed
          if (
            (costResolution.status !== 'EXACT' && costResolution.status !== 'RECOVERED') ||
            !costResolution.canonicalId
          ) {
            continue;
          }

          // Confirmed Canonical ID from Engine Authority (NEVER LLM-claimed fake ID or generated novel ID)
          effectiveCost = {
            id: costResolution.canonicalId,
            name: costName,
            quantity: costQuantity
          };
        } else if (cause === 'DISCOVERY' || cause === 'PICKUP' || cause === 'FIND') {
          normalizedCause = 'DISCOVERY_PICKUP';
        } else if (cause === 'GIFT' || cause === 'GIFT_REWARD') {
          normalizedCause = 'GIFT_REWARD';
        }
      }

      actions.push({
        type: 'MODIFY_INVENTORY',
        payload: {
          item: {
            id: canonicalId,
            name: inv.name.trim(),
            quantity: Math.max(1, inv.quantity || 1),
            ...(inv.entityReference ? {
              entityReference: {
                ...inv.entityReference,
                resolvedEntityId: canonicalId
              }
            } : {})
          },
          operation: isRemove ? 'REMOVE' : 'ADD',
          ...(!isRemove && normalizedCause ? {
            acquisition: {
              cause: normalizedCause,
              cost: effectiveCost,
              verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined
            }
          } : {})
        }
      });
    }
  }

  // 8. Character Identity Continuity & Stat Changes (Universal Entity #5: CHARACTER)
  let isCharacterMutationBlocked = false;

  if (candidate.characterChanges) {
    const charName = candidate.characterChanges.name?.trim() || currentSnapshot.character.name;
    const charResolution = resolveCharacterIdentity(
      currentSnapshot,
      immutableHistory,
      charName,
      candidate.characterChanges.entityReference,
      identityGraph
    );

    // Identity Authority Chain: AMBIGUOUS and CONFLICT block character mutation
    if (charResolution.status === 'AMBIGUOUS' || charResolution.status === 'CONFLICT') {
      isCharacterMutationBlocked = true;
    }
  }

  // Stat Changes (Rule: delta clamp -10~+10, final stat clamp 1~30)
  if (!isCharacterMutationBlocked && Array.isArray(candidate.statChanges) && candidate.statChanges.length > 0) {
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

  if (verifiedClaims.length > 0) {
    safeProposal.verifiedClaims = verifiedClaims;
  }

  return safeProposal;
}
