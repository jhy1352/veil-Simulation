import { SovereignEngine } from './state';
import { StateTransitionProposal, ImmutableHistoricalRecord, CanonicalState, TransitionAction } from './types';
import { WorldInfo, Character } from '../types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../utils/factory';
import { actionToMeaningNode } from './language/adapter';
import { MeaningNode } from './language/types';

console.log('====================================================');
console.log('VEIL — Historical Provenance & Deterministic Replay Test Suite');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  passed++;
  console.log(`✅ [PASS] ${msg}`);
}

function buildTestProposal(params: {
  proposalId: string;
  requestId: string;
  eventId: string;
  turn: number;
  expectedStateVersion: number;
  timestamp?: string;
  actions: TransitionAction[];
}): StateTransitionProposal {
  const tree: MeaningNode = {
    atom: 'INTENT',
    scope: 'PROPOSAL',
    children: params.actions.map(act => actionToMeaningNode(act, 'PROPOSAL'))
  };

  return {
    proposalId: params.proposalId,
    requestId: params.requestId,
    eventId: params.eventId,
    source: 'LLM',
    turn: params.turn,
    expectedStateVersion: params.expectedStateVersion,
    timestamp: params.timestamp || new Date().toISOString(),
    meaningTree: tree,
    actions: params.actions
  };
}

async function runSuite() {
  // TEST 1: Full Lifecycle Replay & Post-Hydration Commit
  {
    const initialWorld = createEmptyWorldInfo();
    initialWorld.worldName = '판타지아 대륙';
    const initialChar = createEmptyCharacter();
    initialChar.name = '모험가 아린';
    initialChar.stats = { strength: 14, agility: 12, constitution: 10, intelligence: 10, wisdom: 8, charisma: 10 };

    const engine = new SovereignEngine(initialWorld, initialChar);
    const genesisSnap = engine.getGenesisSnapshot();

    // Turn 1: Add item & Add NPC
    const prop1 = buildTestProposal({
      proposalId: 'prop-t1-1',
      requestId: 'req-t1-1',
      eventId: 'evt-t1-1',
      turn: 1,
      expectedStateVersion: 1,
      actions: [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-blacksmith',
            name: '대장장이 톨린',
            location: '시작 마을',
            status: 'ALIVE',
            innerThought: '성실한 장인이다.',
            npcClass: 'Class A'
          }
        }
      ]
    });

    const res1 = engine.submitProposal(prop1);
    if (!res1.success) {
      console.error('res1 rejected reasons:', res1.rejectedReasons, res1.conflictDetails);
    }
    assert(res1.success, 'Turn 1 Proposal commits cleanly');

    // Turn 2: Advance Chapter & Add Rumor
    const prop2 = buildTestProposal({
      proposalId: 'prop-t2-1',
      requestId: 'req-t2-1',
      eventId: 'evt-t2-1',
      turn: 2,
      expectedStateVersion: 2,
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '제2장: 여정의 시작',
            upcomingChapters: ['제3장: 고대 유적']
          }
        },
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '근처 숲에 고대 유적이 발견되었다는 소문이 돈다.' }
        }
      ]
    });

    const res2 = engine.submitProposal(prop2);
    if (!res2.success) {
      console.error('res2 rejected reasons:', res2.rejectedReasons, res2.conflictDetails);
    }
    assert(res2.success, 'Turn 2 Proposal commits cleanly');

    const snap = engine.getSnapshot();
    const hist = engine.getHistory();

    assert(hist.length === 3, 'History contains exactly 3 records across 2 proposals');
    assert(hist.every(r => r.canonicalAction !== undefined), 'All records contain canonicalAction');
    assert(hist.every(r => typeof r.previousStateHash === 'string'), 'All records contain valid previousStateHash');

    // Hydrate from snapshot & history with genesisState anchor
    const hydratedEngine = SovereignEngine.hydrate(snap, hist, undefined, undefined, genesisSnap);
    assert(hydratedEngine !== null, 'Hydration with authentic history and genesis anchor succeeds');
    assert(
      JSON.stringify(hydratedEngine.getSnapshot()) === JSON.stringify(snap),
      'Hydrated snapshot strictly matches source snapshot'
    );

    // Post-Hydration Commit
    const prop3 = buildTestProposal({
      proposalId: 'prop-t3-1',
      requestId: 'req-t3-1',
      eventId: 'evt-t3-1',
      turn: 3,
      expectedStateVersion: 3,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '유적 입구에 봉인이 걸려 있다.' }
        }
      ]
    });
    const res3 = hydratedEngine.submitProposal(prop3);
    assert(res3.success, 'Post-hydration proposal commits cleanly through Sovereign Gate');
    assert(hydratedEngine.getSnapshot().worldInfo.publicRumors.length === 2, 'Post-hydration state reflects new rumor');

    // Re-hydrate post-hydration engine
    const snap3 = hydratedEngine.getSnapshot();
    const hist3 = hydratedEngine.getHistory();
    const rehydratedEngine = SovereignEngine.hydrate(snap3, hist3, undefined, undefined, genesisSnap);
    assert(
      JSON.stringify(rehydratedEngine.getSnapshot()) === JSON.stringify(snap3),
      'Re-hydration across multiple generations succeeds deterministically'
    );
  }

  // TEST 2: Snapshot Tampering Defense (Fail-Closed)
  {
    const engine = new SovereignEngine();
    const genesisSnap = engine.getGenesisSnapshot();

    const prop = buildTestProposal({
      proposalId: 'prop-sec-1',
      requestId: 'req-sec-1',
      eventId: 'evt-sec-1',
      turn: 1,
      expectedStateVersion: 1,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '마을에 상인이 찾아왔다.' }
        }
      ]
    });
    engine.submitProposal(prop);

    const snap = engine.getSnapshot();
    const hist = engine.getHistory();

    // Attack A: Inject tampered item into snapshot
    const tamperedSnapA: CanonicalState = JSON.parse(JSON.stringify(snap));
    tamperedSnapA.character.inventory.push({ id: 'dragon-slayer', name: '용살검', quantity: 1 });

    let rejectedA = false;
    try {
      SovereignEngine.hydrate(tamperedSnapA, hist, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedA = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
    }
    assert(rejectedA, 'Snapshot inventory forgery is strictly rejected via replay hash mismatch');

    // Attack B: Tamper character stats in snapshot
    const tamperedSnapB: CanonicalState = JSON.parse(JSON.stringify(snap));
    tamperedSnapB.character.stats.strength = 99;

    let rejectedB = false;
    try {
      SovereignEngine.hydrate(tamperedSnapB, hist, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedB = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
      if (!rejectedB) {
        console.error('Attack B caught unexpected error:', e.message);
      }
    }
    assert(rejectedB, 'Snapshot stats forgery is strictly rejected via replay hash mismatch');

    // Attack C: Tamper NPC in snapshot
    const tamperedSnapC: CanonicalState = JSON.parse(JSON.stringify(snap));
    tamperedSnapC.worldInfo.npcs.push({
      id: 'fake-npc',
      name: '가짜 NPC',
      location: '어딘가',
      status: 'ALIVE',
      innerThought: '비밀 계획',
      npcClass: 'Class A'
    });

    let rejectedC = false;
    try {
      SovereignEngine.hydrate(tamperedSnapC, hist, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedC = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
      if (!rejectedC) {
        console.error('Attack C caught unexpected error:', e.message);
      }
    }
    assert(rejectedC, 'Snapshot NPC injection is strictly rejected via replay hash mismatch');
  }

  // TEST 3: History Tampering Defense (Fail-Closed)
  {
    const engine = new SovereignEngine();
    const genesisSnap = engine.getGenesisSnapshot();

    const prop = buildTestProposal({
      proposalId: 'prop-hist-1',
      requestId: 'req-hist-1',
      eventId: 'evt-hist-1',
      turn: 1,
      expectedStateVersion: 1,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '소문 1' }
        }
      ]
    });
    engine.submitProposal(prop);

    const snap = engine.getSnapshot();
    const hist = engine.getHistory();

    // Attack A: Alter canonicalAction payload in history
    const tamperedHistA: ImmutableHistoricalRecord[] = JSON.parse(JSON.stringify(hist));
    tamperedHistA[0] = {
      ...tamperedHistA[0],
      canonicalAction: {
        type: 'ADD_RUMOR',
        payload: { rumor: '변조된 소문' }
      }
    };

    let rejectedA = false;
    try {
      SovereignEngine.hydrate(snap, tamperedHistA, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedA = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
    }
    assert(rejectedA, 'History action payload tampering is strictly rejected via replay hash mismatch');

    // Attack B: Strip canonicalAction payload from history
    const tamperedHistB: ImmutableHistoricalRecord[] = JSON.parse(JSON.stringify(hist));
    tamperedHistB[0] = {
      ...tamperedHistB[0],
      canonicalAction: undefined as any
    };

    let rejectedB = false;
    try {
      SovereignEngine.hydrate(snap, tamperedHistB, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedB = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
    }
    assert(rejectedB, 'Missing canonicalAction in history record is strictly rejected');

    // Attack C: Forge previousStateHash in history
    const tamperedHistC: ImmutableHistoricalRecord[] = JSON.parse(JSON.stringify(hist));
    tamperedHistC[0] = {
      ...tamperedHistC[0],
      previousStateHash: 'csh_ffffffffffffffff'
    };

    let rejectedC = false;
    try {
      SovereignEngine.hydrate(snap, tamperedHistC, undefined, undefined, genesisSnap);
    } catch (e: any) {
      rejectedC = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
    }
    assert(rejectedC, 'Forged previousStateHash in history is strictly rejected');
  }

  // TEST 4: Genesis Anchor Mismatch Defense (Fail-Closed)
  {
    const engine = new SovereignEngine();
    const prop = buildTestProposal({
      proposalId: 'prop-gen-1',
      requestId: 'req-gen-1',
      eventId: 'evt-gen-1',
      turn: 1,
      expectedStateVersion: 1,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '소문 1' }
        }
      ]
    });
    engine.submitProposal(prop);

    const snap = engine.getSnapshot();
    const hist = engine.getHistory();

    const forgedGenesis: CanonicalState = {
      stateVersion: 1,
      turn: 1,
      worldInfo: createEmptyWorldInfo(),
      character: { ...createEmptyCharacter(), name: '가짜 주인공' },
      lastCommittedEventId: null,
      lastCommittedAt: new Date().toISOString()
    };

    let rejected = false;
    try {
      SovereignEngine.hydrate(snap, hist, undefined, undefined, forgedGenesis);
    } catch (e: any) {
      rejected = e.message.includes('[HYDRATION_PROVENANCE_VIOLATION]');
    }
    assert(rejected, 'Mismatching genesis anchor hash is strictly rejected');
  }

  // TEST 5: Multi-generation Session Lifecycle & Genesis Anchor Immutability (Non-Drifting Anchor)
  {
    // Generation 0: Initial Creation
    const initialWorld = createEmptyWorldInfo();
    initialWorld.worldName = '창세의 땅';
    const initialChar = createEmptyCharacter();
    initialChar.name = '개척자';
    initialChar.stats.strength = 15;

    const engineGen0 = new SovereignEngine(initialWorld, initialChar);
    const genesisAnchor = engineGen0.getGenesisSnapshot();
    assert(genesisAnchor.stateVersion === 1, 'Gen0 Genesis anchor has stateVersion 1');
    assert(genesisAnchor.character.name === '개척자', 'Gen0 Genesis anchor has initial character name');

    // Turn 1 Action
    const prop1 = buildTestProposal({
      proposalId: 'prop-multi-1',
      requestId: 'req-multi-1',
      eventId: 'evt-multi-1',
      turn: 1,
      expectedStateVersion: 1,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '마을에 새로운 탐험가가 나타났다.' }
        }
      ]
    });
    const res1 = engineGen0.submitProposal(prop1);
    assert(res1.success, 'Gen 0 Proposal 1 commits cleanly');

    // Save Gen 0 -> Hydrate Gen 1
    const snap1 = engineGen0.getSnapshot();
    const hist1 = engineGen0.getHistory();
    const savedGenesis1 = engineGen0.getGenesisSnapshot();

    const engineGen1 = SovereignEngine.hydrate(snap1, hist1, undefined, undefined, savedGenesis1);
    const hydratedGenesis1 = engineGen1.getGenesisSnapshot();

    assert(hydratedGenesis1.stateVersion === 1, 'Gen1 preserved original Genesis stateVersion (1), not snapshot version (2)');
    assert(hydratedGenesis1.worldInfo.publicRumors.length === 0, 'Gen1 Genesis anchor is NOT polluted with Gen1 rumors');

    // Turn 2 Action on Gen 1: Add NPC
    const prop2 = buildTestProposal({
      proposalId: 'prop-multi-2',
      requestId: 'req-multi-2',
      eventId: 'evt-multi-2',
      turn: 2,
      expectedStateVersion: 2,
      actions: [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-elder',
            name: '촌장 엘론',
            location: '마을 광장',
            status: 'ALIVE',
            innerThought: '마을을 지켜야 한다.',
            npcClass: 'Class A'
          }
        }
      ]
    });
    const res2 = engineGen1.submitProposal(prop2);
    if (!res2.success) {
      console.error('res2 rejectedReasons:', res2.rejectedReasons, 'conflictDetails:', res2.conflictDetails);
    }
    assert(res2.success, 'Gen 1 Proposal 2 commits cleanly');

    // Save Gen 1 -> Hydrate Gen 2
    const snap2 = engineGen1.getSnapshot();
    const hist2 = engineGen1.getHistory();
    const savedGenesis2 = engineGen1.getGenesisSnapshot();

    assert(savedGenesis2.worldInfo.npcs.length === 0, 'Saved Genesis from Gen1 has 0 NPCs (true genesis)');

    const engineGen2 = SovereignEngine.hydrate(snap2, hist2, undefined, undefined, savedGenesis2);
    const hydratedGenesis2 = engineGen2.getGenesisSnapshot();

    assert(hydratedGenesis2.worldInfo.npcs.length === 0, 'Gen2 engine Genesis anchor maintains 0 NPCs (true genesis)');
    assert(engineGen2.getSnapshot().worldInfo.npcs.length === 1, 'Gen2 active snapshot reflects latest state (1 NPC)');

    // Turn 3 Action on Gen 2
    const prop3 = buildTestProposal({
      proposalId: 'prop-multi-3',
      requestId: 'req-multi-3',
      eventId: 'evt-multi-3',
      turn: 3,
      expectedStateVersion: 3,
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: '원로의 전설' }
        }
      ]
    });
    engineGen2.submitProposal(prop3);

    // Save Gen 2 -> Hydrate Gen 3
    const snap3 = engineGen2.getSnapshot();
    const hist3 = engineGen2.getHistory();
    const savedGenesis3 = engineGen2.getGenesisSnapshot();

    const engineGen3 = SovereignEngine.hydrate(snap3, hist3, undefined, undefined, savedGenesis3);
    assert(engineGen3.getSnapshot().stateVersion === 4, 'Gen3 successfully hydrated after 3 full generations of evolution');
    assert(engineGen3.getGenesisSnapshot().stateVersion === 1, 'Gen3 Genesis anchor is strictly anchored to true genesis (v=1)');
  }

  console.log('\n====================================================');
  console.log(`Summary: ${passed}/${total} Provenance & Replay Tests Passed.`);
  console.log('====================================================');
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

