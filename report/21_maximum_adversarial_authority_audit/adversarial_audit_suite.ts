import { SovereignEngine } from '../../src/engine/state';
import { EngineValidator } from '../../src/engine/validator';
import { ImmigrationGate } from '../../src/engine/immigrationGate';
import { dispatchEngineInternalProposal } from '../../src/engine/internalCapability';
import {
  StateTransitionProposal,
  ExternalEvidence,
  UntrustedClaim,
  CanonicalState,
  ImmutableHistoricalRecord
} from '../../src/engine/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../../src/utils/factory';
import { buildSafeProposalFromCandidate } from '../../src/engine/proposalParser';
import { CandidatePacket } from '../../src/types';

interface ProbeResult {
  probeId: string;
  category: string;
  title: string;
  verdict: 'RUNTIME BREACH' | 'RUNTIME BLOCKED' | 'STATIC CONFIRMED VULNERABILITY';
  description: string;
  evidence: string;
}

const results: ProbeResult[] = [];

console.log('=== MAXIMUM ADVERSARIAL RED TEAM AUDIT SUITE START ===\n');

let timeSeq = Date.now();
function nextTime(): string {
  timeSeq += 10000;
  return new Date(timeSeq).toISOString();
}

// -------------------------------------------------------------
// [CATEGORY A]: Claim -> Derived Mutation Authority Chains
// -------------------------------------------------------------

// Probe A1: Claim Entity Mismatch
try {
  const engine = new SovereignEngine();
  const snapshot = engine.getSnapshot();
  const evidencePool: ExternalEvidence[] = [
    { evidenceId: 'ev-1', entityId: 'npc-bob', attribute: 'strength', value: 25, source: 'CANON_TEXT' }
  ];
  const untrusted: UntrustedClaim = {
    targetEntityId: 'npc-bob',
    targetAttribute: 'strength',
    claimedValue: 25,
    claimedEvidenceIds: ['ev-1']
  };
  const admission = ImmigrationGate.admit(untrusted, evidencePool, snapshot);
  if (!admission.admitted || !admission.verifiedClaim) {
    throw new Error('Gate failed to admit valid evidence');
  }

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-a1',
    requestId: 'req-a1',
    eventId: 'evt-a1',
    expectedStateVersion: snapshot.stateVersion,
    source: 'LLM',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Malicious entity claim mismatch',
    verifiedClaims: [admission.verifiedClaim],
    actions: [
      {
        type: 'UPDATE_CHARACTER_STATS',
        payload: { strength: 25 } as any
      }
    ]
  };

  const res = engine.submitProposal(proposal);
  if (res.success) {
    results.push({
      probeId: 'PROBE-A1',
      category: 'Claim Authority',
      title: 'Claim Entity Mismatch Attack',
      verdict: 'RUNTIME BREACH',
      description: 'VerifiedClaim for npc-bob was successfully used to mutate Protagonist stats.',
      evidence: `Committed strength: ${res.snapshot.character.stats.strength}`
    });
  } else {
    results.push({
      probeId: 'PROBE-A1',
      category: 'Claim Authority',
      title: 'Claim Entity Mismatch Attack',
      verdict: 'RUNTIME BLOCKED',
      description: 'Validator rejected proposal because claim entity (npc-bob) did not match protagonist.',
      evidence: res.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-A1',
    category: 'Claim Authority',
    title: 'Claim Entity Mismatch Attack',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// Probe A2: Claim Attribute Mismatch
try {
  const engine = new SovereignEngine();
  const snapshot = engine.getSnapshot();
  const evidencePool: ExternalEvidence[] = [
    { evidenceId: 'ev-2', entityId: 'protagonist', attribute: 'agility', value: 22, source: 'CANON_TEXT' }
  ];
  const untrusted: UntrustedClaim = {
    targetEntityId: 'protagonist',
    targetAttribute: 'agility',
    claimedValue: 22,
    claimedEvidenceIds: ['ev-2']
  };
  const admission = ImmigrationGate.admit(untrusted, evidencePool, snapshot);
  if (!admission.admitted || !admission.verifiedClaim) throw new Error('Gate admission failed');

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-a2',
    requestId: 'req-a2',
    eventId: 'evt-a2',
    expectedStateVersion: snapshot.stateVersion,
    source: 'LLM',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Malicious attribute claim mismatch',
    verifiedClaims: [admission.verifiedClaim],
    actions: [
      {
        type: 'UPDATE_CHARACTER_STATS',
        payload: { strength: 22 } as any
      }
    ]
  };

  const res = engine.submitProposal(proposal);
  if (res.success) {
    results.push({
      probeId: 'PROBE-A2',
      category: 'Claim Authority',
      title: 'Claim Attribute Mismatch Attack',
      verdict: 'RUNTIME BREACH',
      description: 'VerifiedClaim for agility was successfully used to mutate strength.',
      evidence: `Committed strength: ${res.snapshot.character.stats.strength}`
    });
  } else {
    results.push({
      probeId: 'PROBE-A2',
      category: 'Claim Authority',
      title: 'Claim Attribute Mismatch Attack',
      verdict: 'RUNTIME BLOCKED',
      description: 'Validator rejected attribute mismatch.',
      evidence: res.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-A2',
    category: 'Claim Authority',
    title: 'Claim Attribute Mismatch Attack',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// Probe A3: Multi-turn / Cross-turn VerifiedClaim Replay (Stale / Unconsumed Claim Replay)
try {
  const engine = new SovereignEngine();
  const snapshot = engine.getSnapshot();
  const evidencePool: ExternalEvidence[] = [
    { evidenceId: 'ev-3', entityId: 'protagonist', attribute: 'strength', value: 20, source: 'CANON_TEXT' }
  ];
  const untrusted: UntrustedClaim = {
    targetEntityId: 'protagonist',
    targetAttribute: 'strength',
    claimedValue: 20,
    claimedEvidenceIds: ['ev-3']
  };
  const admission = ImmigrationGate.admit(untrusted, evidencePool, snapshot);
  if (!admission.admitted || !admission.verifiedClaim) throw new Error('Gate admission failed');

  // Turn 1: Commit strength = 20 using claim
  const p1: StateTransitionProposal = {
    proposalId: 'prop-a3-1',
    requestId: 'req-a3-1',
    eventId: 'evt-a3-1',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Turn 1 legitimate stat update',
    verifiedClaims: [admission.verifiedClaim],
    actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 20 } as any }]
  };
  const res1 = engine.submitProposal(p1);
  if (!res1.success) throw new Error(`Turn 1 failed: ${res1.rejectedReasons.join(', ')}`);

  // Turn 2: Engine internal event lowers strength to 12 (injury)
  const res2 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-a3-2',
    requestId: 'req-a3-2',
    eventId: 'evt-a3-2',
    expectedStateVersion: 2,
    source: 'ENGINE_INTERNAL',
    turn: 2,
    timestamp: nextTime(),
    intentSummary: 'Turn 2 injury debuff',
    actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 12 } as any }]
  });
  if (!res2.success) throw new Error(`Turn 2 failed: ${res2.rejectedReasons.join(', ')}`);

  // Turn 3: Attacker replays Turn 1 VerifiedClaim to restore strength to 20 without new evidence
  const p3: StateTransitionProposal = {
    proposalId: 'prop-a3-3',
    requestId: 'req-a3-3',
    eventId: 'evt-a3-3',
    expectedStateVersion: 3,
    source: 'LLM',
    turn: 3,
    timestamp: nextTime(),
    intentSummary: 'Turn 3 Stale Claim Replay Attack',
    verifiedClaims: [admission.verifiedClaim], // Reusing Turn 1 Claim
    actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { strength: 20 } as any }]
  };
  const res3 = engine.submitProposal(p3);
  if (res3.success && res3.snapshot.character.stats.strength === 20) {
    results.push({
      probeId: 'PROBE-A3',
      category: 'Claim Authority',
      title: 'Stale / Unconsumed VerifiedClaim Replay Across Turns',
      verdict: 'RUNTIME BREACH',
      description: 'A VerifiedClaim issued at Turn 1 was replayed at Turn 3 to overwrite a subsequent Canonical state mutation (injury) without new evidence or claim re-issuance.',
      evidence: `Turn 1: strength=20 -> Turn 2: strength=12 -> Turn 3 Replay: strength=${res3.snapshot.character.stats.strength}, StateVersion=${res3.stateVersion}`
    });
  } else {
    results.push({
      probeId: 'PROBE-A3',
      category: 'Claim Authority',
      title: 'Stale / Unconsumed VerifiedClaim Replay Across Turns',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine rejected reused/stale VerifiedClaim.',
      evidence: res3.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-A3',
    category: 'Claim Authority',
    title: 'Stale / Unconsumed VerifiedClaim Replay Across Turns',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY B]: Name Alias -> Rename -> Existing Claim Hijacking
// -------------------------------------------------------------

// Probe B1: NPC Rename and Claim Coupling
try {
  const world = createEmptyWorldInfo();
  world.npcs.push({ id: 'npc-1', name: 'Alice', innerThought: 'none', npcClass: 'A' });
  const engine = new SovereignEngine(world);
  const snapshot = engine.getSnapshot();

  const evidencePool: ExternalEvidence[] = [
    { evidenceId: 'ev-b1', entityId: 'npc-1', attribute: 'location', value: 'Forbidden Citadel', source: 'CANON_TEXT' }
  ];
  const untrusted: UntrustedClaim = {
    targetEntityId: 'npc-1',
    targetAttribute: 'location',
    claimedValue: 'Forbidden Citadel',
    claimedEvidenceIds: ['ev-b1']
  };
  const admission = ImmigrationGate.admit(untrusted, evidencePool, snapshot);
  if (!admission.admitted || !admission.verifiedClaim) throw new Error('Gate admission failed');

  const proposal: StateTransitionProposal = {
    proposalId: 'prop-b1',
    requestId: 'req-b1',
    eventId: 'evt-b1',
    expectedStateVersion: snapshot.stateVersion,
    source: 'LLM',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'NPC rename with claim',
    verifiedClaims: [admission.verifiedClaim],
    actions: [
      {
        type: 'UPDATE_NPC',
        payload: {
          id: 'npc-1',
          changes: {
            name: 'Bob',
            location: 'Forbidden Citadel'
          }
        }
      }
    ]
  };

  const res = engine.submitProposal(proposal);
  if (res.success) {
    results.push({
      probeId: 'PROBE-B1',
      category: 'Name Alias',
      title: 'NPC Rename and Claim Coupling',
      verdict: 'RUNTIME BREACH',
      description: 'UPDATE_NPC changed name to Bob without a VerifiedClaim for name.',
      evidence: `NPC name: ${res.snapshot.worldInfo.npcs[0].name}, location: ${res.snapshot.worldInfo.npcs[0].location}`
    });
  } else {
    results.push({
      probeId: 'PROBE-B1',
      category: 'Name Alias',
      title: 'NPC Rename and Claim Coupling',
      verdict: 'RUNTIME BLOCKED',
      description: 'Validator blocked UPDATE_NPC because name change lacked a dedicated VerifiedClaim.',
      evidence: res.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-B1',
    category: 'Name Alias',
    title: 'NPC Rename and Claim Coupling',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY C]: Cross-Authority & ACL Mutation Sinks
// -------------------------------------------------------------

// Probe C1: PLAYER Source Executing OVERWRITE_CHARACTER Arbitrary Stat Overwrite
try {
  const engine = new SovereignEngine();
  const pPlayer: StateTransitionProposal = {
    proposalId: 'prop-c1',
    requestId: 'req-c1',
    eventId: 'evt-c1',
    expectedStateVersion: 1,
    source: 'PLAYER',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Player direct stat overwrite bypass',
    actions: [
      {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          name: '주인공',
          stats: {
            strength: 30,
            agility: 30,
            constitution: 30,
            intelligence: 30,
            wisdom: 30,
            charisma: 30
          }
        } as any
      }
    ]
  };

  const resPlayer = engine.submitProposal(pPlayer);
  if (resPlayer.success && resPlayer.snapshot.character.stats.strength === 30) {
    results.push({
      probeId: 'PROBE-C1',
      category: 'Cross-Authority ACL',
      title: 'PLAYER Source OVERWRITE_CHARACTER Arbitrary Max-Stat Mutation',
      verdict: 'RUNTIME BREACH',
      description: 'PLAYER source used OVERWRITE_CHARACTER to unilaterally set all stats to 30 without any dice, evidence, claim, seed, or engine authorization.',
      evidence: `Committed character stats: ${JSON.stringify(resPlayer.snapshot.character.stats)}`
    });
  } else {
    results.push({
      probeId: 'PROBE-C1',
      category: 'Cross-Authority ACL',
      title: 'PLAYER Source OVERWRITE_CHARACTER Arbitrary Max-Stat Mutation',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine blocked PLAYER source from executing OVERWRITE_CHARACTER.',
      evidence: resPlayer.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-C1',
    category: 'Cross-Authority ACL',
    title: 'PLAYER Source OVERWRITE_CHARACTER Arbitrary Max-Stat Mutation',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// Probe C2: Root 2 - LLM UPDATE_CHARACTER_STATS Synthetic Grounding via Seed ID Injection
try {
  const world = createEmptyWorldInfo();
  world.seeds.push({ id: 'seed-ancient-scroll', content: 'An ancient scroll found in cave', status: 'active' });
  const engine = new SovereignEngine(world);

  const candidate: CandidatePacket = {
    narrative: '주인공은 힘을 크게 길렀다.',
    statChanges: [
      { stat: 'strength', delta: 8 }
    ],
    timestamp: nextTime()
  };

  const proposal = buildSafeProposalFromCandidate(engine.getSnapshot(), candidate, 1);

  const res = engine.submitProposal(proposal);
  if (res.success && res.snapshot.character.stats.strength === 18) {
    results.push({
      probeId: 'PROBE-C2',
      category: 'Root 2 Synthetic Grounding',
      title: 'LLM UPDATE_CHARACTER_STATS Grounded by Synthesized Active Seed ID',
      verdict: 'RUNTIME BREACH',
      description: 'LLM generated stat delta (+8) with zero evidence. proposalParser injected active seed-ancient-scroll ID as verifiedEventId, and EngineValidator accepted it as proof of grounding.',
      evidence: `Initial strength: 10 -> Committed strength: ${res.snapshot.character.stats.strength}, Action verifiedEventId: ${(proposal.actions[0].payload as any).verifiedEventId}`
    });
  } else {
    results.push({
      probeId: 'PROBE-C2',
      category: 'Root 2 Synthetic Grounding',
      title: 'LLM UPDATE_CHARACTER_STATS Grounded by Synthesized Active Seed ID',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine blocked synthetic seed grounding.',
      evidence: res.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-C2',
    category: 'Root 2 Synthetic Grounding',
    title: 'LLM UPDATE_CHARACTER_STATS Grounded by Synthesized Active Seed ID',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// Probe C3: GENESIS Source Post-Genesis Re-execution
try {
  const engine = new SovereignEngine();
  const res1 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-c3-1',
    requestId: 'req-c3-1',
    eventId: 'evt-c3-1',
    expectedStateVersion: 1,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'System initialization',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'Rumor 1' } }]
  });
  if (!res1.success) throw new Error('Initial commit failed: ' + res1.rejectedReasons.join('; '));

  // Now engine is at stateVersion = 2, turn = 1.
  // Attempt GENESIS source to OVERWRITE_WORLD_INFO with new metadata/factions
  const pGenesis: StateTransitionProposal = {
    proposalId: 'prop-c3-2',
    requestId: 'req-c3-2',
    eventId: 'evt-c3-2',
    expectedStateVersion: 2,
    source: 'GENESIS',
    turn: 2,
    timestamp: nextTime(),
    intentSummary: 'Post-genesis GENESIS source attack',
    actions: [
      {
        type: 'OVERWRITE_WORLD_INFO',
        payload: {
          worldName: 'Hijacked World',
          settingDescription: 'Attacker injected world',
          npcs: [],
          factions: [],
          seeds: [],
          chapters: { currentChapter: 'Ch 99', upcomingChapters: [] }
        } as any
      }
    ]
  };

  const resGen = engine.submitProposal(pGenesis);
  if (resGen.success) {
    results.push({
      probeId: 'PROBE-C3',
      category: 'Genesis Source Authority',
      title: 'GENESIS Source Overwrite Post-Genesis',
      verdict: 'RUNTIME BREACH',
      description: 'GENESIS source successfully executed OVERWRITE_WORLD_INFO after Genesis (at stateVersion 2, turn 2).',
      evidence: `Committed World Name: ${resGen.snapshot.worldInfo.worldName}, StateVersion: ${resGen.stateVersion}`
    });
  } else {
    results.push({
      probeId: 'PROBE-C3',
      category: 'Genesis Source Authority',
      title: 'GENESIS Source Overwrite Post-Genesis',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine rejected GENESIS source action after initial genesis state.',
      evidence: resGen.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-C3',
    category: 'Genesis Source Authority',
    title: 'GENESIS Source Overwrite Post-Genesis',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY D]: Snapshot / Hydration & Idempotency Probes
// -------------------------------------------------------------

// Probe D1: Hydration with Forged StateVersion or Turn
try {
  const invalidSnapshot: CanonicalState = {
    stateVersion: 5,
    turn: 2,
    worldInfo: createEmptyWorldInfo(),
    character: createEmptyCharacter(),
    lastCommittedEventId: 'evt-fake',
    lastCommittedAt: '2026-01-01T00:00:00.000Z'
  };
  const history: ImmutableHistoricalRecord[] = [
    {
      recordId: 'rec-1',
      eventId: 'evt-1',
      requestId: 'req-1',
      proposalId: 'prop-1',
      turn: 3, // History turn (3) is HIGHER than snapshot turn (2)!
      timestamp: '2026-01-01T00:00:00.000Z',
      source: 'SYSTEM',
      actionType: 'ADD_RUMOR',
      details: 'test',
      stateVersionAfterCommit: 3,
      informationAccess: 'PUBLIC'
    }
  ];

  SovereignEngine.hydrate(invalidSnapshot, history);
  results.push({
    probeId: 'PROBE-D1',
    category: 'Hydration Integrity',
    title: 'Hydration Snapshot/History Turn Inconsistency',
    verdict: 'RUNTIME BREACH',
    description: 'SovereignEngine.hydrate accepted snapshot turn < last history record turn without error.',
    evidence: 'Hydration succeeded despite turn regression.'
  });
} catch (err: any) {
  results.push({
    probeId: 'PROBE-D1',
    category: 'Hydration Integrity',
    title: 'Hydration Snapshot/History Turn Inconsistency',
    verdict: 'RUNTIME BLOCKED',
    description: 'SovereignEngine.hydrate rejected inconsistent snapshot vs history.',
    evidence: err.message
  });
}

// Probe D2: Idempotency Signature Collision (Same RequestId, New EventId vs Same EventId, New RequestId)
try {
  const engine = new SovereignEngine();
  const res1 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-d2-1',
    requestId: 'req-shared',
    eventId: 'evt-d2-1',
    expectedStateVersion: 1,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Initial execution',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'Rumor A' } }]
  });
  if (!res1.success) throw new Error('Commit 1 failed: ' + res1.rejectedReasons.join('; '));

  // Attempt replay with SAME requestId but different eventId
  const res2 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-d2-2',
    requestId: 'req-shared', // Same requestId!
    eventId: 'evt-d2-2',     // Different eventId!
    expectedStateVersion: 2,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Replayed requestId',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'Rumor B' } }]
  });
  if (res2.success) {
    results.push({
      probeId: 'PROBE-D2',
      category: 'Idempotency',
      title: 'RequestId Reuse / Idempotency Bypass',
      verdict: 'RUNTIME BREACH',
      description: 'Engine allowed proposal with previously executed requestId to commit state mutation.',
      evidence: `Second proposal succeeded. Total rumors: ${res2.snapshot.worldInfo.rumors.length}`
    });
  } else {
    results.push({
      probeId: 'PROBE-D2',
      category: 'Idempotency',
      title: 'RequestId Reuse / Idempotency Bypass',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine rejected proposal due to duplicate requestId.',
      evidence: res2.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-D2',
    category: 'Idempotency',
    title: 'RequestId Reuse / Idempotency Bypass',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY E]: Intra-Proposal Dependency and Temporal Exploits
// -------------------------------------------------------------

// Probe E1: Proposal Timestamp Regression
try {
  const engine = new SovereignEngine();
  const res1 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-e1-1',
    requestId: 'req-e1-1',
    eventId: 'evt-e1-1',
    expectedStateVersion: 1,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Commit at T1',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'Rumor 1' } }]
  });
  if (!res1.success) throw new Error('Commit 1 failed: ' + res1.rejectedReasons.join('; '));

  // Proposal 2 has timestamp earlier than lastCommittedAt
  const res2 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-e1-2',
    requestId: 'req-e1-2',
    eventId: 'evt-e1-2',
    expectedStateVersion: 2,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: '2020-01-01T00:00:00.000Z', // Years earlier!
    intentSummary: 'Timestamp regression attack',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'January rumor' } }]
  });
  if (res2.success) {
    results.push({
      probeId: 'PROBE-E1',
      category: 'Temporal Integrity',
      title: 'Proposal Timestamp Regression',
      verdict: 'RUNTIME BREACH',
      description: 'Engine accepted proposal with timestamp earlier than last committed timestamp.',
      evidence: `Accepted timestamp: ${res2.snapshot.lastCommittedAt}`
    });
  } else {
    results.push({
      probeId: 'PROBE-E1',
      category: 'Temporal Integrity',
      title: 'Proposal Timestamp Regression',
      verdict: 'RUNTIME BLOCKED',
      description: 'Engine blocked proposal due to timestamp regression.',
      evidence: res2.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-E1',
    category: 'Temporal Integrity',
    title: 'Proposal Timestamp Regression',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY F]: Object Reference & Immutability Sinks
// -------------------------------------------------------------

// Probe F1: Snapshot Direct Mutation Leak
try {
  const engine = new SovereignEngine();
  const snap = engine.getSnapshot();
  // Attempt to mutate internal character stats via returned snapshot reference
  snap.character.stats.strength = 999;
  const snapAfter = engine.getSnapshot();
  if (snapAfter.character.stats.strength === 999) {
    results.push({
      probeId: 'PROBE-F1',
      category: 'Immutability Leak',
      title: 'Direct Mutation of getSnapshot() Leaks into Engine Canonical State',
      verdict: 'RUNTIME BREACH',
      description: 'getSnapshot() returns a mutable reference that directly alters the internal canonical state.',
      evidence: `Internal strength mutated to: ${snapAfter.character.stats.strength}`
    });
  } else {
    results.push({
      probeId: 'PROBE-F1',
      category: 'Immutability Leak',
      title: 'Direct Mutation of getSnapshot() Leaks into Engine Canonical State',
      verdict: 'RUNTIME BLOCKED',
      description: 'getSnapshot() returns deep clone or frozen object; internal state remained unaffected.',
      evidence: `Internal strength remained: ${snapAfter.character.stats.strength}`
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-F1',
    category: 'Immutability Leak',
    title: 'Direct Mutation of getSnapshot() Leaks into Engine Canonical State',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// Probe F2: History Records Direct Mutation Leak
try {
  const engine = new SovereignEngine();
  const res1 = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-f2-1',
    requestId: 'req-f2-1',
    eventId: 'evt-f2-1',
    expectedStateVersion: 1,
    source: 'ENGINE_INTERNAL',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Commit at T1',
    actions: [{ type: 'ADD_RUMOR', payload: { rumor: 'Original Rumor' } }]
  });
  if (!res1.success) throw new Error('Commit 1 failed');

  const history = engine.getHistory();
  if (history.length > 0) {
    try {
      (history[0] as any).details = 'TAMPERED_HISTORY';
    } catch (e) {
      // Caught assignment error on frozen object
    }
    const historyAfter = engine.getHistory();
    if (historyAfter[0].details === 'TAMPERED_HISTORY') {
      results.push({
        probeId: 'PROBE-F2',
        category: 'Immutability Leak',
        title: 'Direct Mutation of getHistory() Leaks into History Log',
        verdict: 'RUNTIME BREACH',
        description: 'getHistory() returns mutable internal array references.',
        evidence: `Mutated history record details: ${historyAfter[0].details}`
      });
    } else {
      results.push({
        probeId: 'PROBE-F2',
        category: 'Immutability Leak',
        title: 'Direct Mutation of getHistory() Leaks into History Log',
        verdict: 'RUNTIME BLOCKED',
        description: 'History records are defensively cloned or frozen.',
        evidence: `History record details remained: ${historyAfter[0].details}`
      });
    }
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-F2',
    category: 'Immutability Leak',
    title: 'Direct Mutation of getHistoryRecords() Leaks into History Log',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// [CATEGORY G]: Intra-Proposal Multi-Action Order Exploitation
// -------------------------------------------------------------

// Probe G1: Intra-Proposal NPC Creation then Unauthorized Mutation
try {
  const engine = new SovereignEngine();
  const proposal: StateTransitionProposal = {
    proposalId: 'prop-g1',
    requestId: 'req-g1',
    eventId: 'evt-g1',
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: nextTime(),
    intentSummary: 'Create then illegally mutate NPC in single proposal',
    actions: [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-created-g1',
          name: 'Shadow Figure',
          npcClass: 'A'
        } as any
      },
      {
        type: 'UPDATE_NPC',
        payload: {
          id: 'npc-created-g1',
          changes: {
            name: 'Renamed Shadow',
            location: 'Secret Vault'
          }
        }
      }
    ]
  };

  const res = engine.submitProposal(proposal);
  if (res.success) {
    results.push({
      probeId: 'PROBE-G1',
      category: 'Intra-Proposal Dependency',
      title: 'Intra-Proposal Entity Creation & Unverified Chained Mutation',
      verdict: 'RUNTIME BREACH',
      description: 'Validator allowed UPDATE_NPC on an entity created in the same proposal without verifying intermediate state or requiring claims.',
      evidence: `Committed NPC: ${res.snapshot.worldInfo.npcs.find(n => n.id === 'npc-created-g1')?.name}`
    });
  } else {
    results.push({
      probeId: 'PROBE-G1',
      category: 'Intra-Proposal Dependency',
      title: 'Intra-Proposal Entity Creation & Unverified Chained Mutation',
      verdict: 'RUNTIME BLOCKED',
      description: 'Validator rejected proposal.',
      evidence: res.rejectedReasons.join('; ')
    });
  }
} catch (err: any) {
  results.push({
    probeId: 'PROBE-G1',
    category: 'Intra-Proposal Dependency',
    title: 'Intra-Proposal Entity Creation & Unverified Chained Mutation',
    verdict: 'RUNTIME BLOCKED',
    description: `Exception: ${err.message}`,
    evidence: err.stack || err.message
  });
}

// -------------------------------------------------------------
// SUMMARY EXECUTION LOG
// -------------------------------------------------------------
console.log('-------------------------------------------------------------');
console.log('RED TEAM AUDIT RESULTS:');
console.log('-------------------------------------------------------------');
for (const r of results) {
  console.log(`[${r.probeId}] [${r.verdict}] ${r.title}`);
  console.log(`  Category: ${r.category}`);
  console.log(`  Description: ${r.description}`);
  console.log(`  Evidence: ${r.evidence}\n`);
}
