import { buildCanonIndex, buildHistoricalIndex } from '../index/indexer';
import { readWorldMemory } from './memoryAccessGate';

const snapshot: any = {
  worldInfo: { npcs: [], factions: [] },
  character: { inventory: [] }
};

const canonIndex = buildCanonIndex({
  worldName: 'Test World',
  settingDescription: 'A test setting',
  publicRumors: ['A rumor is circulating.'],
  secretLore: ['A private secret.']
});
const historicalIndex = buildHistoricalIndex([]);

const result = readWorldMemory(
  { queryText: 'rumor', visibilityFilter: ['PRIVATE'] } as any,
  canonIndex,
  historicalIndex,
  snapshot
);

if (!result.granted) throw new Error('Expected read request to be handled.');
if (result.results.some(r => r.content.includes('private secret'))) {
  throw new Error('LLM-supplied visibility must not expose PRIVATE memory.');
}

console.log('Memory access boundary smoke test passed.');
