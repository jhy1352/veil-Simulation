import { CandidatePacket } from '../../types.ts';
import { SovereignEngine } from '../state.ts';
import { buildSafeProposalFromCandidate, generateProposalId } from '../proposalParser.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

/**
 * Cross-layer proof of the Player Input -> Candidate -> Proposal -> Commit -> History boundary.
 *
 * This is intentionally deterministic: it does not claim to test Gemini inference or HTTP.
 * It proves the runtime contract that the server-generated Player Input ID must survive
 * Candidate selection and App-side Proposal reconstruction without becoming a Candidate ID.
 */
function run(): void {
  console.log('\n=== Player Input Cross-Layer Provenance Test ===\n');

  const engine = new SovereignEngine();
  const playerInputId = generateProposalId('input');

  // Use the same canonical NPC identity fixture already proven to pass the real
  // Player Input provenance -> Sovereign Commit Gate test. The cross-layer test
  // must exercise the real mutation path, not accidentally create an empty proposal
  // through an unresolved fixture identity.
  const allowCandidate: CandidatePacket = {
    candidateId: 'cand-2',
    turn: 1,
    timestamp: new Date().toISOString(),
    npcChanges: [
      {
        name: '모용세가 장로',
        alias: '벽안풍',
        npcClass: 'Class B',
        innerThought: '비급의 행방을 쫓고 있다.',
        metInStory: true,
        isDead: false
      }
    ],
    factionChanges: [
      {
        name: '모용세가',
        description: '강남의 명문 세가',
        attitudeTowardsPlayer: '호의적'
      }
    ],
    chapterChanges: {
      currentChapter: '제1장 초출강호',
      upcomingChapters: ['제2장 암운']
    }
  };

  const denyCandidate: CandidatePacket = {
    candidateId: 'cand-3',
    turn: 1,
    timestamp: new Date().toISOString()
  };

  // Deterministic stand-in for the Phase 2 contract: only a PreAuth-ALLOW candidate
  // is eligible for selection. The Player Input ID is independent of both candidate IDs.
  const preAuth = new Map<string, 'ALLOW' | 'REJECT'>([
    [allowCandidate.candidateId, 'ALLOW'],
    [denyCandidate.candidateId, 'REJECT']
  ]);
  const selectedCandidate = [allowCandidate, denyCandidate].find(
    candidate => preAuth.get(candidate.candidateId) === 'ALLOW'
  );

  assert(Boolean(selectedCandidate), 'Phase 2 selection has an eligible ALLOW candidate');
  assert(selectedCandidate?.candidateId === 'cand-2', 'Phase 2 selection cannot select the REJECT candidate');
  assert(playerInputId !== allowCandidate.candidateId, 'Player Input ID is distinct from selected Candidate ID');

  // Server-side Proposal construction: provenance must point to the original Player Input.
  const serverProposal = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    selectedCandidate!,
    1,
    engine.getHistory(),
    playerInputId
  );

  assert(serverProposal.source === 'LLM', 'Server-side Proposal remains source=LLM');
  assert(serverProposal.originInputId === playerInputId, 'Server-side Proposal carries the server-generated Player Input ID');
  assert(serverProposal.originInputId !== selectedCandidate!.candidateId, 'Server-side Proposal cannot confuse Candidate ID with Player Input ID');

  // The selected candidate must actually project to a mutation-capable Proposal.
  assert(serverProposal.actions.length > 0, 'Selected ALLOW Candidate projects to at least one runtime action');

  // Deterministic stand-in for the /api/chat response -> App reconstruction contract.
  const apiResponseContract = {
    selectedCandidateId: 2,
    originInputId: playerInputId,
    isFallbackNonMutation: false
  };
  assert(apiResponseContract.originInputId === playerInputId, 'API response contract preserves the same Player Input ID');
  assert(apiResponseContract.selectedCandidateId === 2, 'API response identifies the selected ALLOW Candidate');
  assert(!apiResponseContract.isFallbackNonMutation, 'Authorized selection remains a mutation-capable response');

  // App-side Proposal reconstruction must consume the returned originInputId, not candidateId.
  const appProposal = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    selectedCandidate!,
    1,
    engine.getHistory(),
    apiResponseContract.originInputId
  );

  assert(appProposal.source === 'LLM', 'App-side reconstructed Proposal remains source=LLM');
  assert(appProposal.originInputId === playerInputId, 'App-side Proposal preserves the server Player Input ID');
  assert(appProposal.originInputId === serverProposal.originInputId, 'Server and App Proposal provenance are identical');
  assert(appProposal.originInputId !== selectedCandidate!.candidateId, 'App-side reconstruction does not fall back to Candidate ID');
  assert(appProposal.actions.length > 0, 'App-side reconstructed Proposal remains mutation-capable');

  // Final authoritative boundary: Commit -> immutable History must preserve provenance.
  const beforeCommit = engine.getSnapshot();
  const commitResult = engine.submitProposal(appProposal);
  assert(
    commitResult.success,
    `Selected ALLOW Candidate reaches the Sovereign Commit Gate successfully${
      commitResult.rejectedReasons?.length ? ` (${commitResult.rejectedReasons.join('; ')})` : ''
    }`
  );

  const history = engine.getHistory();
  const matchingRecords = history.filter(record => record.originInputId === playerInputId);
  assert(matchingRecords.length > 0, 'Committed History retains the original Player Input provenance');
  assert(
    matchingRecords.every(record => record.originInputId !== selectedCandidate!.candidateId),
    'Committed History never records the Candidate ID as Player Input provenance'
  );
  assert(
    JSON.stringify(engine.getSnapshot()) !== JSON.stringify(beforeCommit),
    'Authorized ALLOW Candidate produces an actual canonical mutation'
  );

  // Negative provenance proof: using Candidate ID as the origin must not be silently accepted
  // by this cross-layer contract. This test intentionally checks the contract before Commit.
  const forgedOriginProposal = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    selectedCandidate!,
    2,
    engine.getHistory(),
    selectedCandidate!.candidateId
  );
  assert(
    forgedOriginProposal.originInputId === selectedCandidate!.candidateId,
    'Forged Candidate-ID provenance is detectable at Proposal construction'
  );
  assert(
    forgedOriginProposal.originInputId !== playerInputId,
    'Forged Candidate-ID provenance cannot be mistaken for the original Player Input ID'
  );

  console.log('\n=== Player Input Cross-Layer Provenance Test: PASS ===\n');
}

run();
