import { GMMetaData, NpcRecord, FactionRecord, DEFAULT_CHAPTER_NAME } from '../types';
import { recoverSyntaxAndParseJson } from '../engine/language/recovery';

/**
 * Parses GM output, extracting:
 * 1. The structured system metadata block (Markdown 1~7)
 * 2. The JSON state transition proposals (if present)
 * 3. The developer-visible Planned Narrative Roadmap block (current chapter + exactly 3 upcoming chapters)
 * 4. Clean literary prose with the Planned Narrative Roadmap block prepended for direct developer inspectability.
 */
export function parseGMResponseMetaData(rawResponse: string): {
  cleanText: string;
  metaData: GMMetaData | null;
  rawMetaBlock: string | null;
} {
  if (!rawResponse) {
    return { cleanText: '', metaData: null, rawMetaBlock: null };
  }

  // Regex to extract all code blocks (markdown metadata & JSON proposal)
  const codeBlockRegex = /```(?:json|yaml|markdown|text)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let rawMetaBlock: string | null = null;
  let rawJsonBlock: string | null = null;

  // Scan all code blocks
  while ((match = codeBlockRegex.exec(rawResponse)) !== null) {
    const blockContent = match[1];
    const trimmed = blockContent.trim();
    if (trimmed.startsWith('{') || blockContent.includes('"actions"') || blockContent.includes('"intentSummary"')) {
      rawJsonBlock = blockContent;
    } else if (
      blockContent.includes('외부 검색') ||
      blockContent.includes('UI 코드 반영') ||
      blockContent.includes('미회수 복선') ||
      blockContent.includes('정세') ||
      blockContent.includes('DC 누적') ||
      blockContent.includes('개연성') ||
      blockContent.includes('1)') ||
      blockContent.includes('2)') ||
      blockContent.includes('진행 및 예정 챕터')
    ) {
      rawMetaBlock = blockContent;
    }
  }

  // Clean prose: strip out all code blocks (markdown & json) AND roadmap block if present in prose
  let cleanText = rawResponse
    .replace(/```(?:json|yaml|markdown|text)?\s*[\s\S]*?```/gi, '')
    .replace(/\[TRPG\s*3\.1\s*[-—]\s*PLANNED\s+NARRATIVE\s+ROADMAP\][\s\S]*?\[ROADMAP\s+END\]/gi, '')
    .trim();

  // Initialize metaData
  const metaData: GMMetaData = {
    upcomingChapters: []
  };

  // 1. Parse fields from rawMetaBlock if present
  if (rawMetaBlock) {
    try {
      const lines = rawMetaBlock.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (/^(?:1\)|1\s*\.|\[1\])/.test(trimmed) || trimmed.includes('외부 검색') || trimmed.includes('UI 코드 반영')) {
          metaData.factCheckSummary = trimmed;
          metaData.uiSyncReport = trimmed;
        } else if (/^(?:2\)|2\s*\.|\[2\])/.test(trimmed) || trimmed.includes('미회수 복선')) {
          const seedText = trimmed.replace(/^(?:2\)|2\s*\.|\[2\])[^:]*:\s*/, '').trim();
          if (seedText) metaData.foreshadowSeeds = [seedText];
        } else if (/^(?:3\)|3\s*\.|\[3\])/.test(trimmed) || trimmed.includes('정세')) {
          const offscreen = trimmed.replace(/^(?:3\)|3\s*\.|\[3\])[^:]*:\s*/, '').trim();
          if (offscreen) metaData.cameraOffscreenEvents = [offscreen];
        } else if (/^(?:4\)|4\s*\.|\[4\])/.test(trimmed) || trimmed.includes('챕터')) {
          // Check for structured line: e.g. "4) [진행 및 예정 챕터 현황]: 현재: 1장... | 예정: 1) 2장... | 2) 3장... | 3) 4장..."
          const chapterLine = trimmed.replace(/^(?:4\)|4\s*\.|\[4\])[^:]*:\s*/, '').trim();
          if (chapterLine.includes('|')) {
            const parts = chapterLine.split('|').map(p => p.trim());
            const curPart = parts.find(p => p.startsWith('현재:') || p.startsWith('현재 챕터:'));
            if (curPart) {
              metaData.currentChapter = curPart.replace(/^(?:현재|현재 챕터)\s*:\s*/, '').trim();
            } else {
              metaData.currentChapter = parts[0];
            }
            const upParts = parts.filter(p => p !== curPart);
            const upList: string[] = [];
            upParts.forEach(up => {
              const cleaned = up.replace(/^(?:예정|예정 챕터)\s*:\s*/, '').replace(/^\d+\)\s*/, '').trim();
              if (cleaned) upList.push(cleaned);
            });
            if (upList.length > 0) {
              metaData.upcomingChapters = upList.slice(0, 3);
            }
          } else {
            metaData.currentChapter = chapterLine;
          }
        } else if (/^(?:5\)|5\s*\.|\[5\])/.test(trimmed) || trimmed.includes('스탯') || trimmed.includes('소장품')) {
          metaData.statChanges = trimmed;
        } else if (/^(?:6\)|6\s*\.|\[6\])/.test(trimmed) || trimmed.includes('DC')) {
          metaData.dcReason = trimmed;
          const dcMatch = trimmed.match(/DC\s*(\d+)/i);
          if (dcMatch) {
            metaData.recommendedDC = parseInt(dcMatch[1], 10);
          }
        } else if (/^(?:7\)|7\s*\.|\[7\])/.test(trimmed) || trimmed.includes('대조') || trimmed.includes('개연성')) {
          metaData.contextVerificationDeclaration = trimmed;
        }
      });
    } catch (e) {
      console.warn('Failed to parse detailed metadata fields:', e);
    }
  }

  // 2. Parse from JSON Proposal Block if structured actions exist
  if (rawJsonBlock) {
    try {
      const recovered = recoverSyntaxAndParseJson<any>(rawJsonBlock);
      const parsedJson = recovered.success ? recovered.data : null;
      if (parsedJson && parsedJson.actions && Array.isArray(parsedJson.actions)) {
        parsedJson.actions.forEach((a: any) => {
          if (!a || !a.type) return;

          switch (a.type) {
            case 'ADVANCE_CHAPTER': {
              if (a.payload?.currentChapter) {
                metaData.currentChapter = a.payload.currentChapter;
              }
              if (Array.isArray(a.payload?.upcomingChapters) && a.payload.upcomingChapters.length > 0) {
                metaData.upcomingChapters = a.payload.upcomingChapters.slice(0, 3);
              }
              break;
            }

            case 'ADD_NPC': {
              const p = a.payload;
              if (p && (p.name || p.id)) {
                if (!metaData.newNpcs) metaData.newNpcs = [];
                metaData.newNpcs.push({
                  id: p.id,
                  name: p.name || p.id,
                  alias: p.alias,
                  npcClass: p.npcClass,
                  innerThought: p.innerThought,
                  impression: p.impression,
                  metInStory: p.metInStory !== undefined ? p.metInStory : (p.status === 'UNMET' || p.currentStatus === 'UNMET' ? false : true),
                  status: p.currentStatus || p.status || 'ALIVE',
                  origin: p.origin,
                  background: p.background,
                  martialArts: p.martialArts,
                  values: p.values,
                  affiliation: p.affiliation
                });
              }
              break;
            }

            case 'UPDATE_NPC': {
              const p = a.payload;
              if (p && (p.name || p.id)) {
                if (!metaData.newNpcs) metaData.newNpcs = [];
                metaData.newNpcs.push({
                  id: p.id,
                  name: p.name || p.id,
                  ...(p.changes || {})
                });
              }
              break;
            }

            case 'SET_NPC_STATUS': {
              const p = a.payload;
              if (p && (p.name || p.id)) {
                if (!metaData.newNpcs) metaData.newNpcs = [];
                metaData.newNpcs.push({
                  id: p.id,
                  name: p.name || p.id,
                  status: p.status,
                  isDead: p.status === 'DEAD'
                } as any);
              }
              break;
            }

            case 'ADD_FACTION': {
              const p = a.payload;
              if (p && (p.name || p.id)) {
                if (!metaData.newFactions) metaData.newFactions = [];
                metaData.newFactions.push({
                  id: p.id,
                  name: p.name || p.id,
                  description: p.description || '',
                  attitudeTowardsPlayer: p.attitudeTowardsPlayer
                });
              }
              break;
            }

            case 'UPDATE_FACTION': {
              const p = a.payload;
              if (p && (p.name || p.id)) {
                if (!metaData.newFactions) metaData.newFactions = [];
                metaData.newFactions.push({
                  id: p.id,
                  name: p.name || p.id,
                  ...(p.changes || {})
                });
              }
              break;
            }

            case 'MODIFY_INVENTORY': {
              const p = a.payload;
              if (p) {
                const itemObj = p.item || p;
                const name = itemObj.name || p.name;
                const quantity = typeof itemObj.quantity === 'number' ? itemObj.quantity : (typeof p.quantity === 'number' ? p.quantity : 1);
                const action = (p.operation === 'REMOVE' || p.action === 'remove') ? 'remove' : 'add';
                const verifiedEventId = p.verifiedEventId || p.acquisition?.verifiedEventId || itemObj?.verifiedEventId || itemObj?.acquisition?.verifiedEventId;
                const acquisition = p.acquisition || (p.cause ? {
                  cause: p.cause,
                  cost: p.cost,
                  verifiedEventId
                } : (verifiedEventId ? { cause: 'DISCOVERY_PICKUP', verifiedEventId } : undefined));
                const cause = acquisition?.cause || p.cause;
                const cost = acquisition?.cost || p.cost;
                if (name && typeof name === 'string' && name.trim()) {
                  if (!metaData.inventoryChanges) metaData.inventoryChanges = [];
                  metaData.inventoryChanges.push({
                    name: name.trim(),
                    quantity: Math.max(1, quantity),
                    action,
                    ...(acquisition ? { acquisition } : {}),
                    ...(cause ? { cause } : {}),
                    ...(cost ? { cost } : {}),
                    ...(verifiedEventId ? { verifiedEventId } : {})
                  });
                }
              }
              break;
            }

            case 'ADD_NARRATIVE_SEED': {
              const p = a.payload;
              const content = p?.content || p?.clueText || p?.title;
              if (content && typeof content === 'string' && content.trim()) {
                if (!metaData.foreshadowSeeds) metaData.foreshadowSeeds = [];
                if (!metaData.foreshadowSeeds.includes(content.trim())) {
                  metaData.foreshadowSeeds.push(content.trim());
                }
              }
              break;
            }

            case 'RESOLVE_NARRATIVE_SEED': {
              const p = a.payload;
              if (p && (p.id || p.content)) {
                if (!metaData.resolvedSeeds) metaData.resolvedSeeds = [];
                metaData.resolvedSeeds.push({
                  content: p.content || p.id,
                  resolutionSummary: p.resolutionSummary
                });
              }
              break;
            }

            case 'RECORD_OFFSCREEN_EVENT': {
              const p = a.payload;
              const desc = p?.eventDescription || p?.event;
              if (desc && typeof desc === 'string' && desc.trim()) {
                if (!metaData.cameraOffscreenEvents) metaData.cameraOffscreenEvents = [];
                if (!metaData.cameraOffscreenEvents.includes(desc.trim())) {
                  metaData.cameraOffscreenEvents.push(desc.trim());
                }
              }
              break;
            }

            case 'RECORD_DICE_RESULT': {
              const p = a.payload;
              if (p && typeof p.targetDC === 'number') {
                metaData.recommendedDC = p.targetDC;
              }
              break;
            }

            case 'UPDATE_CHARACTER_STATS': {
              const p = a.payload;
              if (p && typeof p === 'object') {
                if (!metaData.statDeltas) metaData.statDeltas = [];
                for (const key of ['strength', 'agility', 'intellect', 'willpower', 'charm', 'perception', 'health', 'mana'] as const) {
                  if (typeof p[key] === 'number') {
                    metaData.statDeltas.push({ stat: key as any, delta: p[key] });
                  }
                }
              }
              break;
            }

            default:
              break;
          }
        });
      }

      // Direct field parsing for candidate raw metadata structure
      if (parsedJson.newNpcs && Array.isArray(parsedJson.newNpcs)) {
        metaData.newNpcs = parsedJson.newNpcs;
      }
      if (parsedJson.newFactions && Array.isArray(parsedJson.newFactions)) {
        metaData.newFactions = parsedJson.newFactions;
      }
      if (parsedJson.inventoryChanges && Array.isArray(parsedJson.inventoryChanges)) {
        metaData.inventoryChanges = parsedJson.inventoryChanges;
      }
      if (parsedJson.foreshadowSeeds && Array.isArray(parsedJson.foreshadowSeeds)) {
        metaData.foreshadowSeeds = parsedJson.foreshadowSeeds;
      }
      if (parsedJson.resolvedSeeds && Array.isArray(parsedJson.resolvedSeeds)) {
        metaData.resolvedSeeds = parsedJson.resolvedSeeds;
      }
      if (parsedJson.cameraOffscreenEvents && Array.isArray(parsedJson.cameraOffscreenEvents)) {
        metaData.cameraOffscreenEvents = parsedJson.cameraOffscreenEvents;
      }
      if (parsedJson.statDeltas && Array.isArray(parsedJson.statDeltas)) {
        metaData.statDeltas = parsedJson.statDeltas;
      }
      if (parsedJson.currentChapter) {
        metaData.currentChapter = parsedJson.currentChapter;
      }
      if (parsedJson.upcomingChapters && Array.isArray(parsedJson.upcomingChapters)) {
        metaData.upcomingChapters = parsedJson.upcomingChapters;
      }
      if (parsedJson.recommendedDC !== undefined) {
        metaData.recommendedDC = parsedJson.recommendedDC;
      }
    } catch {
      // Ignore JSON parse errors in telemetry
    }
  }

  // 3. Parse and extract from Plain Text Roadmap Block if present in rawResponse
  const roadmapRegex = /\[TRPG\s*3\.1\s*[-—]\s*PLANNED\s+NARRATIVE\s+ROADMAP\]([\s\S]*?)\[ROADMAP\s+END\]/i;
  const roadmapMatch = rawResponse.match(roadmapRegex);

  if (roadmapMatch) {
    const roadmapBody = roadmapMatch[1];
    const curMatch = roadmapBody.match(/현재\s*챕터\s*:\s*([^\n\r]+)/i);
    if (curMatch && curMatch[1].trim()) {
      metaData.currentChapter = curMatch[1].trim();
    }
    const up1 = roadmapBody.match(/예정\s*챕터\s*1\s*:\s*([^\n\r]+)/i);
    const up2 = roadmapBody.match(/예정\s*챕터\s*2\s*:\s*([^\n\r]+)/i);
    const up3 = roadmapBody.match(/예정\s*챕터\s*3\s*:\s*([^\n\r]+)/i);

    const parsedUpcoming: string[] = [];
    if (up1 && up1[1].trim()) parsedUpcoming.push(up1[1].trim());
    if (up2 && up2[1].trim()) parsedUpcoming.push(up2[1].trim());
    if (up3 && up3[1].trim()) parsedUpcoming.push(up3[1].trim());

    if (parsedUpcoming.length > 0) {
      metaData.upcomingChapters = parsedUpcoming;
    }
  }

  // Ensure default current chapter if missing
  if (!metaData.currentChapter || !metaData.currentChapter.trim()) {
    metaData.currentChapter = DEFAULT_CHAPTER_NAME;
  }

  return { cleanText, metaData, rawMetaBlock };
}

/**
 * Formats canonical WorldInfo.chapters or GMMetaData into standard Planned Narrative Roadmap clipboard text.
 * Strictly adheres to 3 upcoming chapters, marking missing slots as '미정'.
 */
export function formatRoadmapText(chapters?: { currentChapter?: string; upcomingChapters?: string[] } | null): string {
  const currentChapter = chapters?.currentChapter?.trim() || DEFAULT_CHAPTER_NAME;
  const rawUpcoming = chapters?.upcomingChapters || [];
  const up1 = rawUpcoming[0]?.trim() || '(미등록)';
  const up2 = rawUpcoming[1]?.trim() || '(미등록)';
  const up3 = rawUpcoming[2]?.trim() || '(미등록)';

  return `[TRPG 3.1 — PLANNED NARRATIVE ROADMAP]\n\n현재 챕터:\n${currentChapter}\n\n예정 챕터 1:\n${up1}\n\n예정 챕터 2:\n${up2}\n\n예정 챕터 3:\n${up3}\n\n[ROADMAP END]`;
}

/**
 * Sanitize NPC data before exposing to user UI to prevent spoiler leakage
 * Unmet NPCs must strictly display [미인지 상태]
 */
export function sanitizeNpcRecords(npcs: NpcRecord[]): NpcRecord[] {
  return npcs.map(npc => {
    if (npc.metInStory === false) {
      return {
        ...npc,
        innerThought: '[미인지 상태]',
        impression: '[미인지 상태]'
      };
    }
    return npc;
  });
}
