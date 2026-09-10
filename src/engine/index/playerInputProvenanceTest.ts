import { buildSafeProposalFromCandidate, generateProposalId } from '../proposalParser.ts';
import { SovereignEngine } from '../state.ts';
import { CandidatePacket } from '../../types.ts';

function runTests() {
  console.log('=== Player Input Provenance & Candidate Selection Tests ===');

  const engine = new SovereignEngine();
  const snapshot = engine.getSnapshot();

  const realPlayerInputId = generateProposalId('input');
  const candidatePacket: CandidatePacket = {
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

  // Test 1: buildSafeProposalFromCandidate with real Player Input ID
  const proposal = buildSafeProposalFromCandidate(
    snapshot,
    candidatePacket,
    1,
    engine.getHistory(),
    realPlayerInputId
  );

  // Condition 1: source must be 'LLM'
  if (proposal.source !== 'LLM') {
    throw new Error(`Expected proposal.source to be 'LLM', got '${proposal.source}'`);
  }
  console.log('✓ Condition 1: proposal.source === "LLM" verified');

  // Condition 2: originInputId !== candidate.candidateId
  if (proposal.originInputId === candidatePacket.candidateId) {
    throw new Error(`Expected originInputId !== candidate.candidateId, got ${proposal.originInputId}`);
  }
  if (proposal.originInputId !== realPlayerInputId) {
    throw new Error(`Expected originInputId to be ${realPlayerInputId}, got ${proposal.originInputId}`);
  }
  console.log('✓ Condition 2: originInputId matches real Player Input ID and differs from candidateId');

  // Condition 3: Sovereign Commit Gate acceptance and History provenance
  const commitResult = engine.submitProposal(proposal);
  if (!commitResult.success) {
    throw new Error(`Expected commit to succeed, got errors: ${commitResult.rejectedReasons?.join('; ')}`);
  }
  console.log('✓ Condition 3: Sovereign Commit Gate successfully committed proposal');

  const history = engine.getHistory();
  const matchingRecords = history.filter(r => r.originInputId === realPlayerInputId);
  if (matchingRecords.length === 0) {
    throw new Error('Expected committed historical records to bear originInputId matching realPlayerInputId');
  }
  console.log(`✓ Condition 4: Committed ${matchingRecords.length} historical record(s) with Player Input ID provenance: ${realPlayerInputId}`);

  // Condition 5: Fallback when originInputId is omitted (backwards compatibility)
  const fallbackCandidate: CandidatePacket = {
    candidateId: 'cand-3',
    turn: 2,
    timestamp: new Date().toISOString()
  };
  const fallbackProposal = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    fallbackCandidate,
    2,
    engine.getHistory()
  );
  if (fallbackProposal.originInputId !== 'cand-3') {
    throw new Error(`Expected fallback originInputId to be cand-3, got ${fallbackProposal.originInputId}`);
  }
  if (fallbackProposal.source !== 'LLM') {
    throw new Error(`Expected fallbackProposal.source to be 'LLM', got '${fallbackProposal.source}'`);
  }
  console.log('✓ Condition 5: Fallback preserves candidateId when originInputId is omitted');

  console.log('=== Player Input Provenance & Candidate Selection Tests: ALL PASSED ===');
}

runTests();
