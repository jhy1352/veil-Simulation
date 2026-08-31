import { buildCanonIndex, buildHistoricalIndex } from '../index/indexer';
import { readWorldMemory } from './memoryAccessGate';

const snapshot: any = {
  worldInfo: { npcs: [], factions: [] }
};

const canonIndex = buildCanonIndex({
  worldName: 'Test World',
  settingDescription: 'A test setting',
  publicRumors: ['A public rumor.'],
  secretLore: ['A private secret.']
});
const historicalIndex = buildHistoricalIndex([]);

// An untrusted LLM request cannot widen its own visibility scope.
const result = readWorldMemory(
  { queryText: 'secret', visibilityFilter: ['PRIVATE', 'HIDDEN'] } as any,
  canonIndex,
  historicalIndex,
  snapshot
);

if (!result.granted) throw new Error('Expected memory read to be handled.');
if (result.results.some(r => r.content.includes('private secret'))) {
  throw new Error('LLM-supplied visibility widened the memory scope.');
}

// Only an engine-owned policy can explicitly widen visibility.
const privileged = readWorldMemory(
  { queryText: 'secret' },
  canonIndex,
  historicalIndex,
  snapshot,
  { allowedVisibility: ['PRIVATE'], maxResults: 5 }
);

if (!privileged.granted || !privileged.results.some(r => r.content.includes('private secret'))) {
  throw new Error('Engine-owned visibility policy was not honored.');
}

console.log('Memory access boundary tests passed.');
