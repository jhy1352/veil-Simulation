import { buildSafeProposalFromCandidate } from './proposalParser';
import type { CandidatePacket } from '../types';
import type { CanonicalState } from './types';

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

const canonicalState = {
  stateVersion: 2,
  turn: 2,
  worldInfo: {
    worldName: 'test',
    worldType: 'custom_world',
    settingDescription: '',
    npcs: [],
    factions: [],
    publicRumors: [],
    secretLore: [],
    seeds: [],
    chapters: { currentChapter: '서막', upcomingChapters: [] },
    dcHistory: [],
    unresolvedForeshadows: [],
    cameraOffscreenEvents: [],
    offscreenRecords: []
  },
  character: {
    name: 'Player',
    gender: '',
    age: 0,
    appearance: '',
    goal: '',
    originBackground: '',
    backgroundType: 'preset',
    flaw: '',
    flawType: 'preset',
    oath: '',
    oathType: 'preset',
    anchor: '',
    anchorType: 'preset',
    faction: '',
    factionType: 'preset',
    stats: {
      strength: 10,
      agility: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    },
    inventory: []
  },
  lastCommittedEventId: 'evt-1',
  lastCommittedAt: new Date().toISOString()
} as CanonicalState;

const baseCandidate = {
  candidateId: 'candidate-test',
  turn: 2,
  timestamp: new Date().toISOString(),
  chapterChanges: {
    currentChapter: '다음 장',
    upcomingChapters: ['후속 장']
  }
} as CandidatePacket & { semanticEvents?: unknown[] };

const deniedDerived = buildSafeProposalFromCandidate(
  canonicalState,
  baseCandidate,
  2,
  [],
  'player-input-test'
);

assertEqual(
  deniedDerived.actions.length,
  0,
  'chapterChanges without explicit semantic player-intent binding must produce zero canonical actions'
);

const explicitIntentCandidate = {
  ...baseCandidate,
  semanticEvents: [
    {
      eventId: 'sem-chapter-1',
      action: 'ADVANCE_CHAPTER',
      roles: [],
      scope: 'INTENT',
      polarity: 'ASSERTED',
      epistemicStatus: 'ASSERTED',
      modality: 'INTENTIONAL'
    }
  ]
};

const explicitlyBound = buildSafeProposalFromCandidate(
  canonicalState,
  explicitIntentCandidate,
  2,
  [],
  'player-input-test'
);

assertEqual(
  explicitlyBound.actions.map(action => action.type),
  ['ADVANCE_CHAPTER'],
  'explicit ADVANCE_CHAPTER semantic intent must preserve chapter mutation'
);

console.log('PASS: DENY-derived chapter mutation binding regression test');
