import {
  HistoricalRecord,
  CandidatePacket,
  ValidationResult,
  InformationAccessBoundary,
  EngineState,
  WorldInfo,
  Character,
  NpcRecord,
  FactionRecord,
  NarrativeSeed,
  ValidationDiagnosticLog,
  DEFAULT_NPC_CLASS,
  DEFAULT_CHAPTER_NAME
} from '../types';

export function generateRecordId(prefix: string = 'rec'): string {
  const array = new Uint32Array(2);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    array[0] = Math.floor(Math.random() * 0xFFFFFFFF);
    array[1] = Math.floor(Math.random() * 0xFFFFFFFF);
  }
  return `${prefix}-${Date.now().toString(36)}-${array[0].toString(36)}${array[1].toString(36)}`;
}

export function extractCandidatesFromMetadata(
  metaData: any,
  storyTurnCount: number,
  currentNarrativeDate?: string,
  canonicalCandidateId?: string | number
): CandidatePacket {
  const candidateId = canonicalCandidateId !== undefined && canonicalCandidateId !== null
    ? String(canonicalCandidateId)
    : generateRecordId('cand');
  const timestamp = new Date().toISOString();
  const narrativeDate = currentNarrativeDate || `Turn ${storyTurnCount}`;

  const npcChanges: CandidatePacket['npcChanges'] = [];
  const factionChanges: CandidatePacket['factionChanges'] = [];
  const seedChanges: CandidatePacket['seedChanges'] = [];
  const offscreenEvents: CandidatePacket['offscreenEvents'] = [];
  const inventoryChanges: CandidatePacket['inventoryChanges'] = [];
  const statChanges: CandidatePacket['statChanges'] = [];
  let recommendedDC: number | undefined = metaData?.recommendedDC;

  if (metaData?.foreshadowSeeds && Array.isArray(metaData.foreshadowSeeds)) {
    metaData.foreshadowSeeds.forEach((seedText: string) => {
      const trimmed = typeof seedText === 'string' ? seedText.trim() : '';
      if (trimmed) seedChanges.push({ content: trimmed, status: 'active', action: 'create' });
    });
  }

  if (metaData?.resolvedSeeds && Array.isArray(metaData.resolvedSeeds)) {
    metaData.resolvedSeeds.forEach((res: any) => {
      if (res && res.content) {
        seedChanges.push({
          content: String(res.content).trim(),
          status: 'resolved',
          action: 'resolve',
          resolutionSummary: res.resolutionSummary ? String(res.resolutionSummary).trim() : undefined
        });
      }
    });
  }

  if (metaData?.cameraOffscreenEvents && Array.isArray(metaData.cameraOffscreenEvents)) {
    metaData.cameraOffscreenEvents.forEach((ev: string) => {
      const trimmed = typeof ev === 'string' ? ev.trim() : '';
      if (trimmed) offscreenEvents.push({ event: trimmed, informationAccess: 'FACTION' });
    });
  }

  if (metaData?.newNpcs && Array.isArray(metaData.newNpcs)) {
    metaData.newNpcs.forEach((npc: any) => {
      if (npc.name && typeof npc.name === 'string' && npc.name.trim()) {
        const isDead = npc.isDead === true || npc.status === 'DEAD' || npc.currentStatus === 'DEAD';
        npcChanges.push({
          name: npc.name.trim(),
          alias: npc.alias?.trim(),
          npcClass: npc.npcClass || DEFAULT_NPC_CLASS,
          innerThought: npc.innerThought || '[미인지 상태]',
          metInStory: npc.metInStory ?? false,
          isDead,
          origin: npc.origin?.trim(),
          background: npc.background?.trim(),
          martialArts: npc.martialArts?.trim(),
          values: npc.values?.trim(),
          affiliation: npc.affiliation?.trim(),
          informationAccess: npc.metInStory ? 'PROTAGONIST_KNOWN' : 'UNKNOWN'
        });
      }
    });
  }

  if (metaData?.newFactions && Array.isArray(metaData.newFactions)) {
    metaData.newFactions.forEach((fac: any) => {
      if (fac.name && typeof fac.name === 'string' && fac.name.trim()) {
        factionChanges.push({
          name: fac.name.trim(),
          description: fac.description || '',
          attitudeTowardsPlayer: fac.attitudeTowardsPlayer,
          informationAccess: 'PUBLIC'
        });
      }
    });
  }

  let chapterChanges: { currentChapter?: string; upcomingChapters?: string[] } | undefined = undefined;
  if (metaData?.currentChapter || (metaData?.upcomingChapters && metaData.upcomingChapters.length > 0)) {
    chapterChanges = {
      currentChapter: metaData.currentChapter,
      upcomingChapters: metaData.upcomingChapters ? [...metaData.upcomingChapters] : undefined
    };
  }

  if (metaData?.inventoryChanges && Array.isArray(metaData.inventoryChanges)) {
    metaData.inventoryChanges.forEach((inv: any) => {
      if (typeof inv === 'object' && inv !== null && inv.name) {
        const cause = inv.cause || inv.acquisition?.cause;
        const cost = inv.cost || inv.acquisition?.cost;
        const verifiedEventId = inv.verifiedEventId || inv.acquisition?.verifiedEventId;
        inventoryChanges.push({
          name: String(inv.name).trim(),
          quantity: typeof inv.quantity === 'number' && !isNaN(inv.quantity) ? Math.max(1, inv.quantity) : 1,
          action: inv.action === 'remove' || inv.operation === 'REMOVE' ? 'remove' : 'add',
          entityReference: inv.entityReference,
          ...(cause ? {
            cause,
            verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined,
            acquisition: {
              cause,
              cost: cost && typeof cost === 'object' ? {
                id: typeof cost.id === 'string' ? cost.id : undefined,
                name: typeof cost.name === 'string' ? cost.name : undefined,
                quantity: typeof cost.quantity === 'number' ? Math.max(1, cost.quantity) : 1
              } : undefined,
              sourceNpcId: typeof inv.acquisition?.sourceNpcId === 'string' ? inv.acquisition.sourceNpcId : undefined,
              context: typeof inv.acquisition?.context === 'string' ? inv.acquisition.context : undefined,
              verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined
            }
          } : (verifiedEventId ? {
            verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined,
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              sourceNpcId: typeof inv.acquisition?.sourceNpcId === 'string' ? inv.acquisition.sourceNpcId : undefined,
              context: typeof inv.acquisition?.context === 'string' ? inv.acquisition.context : undefined,
              verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined
            }
          } : {}))
        });
      }
    });
  }

  if (metaData?.statDeltas && Array.isArray(metaData.statDeltas)) {
    metaData.statDeltas.forEach((sd: any) => {
      if (sd.stat && typeof sd.delta === 'number' && !isNaN(sd.delta)) statChanges.push({ stat: sd.stat, delta: sd.delta });
    });
  }

  return {
    candidateId,
    turn: storyTurnCount,
    narrativeDate,
    timestamp,
    npcChanges,
    factionChanges,
    seedChanges,
    offscreenEvents,
    chapterChanges,
    inventoryChanges,
    statChanges,
    recommendedDC,
    rawMetadataBlock: metaData ? JSON.stringify(metaData) : undefined
  };
}

export function validateEngineCandidate(
  candidate: CandidatePacket,
  worldInfo: WorldInfo,
  character: Character,
  historicalRecords: HistoricalRecord[] = []
): ValidationResult {
  const rejectedReasons: string[] = [];
  const sanitizedCandidate: CandidatePacket = {
    ...candidate,
    npcChanges: [],
    factionChanges: [],
    seedChanges: [],
    offscreenEvents: [],
    inventoryChanges: [],
    statChanges: []
  };

  if (candidate.npcChanges && candidate.npcChanges.length > 0) {
    for (const npcCand of candidate.npcChanges) {
      if (!npcCand.name || !npcCand.name.trim()) {
        rejectedReasons.push('NPC candidate missing valid name');
        continue;
      }
      const isDeadHistorically = historicalRecords.some(
        r => r.recordType === 'NPC_STATE_CHANGED' && r.involvedCharacterIds.includes(npcCand.name) && (r.payload as any)?.isDead === true
      );
      if (isDeadHistorically && !npcCand.isDead) {
        rejectedReasons.push(`Refusing to resurrect canonically deceased NPC: ${npcCand.name}`);
        continue;
      }
      const sanitizedNpc = { ...npcCand };
      if (!sanitizedNpc.metInStory) {
        sanitizedNpc.innerThought = '[미인지 상태]';
        sanitizedNpc.informationAccess = sanitizedNpc.informationAccess || 'UNKNOWN';
      } else {
        sanitizedNpc.informationAccess = sanitizedNpc.informationAccess || 'PROTAGONIST_KNOWN';
      }
      sanitizedCandidate.npcChanges?.push(sanitizedNpc);
    }
  }

  if (candidate.seedChanges && candidate.seedChanges.length > 0) {
    const existingActiveSeedCount = worldInfo.seeds.filter(s => s.status === 'active').length;
    const allowedSeedSlots = Math.max(0, 3 - existingActiveSeedCount);
    for (const seed of candidate.seedChanges) {
      if (!seed.content || !seed.content.trim()) {
        rejectedReasons.push('Seed candidate missing content');
        continue;
      }
      const isDuplicate = worldInfo.seeds.some(s => s.content.trim() === seed.content.trim());
      if (isDuplicate) {
        rejectedReasons.push(`Ignoring duplicate seed: "${seed.content.substring(0, 20)}..."`);
        continue;
      }
      if (sanitizedCandidate.seedChanges!.length >= allowedSeedSlots) continue;
      sanitizedCandidate.seedChanges?.push(seed);
    }
  }

  if (candidate.offscreenEvents && candidate.offscreenEvents.length > 0) {
    for (const off of candidate.offscreenEvents) {
      if (!off.event || !off.event.trim()) continue;
      if (worldInfo.cameraOffscreenEvents.includes(off.event.trim())) continue;
      sanitizedCandidate.offscreenEvents?.push(off);
    }
  }

  if (candidate.recommendedDC !== undefined) {
    if (typeof candidate.recommendedDC === 'number' && candidate.recommendedDC >= 1 && candidate.recommendedDC <= 20) {
      sanitizedCandidate.recommendedDC = Math.round(candidate.recommendedDC);
    } else {
      rejectedReasons.push(`DC ${candidate.recommendedDC} out of valid range (1-20). Clamped.`);
      sanitizedCandidate.recommendedDC = Math.max(1, Math.min(20, Math.round(candidate.recommendedDC || 10)));
    }
  }

  if (candidate.chapterChanges) {
    const cur = candidate.chapterChanges.currentChapter?.trim();
    const up = candidate.chapterChanges.upcomingChapters?.map(c => c.trim()).filter(Boolean) || [];
    sanitizedCandidate.chapterChanges = {
      currentChapter: cur || worldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME,
      upcomingChapters: up.slice(0, 3)
    };
  }

  if (candidate.inventoryChanges && candidate.inventoryChanges.length > 0) {
    for (const inv of candidate.inventoryChanges) {
      if (!inv.name || !inv.name.trim()) continue;
      if (!inv.entityReference) {
        rejectedReasons.push(`Inventory item '${inv.name.trim()}' missing entityReference bundle.`);
        continue;
      }
      sanitizedCandidate.inventoryChanges?.push({
        name: inv.name.trim(),
        quantity: typeof inv.quantity === 'number' && !isNaN(inv.quantity) ? Math.max(1, inv.quantity) : 1,
        action: inv.action === 'remove' ? 'remove' : 'add',
        entityReference: inv.entityReference,
        acquisition: inv.acquisition,
        cause: inv.cause,
        cost: inv.cost,
        verifiedEventId: inv.verifiedEventId
      });
    }
  }

  if (candidate.statChanges && candidate.statChanges.length > 0) {
    for (const sc of candidate.statChanges) {
      if (sc.stat && typeof sc.delta === 'number' && !isNaN(sc.delta)) sanitizedCandidate.statChanges?.push(sc);
    }
  }

  return {
    isValid: rejectedReasons.length === 0,
    candidateId: candidate.candidateId,
    sanitizedCandidate,
    rejectedReasons
  };
}

export function createHistoricalRecordsFromCandidate(candidate: CandidatePacket, storyTurnCount: number): HistoricalRecord[] {
  const records: HistoricalRecord[] = [];
  const createdAt = new Date().toISOString();
  const narrativeDate = candidate.narrativeDate || `Turn ${storyTurnCount}`;

  if (candidate.seedChanges) {
    candidate.seedChanges.forEach((seed, idx) => {
      records.push({
        recordId: generateRecordId(`rec-seed-${idx}`),
        recordType: 'NARRATIVE_SEED_CREATED',
        turn: storyTurnCount,
        narrativeDate,
        createdAt,
        involvedCharacterIds: [],
        involvedFactionIds: [],
        source: 'AI_GM_METADATA',
        status: 'CANONICAL',
        causalParentIds: [],
        relatedRecordIds: [],
        informationAccess: 'PROTAGONIST_KNOWN',
        payload: { content: seed.content, seedStatus: seed.status }
      });
    });
  }

  if (candidate.offscreenEvents) {
    candidate.offscreenEvents.forEach((ev, idx) => {
      records.push({
        recordId: generateRecordId(`rec-off-${idx}`),
        recordType: 'OFFSCREEN_WORLD_EVENT',
        turn: storyTurnCount,
        narrativeDate,
        createdAt,
        involvedCharacterIds: [],
        involvedFactionIds: [],
        source: 'AI_GM_METADATA',
        status: 'CANONICAL',
        causalParentIds: [],
        relatedRecordIds: [],
        informationAccess: ev.informationAccess || 'FACTION',
        payload: { eventText: ev.event }
      });
    });
  }

  if (candidate.npcChanges) {
    candidate.npcChanges.forEach((npc, idx) => {
      records.push({
        recordId: generateRecordId(`rec-npc-${idx}`),
        recordType: npc.isDead ? 'NPC_DECEASED' : 'NPC_REGISTERED',
        turn: storyTurnCount,
        narrativeDate,
        createdAt,
        involvedCharacterIds: [npc.name],
        involvedFactionIds: npc.affiliation ? [npc.affiliation] : [],
        source: 'AI_GM_METADATA',
        status: 'CANONICAL',
        causalParentIds: [],
        relatedRecordIds: [],
        informationAccess: npc.informationAccess || (npc.metInStory ? 'PROTAGONIST_KNOWN' : 'UNKNOWN'),
        payload: npc
      });
    });
  }

  if (candidate.recommendedDC !== undefined) {
    records.push({
      recordId: generateRecordId('rec-dc'),
      recordType: 'DC_RECORDED',
      turn: storyTurnCount,
      narrativeDate,
      createdAt,
      involvedCharacterIds: [],
      involvedFactionIds: [],
      source: 'AI_GM_METADATA',
      status: 'CANONICAL',
      causalParentIds: [],
      relatedRecordIds: [],
      informationAccess: 'PUBLIC',
      payload: { recommendedDC: candidate.recommendedDC }
    });
  }

  if (candidate.chapterChanges) {
    records.push({
      recordId: generateRecordId('rec-roadmap'),
      recordType: 'ROADMAP_UPDATED',
      turn: storyTurnCount,
      narrativeDate,
      createdAt,
      involvedCharacterIds: [],
      involvedFactionIds: [],
      source: 'AI_GM_METADATA',
      status: 'CANONICAL',
      causalParentIds: [],
      relatedRecordIds: [],
      informationAccess: 'PUBLIC',
      payload: {
        currentChapter: candidate.chapterChanges.currentChapter,
        upcomingChapters: candidate.chapterChanges.upcomingChapters
      }
    });
  }

  return records;
}

export function projectCanonicalState(
  prevWorldInfo: WorldInfo,
  prevCharacter: Character,
  validatedCandidate: CandidatePacket,
  newRecords: HistoricalRecord[]
): { nextWorldInfo: WorldInfo; nextCharacter: Character } {
  let nextWorldInfo: WorldInfo = {
    ...prevWorldInfo,
    seeds: [...prevWorldInfo.seeds],
    cameraOffscreenEvents: [...prevWorldInfo.cameraOffscreenEvents],
    dcHistory: [...prevWorldInfo.dcHistory],
    npcs: [...prevWorldInfo.npcs],
    factions: [...prevWorldInfo.factions],
    chapters: prevWorldInfo.chapters ? { ...prevWorldInfo.chapters, upcomingChapters: [...(prevWorldInfo.chapters.upcomingChapters || [])] } : { currentChapter: DEFAULT_CHAPTER_NAME, upcomingChapters: [] }
  };

  let nextCharacter: Character = {
    ...prevCharacter,
    inventory: [...prevCharacter.inventory],
    stats: { ...prevCharacter.stats }
  };

  if (validatedCandidate.seedChanges && validatedCandidate.seedChanges.length > 0) {
    const newSeeds: NarrativeSeed[] = validatedCandidate.seedChanges.map((sc, i) => ({
      id: generateRecordId(`seed-${i}`), content: sc.content, status: sc.status, turnCreated: validatedCandidate.turn
    }));
    const activeExisting = nextWorldInfo.seeds.filter(s => s.status === 'active').slice(-2);
    const dormantExisting = nextWorldInfo.seeds.filter(s => s.status !== 'active');
    nextWorldInfo.seeds = [...dormantExisting, ...activeExisting, ...newSeeds];
  }

  if (validatedCandidate.offscreenEvents && validatedCandidate.offscreenEvents.length > 0) {
    nextWorldInfo.cameraOffscreenEvents = [...nextWorldInfo.cameraOffscreenEvents, ...validatedCandidate.offscreenEvents.map(e => e.event)];
  }

  if (validatedCandidate.recommendedDC !== undefined) nextWorldInfo.dcHistory = [...nextWorldInfo.dcHistory, validatedCandidate.recommendedDC];

  if (validatedCandidate.chapterChanges) {
    nextWorldInfo.chapters = {
      currentChapter: validatedCandidate.chapterChanges.currentChapter || nextWorldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME,
      upcomingChapters: (validatedCandidate.chapterChanges.upcomingChapters || nextWorldInfo.chapters?.upcomingChapters || []).slice(0, 3)
    };
  }

  if (validatedCandidate.npcChanges && validatedCandidate.npcChanges.length > 0) {
    validatedCandidate.npcChanges.forEach(candNpc => {
      const idx = nextWorldInfo.npcs.findIndex(n => n.name === candNpc.name);
      if (idx >= 0) {
        nextWorldInfo.npcs[idx] = {
          ...nextWorldInfo.npcs[idx],
          ...candNpc,
          innerThought: candNpc.metInStory ? (candNpc.innerThought || nextWorldInfo.npcs[idx].innerThought) : '[미인지 상태]'
        };
      } else {
        nextWorldInfo.npcs.push({
          id: generateRecordId('npc'), name: candNpc.name, alias: candNpc.alias,
          npcClass: candNpc.npcClass || DEFAULT_NPC_CLASS,
          innerThought: candNpc.metInStory ? (candNpc.innerThought || '') : '[미인지 상태]',
          metInStory: candNpc.metInStory ?? false, origin: candNpc.origin, background: candNpc.background,
          martialArts: candNpc.martialArts, values: candNpc.values, affiliation: candNpc.affiliation
        });
      }
    });
  }

  return { nextWorldInfo, nextCharacter };
}
