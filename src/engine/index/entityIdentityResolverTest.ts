import { CanonicalState } from '../types';
import { EntityReferenceBundle } from '../../types';
import { resolveInventoryItemIdentity } from './entityIdentityResolver';
import { runCandidateRecoveryGate } from '../language/candidateRecoveryGate';

function makeState(inventory: { id: string; name: string; quantity: number }[]): CanonicalState {
  return {
    stateVersion: 1,
    turn: 1,
    worldInfo: {
      worldName: 'Identity Test World',
      worldType: 'original_ip',
      settingDescription: 'test',
      npcs: [],
      factions: [],
      publicRumors: [],
      secretLore: [],
      seeds: [],
      chapters: { currentChapter: '1장', upcomingChapters: [] },
      dcHistory: [],
      unresolvedForeshadows: [],
      cameraOffscreenEvents: []
    },
    character: {
      name: '주인공', gender: 'X', age: 20, appearance: '', goal: '', originBackground: '',
      backgroundType: 'preset', flaw: '', flawType: 'preset', oath: '', oathType: 'preset',
      anchor: '', anchorType: 'preset', faction: '', factionType: 'preset',
      stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      inventory
    },
    lastCommittedEventId: null,
    lastCommittedAt: new Date().toISOString()
  };
}

const evidence = (claimedEntityId?: string): EntityReferenceBundle => ({
  entityType: 'ITEM',
  claimedEntityId,
  evidence: { context: 'identity regression test', cause: 'DISCOVERY_PICKUP' }
});

export function runEntityIdentityResolverTests(): { passed: number; failed: number; details: string[] } {
  const details: string[] = [];
  let passed = 0;
  let failed = 0;
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed++; details.push(`PASS: ${name}`); }
    else { failed++; details.push(`FAIL: ${name}`); }
  };

  const state = makeState([{ id: 'item-1', name: '은검', quantity: 1 }]);
  assert(resolveInventoryItemIdentity(state, [], '은검', evidence('item-1')).status === 'EXACT', 'matching ID + name => EXACT');
  assert(resolveInventoryItemIdentity(state, [], '은검', evidence()).status === 'RECOVERED', 'no ID + unique canonical name => RECOVERED');
  assert(resolveInventoryItemIdentity(state, [], '은검', evidence('item-404')).status === 'CONFLICT', 'unknown claimed ID => CONFLICT');
  assert(resolveInventoryItemIdentity(state, [], '다른 검', evidence('item-1')).status === 'CONFLICT', 'claimed ID/name mismatch => CONFLICT');
  assert(resolveInventoryItemIdentity(makeState([
    { id: 'item-1', name: '은검', quantity: 1 },
    { id: 'item-2', name: '은검', quantity: 1 }
  ]), [], '은검', evidence()).status === 'AMBIGUOUS', 'duplicate canonical names => AMBIGUOUS');
  assert(resolveInventoryItemIdentity(state, [], '황금검', evidence()).status === 'NOVEL', 'no matching identity => NOVEL');

  const validCandidate = {
    candidateId: 1,
    label: 'inventory',
    narrativeSummary: 'test',
    rawMetadata: {
      inventoryChanges: [{
        name: '은검', quantity: 1, action: 'add',
        entityReference: evidence('item-1')
      }]
    }
  };
  const missingBundle = {
    candidateId: 1,
    label: 'inventory',
    narrativeSummary: 'test',
    rawMetadata: { inventoryChanges: [{ name: '은검', quantity: 1, action: 'add' }] }
  };
  assert(runCandidateRecoveryGate([validCandidate]).passedCount === 1, 'gate accepts complete identity bundle');
  assert(runCandidateRecoveryGate([missingBundle]).quarantinedCount === 1, 'gate quarantines bare canonical item reference');

  return { passed, failed, details };
}
