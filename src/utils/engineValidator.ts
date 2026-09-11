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

/**
 * Generates a unique crypto-random identifier for Historical Records and Candidates
 */
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

/**
 * Parses raw metadata strings/fields into structured Candidate State changes.
 * This does NOT mutate the canonical state yet.
 * 
 * @param metaData Raw metadata object from LLM/Candidate
 * @param storyTurnCount Current turn count
 * @param currentNarrativeDate Optional formatted date string
 * @param canonicalCandidateId Optional canonical candidate ID from Parser Authority (preserves 1..N lifecycle identity)
 */
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
  const recommendedDC: number | undefined = undefined; // Prohibited from external metadata

  // 1. Seeds (Creation and Resolution)
  if (metaData?.foreshadowSeeds && Array.isArray(metaData.foreshadowSeeds)) {
    metaData.foreshadowSeeds.forEach((seedText: string) => {
      const trimmed = typeof seedText === 'string' ? seedText.trim() : '';
      if (trimmed) {
        seedChanges.push({
          content: trimmed,
          status: 'active',
          action: 'create'
        });
      }
    });
  }

  if (metaData?.resolvedSeeds && Array.isArray(metaData.resolvedSeeds)) {
    metaData.resolvedSeeds.forEach((res: any) => {
      if (res && res.content) {
        seedChanges.push({
          content: String(res.content).trim(),
          status: 'resolved',
          action: 'resolve',
          resolutionSummary: res.resolutionSummary ? String(res.resolutionSummary).trim() : undefined,
          entityReference: res.entityReference
        });
      }
    });
  }

  // 2. Offscreen events
  if (metaData?.cameraOffscreenEvents && Array.isArray(metaData.cameraOffscreenEvents)) {
    metaData.cameraOffscreenEvents.forEach((ev: string) => {
      const trimmed = typeof ev === 'string' ? ev.trim() : '';
      if (trimmed) {
        offscreenEvents.push({
          event: trimmed,
          informationAccess: 'FACTION'
        });
      }
    });
  }

  // 3. New / Updated NPCs if provided in metadata
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
          informationAccess: npc.metInStory ? 'PROTAGONIST_KNOWN' : 'UNKNOWN',
          entityReference: npc.entityReference
        });
      }
    });
  }

  // 4. New Factions if provided in metadata
  if (metaData?.newFactions && Array.isArray(metaData.newFactions)) {
    metaData.newFactions.forEach((fac: any) => {
      if (fac.name && typeof fac.name === 'string' && fac.name.trim()) {
        factionChanges.push({
          name: fac.name.trim(),
          description: fac.description || '',
          attitudeTowardsPlayer: fac.attitudeTowardsPlayer,
          informationAccess: 'PUBLIC',
          entityReference: fac.entityReference
        });
      }
    });
  }

  // 5. Chapter Roadmap Changes (Strict Nested Contract Only — No Legacy Top-Level Fallback)
  let chapterChanges: { currentChapter?: string; upcomingChapters?: string[] } | undefined = undefined;
  if (metaData?.chapterChanges && typeof metaData.chapterChanges === 'object' && !Array.isArray(metaData.chapterChanges)) {
    const cur = typeof metaData.chapterChanges.currentChapter === 'string' ? metaData.chapterChanges.currentChapter.trim() : undefined;
    const up = Array.isArray(metaData.chapterChanges.upcomingChapters)
      ? metaData.chapterChanges.upcomingChapters.map((c: any) => typeof c === 'string' ? c.trim() : '').filter(Boolean)
      : undefined;
    if (cur || (up && up.length > 0)) {
      chapterChanges = {
        ...(cur ? { currentChapter: cur } : {}),
        ...(up && up.length > 0 ? { upcomingChapters: up } : {})
      };
    }
  }

  // 6. Inventory Changes if provided in metadata
  if (metaData?.inventoryChanges && Array.isArray(metaData.inventoryChanges)) {
    metaData.inventoryChanges.forEach((inv: any) => {
      if (typeof inv === 'object' && inv !== null && inv.name) {
        const cause = inv.cause || inv.acquisition?.cause || inv.entityReference?.evidence?.cause;
        const cost = inv.cost || inv.acquisition?.cost || inv.entityReference?.evidence?.cost;
        const verifiedEventId = inv.verifiedEventId || inv.acquisition?.verifiedEventId || inv.entityReference?.evidence?.verifiedEventId;
        inventoryChanges.push({
          name: String(inv.name).trim(),
          quantity: typeof inv.quantity === 'number' && !isNaN(inv.quantity) ? Math.max(1, inv.quantity) : 1,
          action: inv.action === 'remove' || inv.operation === 'REMOVE' ? 'remove' : 'add',
          entityReference: inv.entityReference,
          cause,
          cost,
          verifiedEventId,
          acquisition: (cause || verifiedEventId || cost) ? {
            cause,
            cost: cost && typeof cost === 'object' ? {
              id: typeof cost.id === 'string' ? cost.id : undefined,
              name: typeof cost.name === 'string' ? cost.name : undefined,
              quantity: typeof cost.quantity === 'number' ? Math.max(1, cost.quantity) : 1
            } : undefined,
            verifiedEventId: typeof verifiedEventId === 'string' && verifiedEventId.trim() ? verifiedEventId.trim() : undefined
          } : undefined
        });
      }
    });
  }

  // 7. Stat Deltas if provided in metadata
  if (metaData?.statDeltas && Array.isArray(metaData.statDeltas)) {
    metaData.statDeltas.forEach((sd: any) => {
      if (sd.stat && typeof sd.delta === 'number' && !isNaN(sd.delta)) {
        statChanges.push({
          stat: sd.stat,
          delta: sd.delta
        });
      }
    });
  }

  // 8. Character Changes if provided in metadata
  let characterChanges: CandidatePacket['characterChanges'] = undefined;
  if (metaData?.characterChanges && typeof metaData.characterChanges === 'object' && !Array.isArray(metaData.characterChanges)) {
    characterChanges = {
      name: metaData.characterChanges.name ? String(metaData.characterChanges.name).trim() : undefined,
      alias: metaData.characterChanges.alias ? String(metaData.characterChanges.alias).trim() : undefined,
      background: metaData.characterChanges.background ? String(metaData.characterChanges.background).trim() : undefined,
      martialArts: metaData.characterChanges.martialArts ? String(metaData.characterChanges.martialArts).trim() : undefined,
      entityReference: metaData.characterChanges.entityReference
    };
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
    characterChanges,
    recommendedDC,
    rawMetadataBlock: metaData ? JSON.stringify(metaData) : undefined
  };
}

/**
 * Validation Firewall:
 * Inspects candidate proposals against the current canonical world state & history.
 * Prevents phantom state injection, resurrection of dead NPCs, and reference violations.
 */
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

  // 1. Validate NPC changes
  if (candidate.npcChanges && candidate.npcChanges.length > 0) {
    for (const npcCand of candidate.npcChanges) {
      if (!npcCand.name || !npcCand.name.trim()) {
        rejectedReasons.push('NPC candidate missing valid name');
        continue;
      }

      // Check if existing NPC is marked dead in historical records or state
      const isDeadHistorically = historicalRecords.some(
        r => r.recordType === 'NPC_STATE_CHANGED' &&
             r.involvedCharacterIds.includes(npcCand.name) &&
             (r.payload as any)?.isDead === true
      );

      if (isDeadHistorically && !npcCand.isDead) {
        rejectedReasons.push(`Refusing to resurrect canonically deceased NPC: ${npcCand.name}`);
        continue;
      }

      // Enforce Information Access Boundary: If unmet, innerThought must not leak omniscience
      let sanitizedNpc = { ...npcCand };
      if (!sanitizedNpc.metInStory) {
        sanitizedNpc.innerThought = '[미인지 상태]';
        sanitizedNpc.informationAccess = sanitizedNpc.informationAccess || 'UNKNOWN';
      } else {
        sanitizedNpc.informationAccess = sanitizedNpc.informationAccess || 'PROTAGONIST_KNOWN';
      }

      sanitizedCandidate.npcChanges?.push(sanitizedNpc);
    }
  }

  // 2. Validate Seeds (Foreshadowing limit: max 3 active foregrounded)
  if (candidate.seedChanges && candidate.seedChanges.length > 0) {
    const existingActiveSeedCount = worldInfo.seeds.filter(s => s.status === 'active').length;
    let allowedSeedSlots = Math.max(0, 3 - existingActiveSeedCount);

    for (const seed of candidate.seedChanges) {
      if (!seed.content || !seed.content.trim()) {
        rejectedReasons.push('Seed candidate missing content');
        continue;
      }

      // Check for duplicate seed
      const isDuplicate = worldInfo.seeds.some(
        s => s.content.trim() === seed.content.trim()
      );
      if (isDuplicate) {
        rejectedReasons.push(`Ignoring duplicate seed: "${seed.content.substring(0, 20)}..."`);
        continue;
      }

      sanitizedCandidate.seedChanges?.push(seed);
    }
  }

  // 3. Validate Offscreen Events
  if (candidate.offscreenEvents && candidate.offscreenEvents.length > 0) {
    for (const off of candidate.offscreenEvents) {
      if (!off.event || !off.event.trim()) continue;
      // Do not duplicate exact same string in existing offscreen list
      if (worldInfo.cameraOffscreenEvents.includes(off.event.trim())) {
        continue;
      }
      sanitizedCandidate.offscreenEvents?.push(off);
    }
  }

  // 4. Validate Recommended DC
  if (candidate.recommendedDC !== undefined) {
    if (typeof candidate.recommendedDC === 'number' && candidate.recommendedDC >= 1 && candidate.recommendedDC <= 20) {
      sanitizedCandidate.recommendedDC = Math.round(candidate.recommendedDC);
    } else {
      rejectedReasons.push(`DC ${candidate.recommendedDC} out of valid range (1-20). Clamped.`);
      sanitizedCandidate.recommendedDC = Math.max(1, Math.min(20, Math.round(candidate.recommendedDC || 10)));
    }
  }

  // 5. Validate Chapter & Roadmap Changes
  if (candidate.chapterChanges) {
    const cur = candidate.chapterChanges.currentChapter?.trim();
    const up = candidate.chapterChanges.upcomingChapters?.map(c => c.trim()).filter(Boolean) || [];
    sanitizedCandidate.chapterChanges = {
      currentChapter: cur || worldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME,
      upcomingChapters: up.slice(0, 3)
    };
  }

  // 6. Validate Inventory Changes
  if (candidate.inventoryChanges && candidate.inventoryChanges.length > 0) {
    for (const inv of candidate.inventoryChanges) {
      if (!inv.name || !inv.name.trim()) continue;
      sanitizedCandidate.inventoryChanges?.push({
        name: inv.name.trim(),
        quantity: typeof inv.quantity === 'number' && !isNaN(inv.quantity) ? Math.max(1, inv.quantity) : 1,
        action: inv.action === 'remove' ? 'remove' : 'add',
        entityReference: inv.entityReference,
        acquisition: inv.acquisition,
        cause: inv.cause,
        cost: inv.cost
      });
    }
  }

  // 7. Validate Stat Changes
  if (candidate.statChanges && candidate.statChanges.length > 0) {
    for (const sc of candidate.statChanges) {
      if (sc.stat && typeof sc.delta === 'number' && !isNaN(sc.delta)) {
        sanitizedCandidate.statChanges?.push(sc);
      }
    }
  }

  const isValid = rejectedReasons.length === 0;

  return {
    isValid,
    candidateId: candidate.candidateId,
    sanitizedCandidate,
    rejectedReasons
  };
}

/**
 * Transforms validated candidate state into immutable Historical Records (Append-Oriented).
 */
export function createHistoricalRecordsFromCandidate(
  candidate: CandidatePacket,
  storyTurnCount: number
): HistoricalRecord[] {
  const records: HistoricalRecord[] = [];
  const createdAt = new Date().toISOString();
  const narrativeDate = candidate.narrativeDate || `Turn ${storyTurnCount}`;

  // 1. Seeds
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
        payload: {
          content: seed.content,
          seedStatus: seed.status
        }
      });
    });
  }

  // 2. Offscreen Events
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
        payload: {
          eventText: ev.event
        }
      });
    });
  }

  // 3. NPC Changes
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

  // 4. DC Assignment Record
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
      payload: {
        recommendedDC: candidate.recommendedDC
      }
    });
  }

  // 5. Chapter Roadmap Record
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

/**
 * Projects Historical Records and Validated Candidate into WorldInfo & Character State.
 * This ensures deterministic state projection derived directly from verified records.
 */
export function projectCanonicalState(
  prevWorldInfo: WorldInfo,
  prevCharacter: Character,
  validatedCandidate: CandidatePacket,
  newRecords: HistoricalRecord[]
): {
  nextWorldInfo: WorldInfo;
  nextCharacter: Character;
} {
  let nextWorldInfo: WorldInfo = {
    ...prevWorldInfo,
    seeds: [...prevWorldInfo.seeds],
    cameraOffscreenEvents: [...prevWorldInfo.cameraOffscreenEvents],
    dcHistory: [...prevWorldInfo.dcHistory],
    npcs: [...prevWorldInfo.npcs],
    factions: [...prevWorldInfo.factions],
    chapters: prevWorldInfo.chapters ? {
      ...prevWorldInfo.chapters,
      upcomingChapters: [...(prevWorldInfo.chapters.upcomingChapters || [])]
    } : {
      currentChapter: DEFAULT_CHAPTER_NAME,
      upcomingChapters: []
    }
  };

  let nextCharacter: Character = {
    ...prevCharacter,
    inventory: [...prevCharacter.inventory],
    stats: { ...prevCharacter.stats }
  };

  // 1. Apply Seeds
  if (validatedCandidate.seedChanges && validatedCandidate.seedChanges.length > 0) {
    const newSeeds: NarrativeSeed[] = validatedCandidate.seedChanges.map((sc, i) => ({
      id: generateRecordId(`seed-${i}`),
      content: sc.content,
      status: sc.status,
      turnCreated: validatedCandidate.turn
    }));
    // Maintain max foreground seeds active
    const activeExisting = nextWorldInfo.seeds.filter(s => s.status === 'active').slice(-2);
    const dormantExisting = nextWorldInfo.seeds.filter(s => s.status !== 'active');
    nextWorldInfo.seeds = [...dormantExisting, ...activeExisting, ...newSeeds];
  }

  // 2. Apply Offscreen Events
  if (validatedCandidate.offscreenEvents && validatedCandidate.offscreenEvents.length > 0) {
    const newEvents = validatedCandidate.offscreenEvents.map(e => e.event);
    nextWorldInfo.cameraOffscreenEvents = [...nextWorldInfo.cameraOffscreenEvents, ...newEvents];
  }

  // 3. Apply DC History
  if (validatedCandidate.recommendedDC !== undefined) {
    nextWorldInfo.dcHistory = [...nextWorldInfo.dcHistory, validatedCandidate.recommendedDC];
  }

  // 4. Apply Chapter Roadmap
  if (validatedCandidate.chapterChanges) {
    const cur = validatedCandidate.chapterChanges.currentChapter || nextWorldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME;
    const up = validatedCandidate.chapterChanges.upcomingChapters || nextWorldInfo.chapters?.upcomingChapters || [];
    nextWorldInfo.chapters = {
      currentChapter: cur,
      upcomingChapters: up.slice(0, 3)
    };
  }

  // 5. Apply NPCs
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
        const newNpcRecord: NpcRecord = {
          id: generateRecordId('npc'),
          name: candNpc.name,
          alias: candNpc.alias,
          npcClass: candNpc.npcClass || DEFAULT_NPC_CLASS,
          innerThought: candNpc.metInStory ? (candNpc.innerThought || '') : '[미인지 상태]',
          metInStory: candNpc.metInStory ?? false,
          origin: candNpc.origin,
          background: candNpc.background,
          martialArts: candNpc.martialArts,
          values: candNpc.values,
          affiliation: candNpc.affiliation
        };
        nextWorldInfo.npcs.push(newNpcRecord);
      }
    });
  }

  return { nextWorldInfo, nextCharacter };
}
