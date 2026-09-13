import {
  getCandidateSemanticEvents,
  markSemanticFrontendOutput,
  validateSemanticCandidateOutput,
} from './semanticCandidateContract';
import {
  parseCandidatesBlock,
  runCandidateRecoveryGate,
  type VeilCandidate,
} from './candidateRecoveryGate';
import type { SemanticEvent } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

const validEvent: SemanticEvent = {
  eventId: 'evt-1',
  action: 'PICKUP',
  roles: [
    { role: 'SUBJECT', entityName: 'player', status: 'UNRESOLVED' },
    { role: 'OBJECT', entityName: 'coin', status: 'UNRESOLVED' },
  ],
  scope: 'PROPOSAL',
  polarity: 'ASSERTED',
  epistemicStatus: 'ASSERTED',
  modality: 'NONE',
};

function run(): void {
  console.log('\n=== LLM #1 Semantic Candidate Contract Tests ===\n');

  const valid = validateSemanticCandidateOutput({ semanticEvents: [validEvent] });
  assert(valid.valid, 'A structurally valid SemanticEvent payload passes');
  assert(valid.semanticEvents.length === 1, 'Validated payload preserves the event');

  const missingEventId = validateSemanticCandidateOutput({
    semanticEvents: [{ ...validEvent, eventId: '' }],
  });
  assert(!missingEventId.valid, 'Missing eventId is rejected at the structural boundary');

  const duplicateEventId = validateSemanticCandidateOutput({
    semanticEvents: [validEvent, { ...validEvent, action: 'GIFT' }],
  });
  assert(!duplicateEventId.valid, 'Duplicate eventId values are rejected before semantic routing');

  const badRole = validateSemanticCandidateOutput({
    semanticEvents: [{
      ...validEvent,
      roles: [{ role: 'NOT_A_ROLE', entityName: 'coin', status: 'UNRESOLVED' }],
    }],
  });
  assert(!badRole.valid, 'Unknown role vocabulary is rejected');

  const tooMany = validateSemanticCandidateOutput({
    semanticEvents: Array.from({ length: 9 }, (_, index) => ({
      ...validEvent,
      eventId: `evt-${index + 1}`,
    })),
  });
  assert(!tooMany.valid, 'Excessive semantic event count is rejected');

  const candidate = {
    candidateId: 'candidate-1',
    label: 'pickup',
    narrativeSummary: 'The player finds a coin.',
    rawMetadata: {},
    semanticEvents: [validEvent],
  };
  const extracted = getCandidateSemanticEvents(candidate);
  assert(extracted.length === 1, 'Candidate semantic events can be read without touching rawMetadata');
  assert(extracted[0].eventId === 'evt-1', 'Candidate semantic event identity is preserved');

  const candidateWithoutEvents = getCandidateSemanticEvents({
    candidateId: 'candidate-2',
    label: 'legacy',
    narrativeSummary: 'Legacy candidate.',
    rawMetadata: {},
  });
  assert(candidateWithoutEvents.length === 0, 'Legacy candidates without semanticEvents do not trigger fallback parsing');

  const marked = markSemanticFrontendOutput(
    {
      candidateId: 'candidate-3',
      turn: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      rawMetadataBlock: '{}',
    },
    [validEvent],
  );
  assert(marked.semanticEvents?.[0].action === 'PICKUP', 'Frontend output marker attaches only validated semantic events');

  let threw = false;
  try {
    markSemanticFrontendOutput(
      {
        candidateId: 'candidate-4',
        turn: 1,
        timestamp: '2026-01-01T00:00:00.000Z',
        rawMetadataBlock: '{}',
      },
      [{ ...validEvent, action: '' }],
    );
  } catch {
    threw = true;
  }
  assert(threw, 'Invalid semantic frontend output fails closed');

  // Test live Candidate Block JSON parsing & gate pass-through of top-level semanticEvents[]
  const rawBlock = `
[CANDIDATES_BLOCK]
[
  {
    "label": "단검 획득",
    "narrativeSummary": "바닥에 떨어진 단검을 줍는다.",
    "semanticEvents": [
      {
        "eventId": "ev_pickup_1",
        "action": "PICKUP",
        "roles": [
          { "role": "SUBJECT", "entityName": "플레이어" },
          { "role": "OBJECT", "entityName": "단검" }
        ],
        "scope": "PROPOSAL",
        "polarity": "ASSERTED",
        "epistemicStatus": "ASSERTED",
        "modality": "NONE"
      }
    ],
    "rawMetadata": {
      "foreshadowSeeds": ["단검의 비밀"]
    }
  }
]
[CANDIDATES_END]
`;
  const parsedBlock = parseCandidatesBlock(rawBlock);
  assert(parsedBlock !== null && parsedBlock.length === 1, 'parseCandidatesBlock parses JSON array with semanticEvents');
  const gated = runCandidateRecoveryGate<VeilCandidate>(parsedBlock);
  assert(gated.passedCount === 1, 'Candidate with valid top-level semanticEvents passes Candidate Recovery Gate');
  const passedCandidate = gated.passedCandidates[0];
  const extractedEvents = getCandidateSemanticEvents(passedCandidate);
  assert(extractedEvents.length === 1, 'Extracted semanticEvents matches parsed block');
  assert(extractedEvents[0].action === 'PICKUP', 'Extracted event action is PICKUP');
  assert(extractedEvents[0].eventId === 'ev_pickup_1', 'Extracted event eventId is ev_pickup_1');

  console.log('\nPASS: LLM #1 semantic candidate contract tests\n');
}

run();
