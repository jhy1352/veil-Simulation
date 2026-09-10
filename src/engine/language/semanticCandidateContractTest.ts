import {
  getCandidateSemanticEvents,
  markSemanticFrontendOutput,
  validateSemanticCandidateOutput,
} from './semanticCandidateContract';
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

  console.log('\nPASS: LLM #1 semantic candidate contract tests\n');
}

run();
