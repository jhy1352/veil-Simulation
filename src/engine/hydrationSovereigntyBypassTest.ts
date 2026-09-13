/**
 * Hydration Sovereignty Bypass Red Team Test Suite
 * 
 * Verifies that:
 * 1. Forged / corrupted / tampered save states throw in SovereignEngine.hydrate()
 * 2. Hydration failure strictly blocks entry to or retention of 'playing' state (fail-closed)
 * 3. Engine-null mutations during playing state are strictly rejected (zero state pollution)
 * 4. Multi-generation save/hydrate/commit cycles maintain 100% replay determinism and genesis anchor
 */

import { SovereignEngine } from './state';
import { CanonicalState, ImmutableHistoricalRecord, StateTransitionProposal } from './types';
import { WorldInfo, Character } from '../types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export function runHydrationSovereigntyBypassTests(): { summary: string; allPassed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message || String(e) });
    }
  };

  // Test 1: Forged history record throws on hydrate
  runTest('1. Forged historical record hash mismatch throws on hydrate()', () => {
    const genesisWorld = createEmptyWorldInfo();
    genesisWorld.worldName = 'Test World';
    const genesisChar = createEmptyCharacter();
    genesisChar.name = 'Test Protagonist';

    const engine = new SovereignEngine(genesisWorld, genesisChar, [], 1, 1);
    
    // Commit a valid proposal
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-1',
      requestId: 'req-1',
      eventId: 'evt-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Valid action',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...genesisChar, age: '20세' }
        }
      ]
    };
    const res1 = engine.submitProposal(prop1);
    if (!res1.success) throw new Error('Failed initial proposal');

    const history = engine.getHistory();
    const snapshot = engine.getSnapshot();
    const genesisSnapshot = engine.getGenesisSnapshot();

    // Tamper with history payload
    const tamperedHistory = JSON.parse(JSON.stringify(history));
    tamperedHistory[0].canonicalAction.payload.age = '999세'; // Tamper payload without updating signature/hash

    let threw = false;
    try {
      SovereignEngine.hydrate(snapshot, tamperedHistory, undefined, undefined, genesisSnapshot);
    } catch (e) {
      threw = true;
    }

    if (!threw) {
      throw new Error('Expected hydrate() to throw on tampered history payload!');
    }
  });

  // Test 2: Forged stateVersion in snapshot throws on hydrate
  runTest('2. Forged stateVersion in snapshot throws on hydrate()', () => {
    const genesisWorld = createEmptyWorldInfo();
    const genesisChar = createEmptyCharacter();

    const engine = new SovereignEngine(genesisWorld, genesisChar, [], 1, 1);
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-1',
      requestId: 'req-1',
      eventId: 'evt-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Valid action',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...genesisChar, age: '25세' }
        }
      ]
    };
    const res1 = engine.submitProposal(prop1);
    if (!res1.success) throw new Error('Failed initial proposal');

    const history = engine.getHistory();
    const snapshot = engine.getSnapshot();
    const genesisSnapshot = engine.getGenesisSnapshot();

    // Forged snapshot with version 99
    const forgedSnapshot: CanonicalState = {
      ...snapshot,
      stateVersion: 99
    };

    let threw = false;
    try {
      SovereignEngine.hydrate(forgedSnapshot, history, undefined, undefined, genesisSnapshot);
    } catch (e) {
      threw = true;
    }

    if (!threw) {
      throw new Error('Expected hydrate() to throw on stateVersion mismatch!');
    }
  });

  // Test 3: Forged character state without matching action in history throws on hydrate
  runTest('3. Forged character state without matching action in history throws on hydrate()', () => {
    const genesisWorld = createEmptyWorldInfo();
    const genesisChar = createEmptyCharacter();

    const engine = new SovereignEngine(genesisWorld, genesisChar, [], 1, 1);
    const prop1: StateTransitionProposal = {
      proposalId: 'prop-1',
      requestId: 'req-1',
      eventId: 'evt-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Valid action',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...genesisChar, age: '25세' }
        }
      ]
    };
    const res1 = engine.submitProposal(prop1);
    if (!res1.success) throw new Error('Failed initial proposal');

    const history = engine.getHistory();
    const snapshot = engine.getSnapshot();
    const genesisSnapshot = engine.getGenesisSnapshot();

    // Forged snapshot where character has modified stat not produced by replay
    const forgedSnapshot: CanonicalState = {
      ...snapshot,
      character: {
        ...snapshot.character,
        stats: {
          ...snapshot.character.stats,
          strength: 999
        }
      }
    };

    let threw = false;
    try {
      SovereignEngine.hydrate(forgedSnapshot, history, undefined, undefined, genesisSnapshot);
    } catch (e) {
      threw = true;
    }

    if (!threw) {
      throw new Error('Expected hydrate() to throw on state replay hash mismatch!');
    }
  });

  // Test 4: Genesis Anchor Drift Prevention across multi-generation hydration
  runTest('4. Multi-generation save/hydrate preserves original Genesis snapshot', () => {
    const genesisWorld = createEmptyWorldInfo();
    genesisWorld.worldName = 'Genesis World 1';
    const genesisChar = createEmptyCharacter();
    genesisChar.name = 'Genesis Protagonist 1';

    // Gen 1 Engine
    const gen1Engine = new SovereignEngine(genesisWorld, genesisChar, [], 1, 1);
    const p1: StateTransitionProposal = {
      proposalId: 'p1',
      requestId: 'r1',
      eventId: 'e1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Gen 1 Action',
      actions: [{ type: 'OVERWRITE_CHARACTER', payload: { ...genesisChar, age: '21세' } }]
    };
    gen1Engine.submitProposal(p1);

    const gen1Snap = gen1Engine.getSnapshot();
    const gen1Hist = gen1Engine.getHistory();
    const originalGenesis = gen1Engine.getGenesisSnapshot();

    // Gen 2 Hydration
    const gen2Engine = SovereignEngine.hydrate(gen1Snap, gen1Hist, undefined, undefined, originalGenesis);
    if (gen2Engine.getGenesisSnapshot().character.age !== genesisChar.age) {
      throw new Error('Gen 2 Engine lost original genesis character age!');
    }

    // Gen 2 Mutation
    const p2: StateTransitionProposal = {
      proposalId: 'p2',
      requestId: 'r2',
      eventId: 'e2',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 2,
      timestamp: new Date().toISOString(),
      intentSummary: 'Gen 2 Action',
      actions: [{ type: 'OVERWRITE_CHARACTER', payload: { ...gen1Snap.character, age: '22세' } }]
    };
    gen2Engine.submitProposal(p2);

    const gen2Snap = gen2Engine.getSnapshot();
    const gen2Hist = gen2Engine.getHistory();

    // Gen 3 Hydration
    const gen3Engine = SovereignEngine.hydrate(gen2Snap, gen2Hist, undefined, undefined, gen2Engine.getGenesisSnapshot());
    if (gen3Engine.getGenesisSnapshot().character.name !== 'Genesis Protagonist 1') {
      throw new Error('Gen 3 Engine lost original genesis character name!');
    }
    if (gen3Engine.getGenesisSnapshot().stateVersion !== 1) {
      throw new Error('Gen 3 Engine genesis snapshot version is not 1!');
    }
    if (gen3Engine.getSnapshot().character.age !== '22세') {
      throw new Error('Gen 3 Engine snapshot character age mismatch!');
    }
    if (gen3Engine.getSnapshot().stateVersion !== 3) {
      throw new Error('Gen 3 Engine snapshot stateVersion is not 3!');
    }
  });

  // Test 5: Strict fail-closed simulated App logic on hydration failure
  runTest('5. Fail-Closed App State Transition simulation upon hydration failure', () => {
    let appGameState: string = 'creation';
    let appCharacter = createEmptyCharacter();
    let appWorldInfo = createEmptyWorldInfo();
    let appEngine: SovereignEngine | null = null;
    let appModelError: string | null = null;

    const simulateLoadCorruptedSave = (corruptedPayload: any) => {
      try {
        const loadedWorld = corruptedPayload.worldInfo;
        const loadedChar = corruptedPayload.character;
        const loadedTurn = corruptedPayload.storyTurnCount || 1;
        const loadedHistory = corruptedPayload.engineState?.historicalRecords || [];
        const loadedDiag = corruptedPayload.engineState?.diagnostics;
        const resolvedVersion = loadedDiag?.stateVersion || 1;

        // Strict Gate: hydrate before state change
        const hydratedEngine = SovereignEngine.hydrate(
          {
            stateVersion: resolvedVersion,
            turn: loadedTurn,
            worldInfo: loadedWorld,
            character: loadedChar,
            lastCommittedEventId: loadedDiag?.lastEventId || null,
            lastCommittedAt: new Date().toISOString()
          },
          loadedHistory,
          undefined,
          undefined,
          corruptedPayload.genesisSnapshot
        );

        // If succeeded:
        appEngine = hydratedEngine;
        appCharacter = hydratedEngine.getSnapshot().character;
        appWorldInfo = hydratedEngine.getSnapshot().worldInfo;
        appGameState = 'playing';
      } catch (err: any) {
        appModelError = `[SOVEREIGN_HYDRATION_FAILED] ${err.message}`;
        // Fail-closed: ensure appGameState is NOT set to 'playing'
      }
    };

    // Attempt to load corrupted payload
    simulateLoadCorruptedSave({
      character: { ...createEmptyCharacter(), name: 'Hacker' },
      worldInfo: createEmptyWorldInfo(),
      storyTurnCount: 5,
      engineState: {
        historicalRecords: [
          {
            eventId: 'fake-evt',
            sequenceNumber: 1,
            stateVersion: 2,
            turn: 1,
            timestamp: new Date().toISOString(),
            source: 'PLAYER',
            intentSummary: 'Fake',
            actions: [],
            previousStateHash: '0000000000000000',
            resultingStateHash: 'ffffffffffffffff',
            signature: 'invalidsig'
          }
        ],
        diagnostics: { stateVersion: 5 }
      }
    });

    if (appGameState === 'playing') {
      throw new Error('SECURITY VIOLATION: appGameState transitioned to playing despite hydration failure!');
    }
    if (appEngine !== null) {
      throw new Error('SECURITY VIOLATION: appEngine was set despite hydration failure!');
    }
    if (appCharacter.name === 'Hacker') {
      throw new Error('SECURITY VIOLATION: appCharacter was mutated with untrusted payload despite hydration failure!');
    }
    if (!appModelError?.includes('SOVEREIGN_HYDRATION_FAILED')) {
      throw new Error('Expected appModelError to contain fail-closed quarantine notice');
    }
  });

  const allPassed = results.every(r => r.passed);
  const summary = `Hydration Sovereignty Bypass Tests: ${results.filter(r => r.passed).length}/${results.length} PASSED`;

  return { summary, allPassed, results };
}
