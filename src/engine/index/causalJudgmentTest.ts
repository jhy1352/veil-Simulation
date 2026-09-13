import {
  CausalSource,
  classifyAcquisitionSource,
  resolveCausalJudgment,
} from './causalJudgment';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

function run(): void {
  console.log('\n=== Minimal Causal Judgment Boundary Tests ===\n');

  const novel: CausalSource = { kind: 'NOVEL_EVENT' };
  const existing: CausalSource = { kind: 'EXISTING_EVENT', eventId: 'evt-existing-gift' };

  const classifiedNovel = classifyAcquisitionSource();
  assert(classifiedNovel.kind === 'NOVEL_EVENT', 'Missing event id is explicitly classified as NOVEL_EVENT');

  const classifiedExisting = classifyAcquisitionSource('  evt-existing-gift  ');
  assert(classifiedExisting.kind === 'EXISTING_EVENT', 'Existing event id is explicitly classified as EXISTING_EVENT');
  assert(classifiedExisting.eventId === 'evt-existing-gift', 'Existing event id is normalized before classification');

  const ordinaryNovelEvent = resolveCausalJudgment(novel, {
    humanNaturalness: 'VALID',
    worldCompatibility: 'VALID',
    causalPlausibility: 'VALID',
    specificityGrounding: 'VALID',
  });
  assert(ordinaryNovelEvent.status === 'VALID', 'Ordinary novel event can be valid without a prior event id');
  assert(ordinaryNovelEvent.source.kind === 'NOVEL_EVENT', 'Novel judgment preserves NOVEL_EVENT source authority');

  const weaklyGroundedNovelEvent = resolveCausalJudgment(novel, {
    humanNaturalness: 'VALID',
    worldCompatibility: 'UNKNOWN',
    causalPlausibility: 'VALID',
    specificityGrounding: 'VALID',
  });
  assert(weaklyGroundedNovelEvent.status === 'UNKNOWN', 'Insufficient world grounding remains UNKNOWN rather than INVALID');

  const unnaturalNovelEvent = resolveCausalJudgment(novel, {
    humanNaturalness: 'INVALID',
    worldCompatibility: 'VALID',
    causalPlausibility: 'VALID',
    specificityGrounding: 'VALID',
  });
  assert(unnaturalNovelEvent.status === 'INVALID', 'Explicitly invalid human naturalness rejects the novel event');

  const unrelatedExistingEvent = resolveCausalJudgment(existing, {
    humanNaturalness: 'VALID',
    worldCompatibility: 'VALID',
    causalPlausibility: 'VALID',
    specificityGrounding: 'VALID',
    provenance: 'INVALID',
  });
  assert(unrelatedExistingEvent.status === 'INVALID', 'Existing-event provenance remains a hard authority boundary');
  assert(unrelatedExistingEvent.source.eventId === 'evt-existing-gift', 'Existing event id is preserved for provenance checks');

  const missingProvenance = resolveCausalJudgment(existing, {
    humanNaturalness: 'VALID',
    worldCompatibility: 'VALID',
    causalPlausibility: 'VALID',
    specificityGrounding: 'VALID',
    provenance: 'UNKNOWN',
  });
  assert(missingProvenance.status === 'UNKNOWN', 'Missing existing-event provenance is UNKNOWN, not automatically INVALID');

  console.log('\nPASS: causal judgment boundary tests\n');
}

run();