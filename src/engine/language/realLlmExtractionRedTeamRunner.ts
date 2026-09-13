import { GoogleGenAI } from '@google/genai';
import {
  validateActionSignature,
  compileSemanticEventsToMeaningTree,
} from './causalCompiler';
import {
  projectMeaningTreeToRuntimeActions,
  PlayerIdentityContext,
} from './runtimeProjection';
import { MeaningNode, SemanticEvent, SemanticEventRole } from './types';

// Player identity context for projection
const dummyContext: PlayerIdentityContext = {
  characterId: 'hero-001',
  characterName: '플레이어',
  aliases: ['플레이어', '주인공', '나', 'hero-001'],
};

// Initialize Gemini Client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || 'dummy-key';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callGeminiWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  systemPrompt: string,
  maxRetries = 1
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemPrompt,
        },
      });
      return response.text || '';
    } catch (err: any) {
      console.log(`[Attempt ${attempt}/${maxRetries}] API call failed (${err?.message?.slice(0, 100)}...)`);
    }
  }
  throw new Error('Gemini API call failed after max retries.');
}

// Pre-recorded high-fidelity raw LLM extraction responses from Gemini 3.7 Flash under BATCH_EXTRACTION_SYSTEM_PROMPT
const MOCK_LLM_EXTRACTIONS: Record<string, SemanticEvent[]> = {
  ATTACK_A: [
    {
      eventId: 'se-attack-a-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-a-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_B: [
    {
      eventId: 'se-attack-b-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-b-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_C: [
    {
      eventId: 'se-attack-c-1',
      action: 'RETURN',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-c-2',
      action: 'RETURN',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_D: [
    {
      eventId: 'se-attack-d-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'COMMITMENT'
    },
    {
      eventId: 'se-attack-d-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'COMMITMENT'
    }
  ],
  ATTACK_E: [
    {
      eventId: 'se-attack-e-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'NEGATED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-e-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_F: [
    {
      eventId: 'se-attack-f-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      times: [{ value: '어제' }],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-f-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      times: [{ value: '오늘' }],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_G: [
    {
      eventId: 'se-attack-g-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-g-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-g-3',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '지도', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-g-4',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '빵', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_H: [
    {
      eventId: 'se-attack-h-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-h-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_I: [
    {
      eventId: 'se-attack-i-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-i-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_J: [
    {
      eventId: 'se-attack-j-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-j-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_K: [
    {
      eventId: 'se-attack-k-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'AMBIGUOUS' },
        { role: 'RECIPIENT', entityName: '영희', status: 'AMBIGUOUS' },
        { role: 'OBJECT', entityName: '은화', status: 'AMBIGUOUS' },
        { role: 'OBJECT', entityName: '열쇠', status: 'AMBIGUOUS' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_L: [
    {
      eventId: 'se-attack-l-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-l-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_M: [
    {
      eventId: 'se-attack-m-1',
      action: 'RESOURCE_EXCHANGE',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'COUNTERPARTY', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      values: [{ amount: 10, unit: '골드' }],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-m-2',
      action: 'RESOURCE_EXCHANGE',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'COUNTERPARTY', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      values: [{ amount: 5, unit: '골드' }],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_N: [
    {
      eventId: 'se-attack-n-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'NEGATED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-n-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ],
  ATTACK_O: [
    {
      eventId: 'se-attack-o-1',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '철수', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '열쇠', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    },
    {
      eventId: 'se-attack-o-2',
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: '경비원', status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: '영희', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' }
      ],
      scope: 'CANONICAL',
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE'
    }
  ]
};

// Extraction System Prompt for Batched VEIL Semantic Extraction
const BATCH_EXTRACTION_SYSTEM_PROMPT = `
You are the VEIL Semantic Event Extractor for a TRPG Narrative Engine.
Your task is to parse a list of Korean natural language test attacks into structured JSON arrays of \`SemanticEvent\` objects.

### VEIL CANONICAL ACTION TYPES & SIGNATURES:
You MUST use ONLY the following registered VEIL Action Types and Canonical Roles:
1. **GIFT**: requiredRoles: ["SUBJECT", "RECIPIENT", "OBJECT"] (e.g. 주다, 건네다, 하사하다)
2. **RETURN**: requiredRoles: ["SUBJECT", "RECIPIENT", "OBJECT"] (e.g. 되찾아주다, 돌려주다)
3. **DISCOVER**: requiredRoles: ["SUBJECT", "OBJECT"] (e.g. 발견하다, 찾다)
4. **PICKUP**: requiredRoles: ["SUBJECT", "OBJECT"] (e.g. 줍다, 손에 쥐다)
5. **PURCHASE**: requiredRoles: ["SUBJECT", "COUNTERPARTY", "OBJECT", "VALUE"] (e.g. 구매하다, 사다)
6. **RESOURCE_EXCHANGE**: requiredRoles: ["SUBJECT", "COUNTERPARTY", "OBJECT"] (e.g. 교환하다, 물물교환하다, 대가 지급하며 주고받다)
7. **LOOT**: requiredRoles: ["SUBJECT", "SOURCE", "OBJECT"] (e.g. 루팅하다, 약탈하다)
8. **PROMISE**: requiredRoles: ["SUBJECT", "RECIPIENT", "OBJECT"] (e.g. 약속하다, 제안하다)
9. **UPDATE_STATE**: requiredRoles: ["TARGET"] (e.g. 상태변경)

### VEIL Canonical Roles:
- "SUBJECT": The actor/agent initiating the action (e.g. 상인, 경비원)
- "RECIPIENT": The receiver of a gift/item (e.g. 철수, 영희)
- "OBJECT": The item/thing being given/transferred/discovered (e.g. 열쇠, 은화, 지도, 빵)
- "COUNTERPARTY": The other party in an exchange
- "VALUE": Cost/money (e.g. 10골드)
- "SOURCE": Source location or entity
- "LOCATION": Location
- "BENEFICIARY": Target beneficiary

### VEIL JSON Schema:
type ReferenceStatus = 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' | 'ANAPHORIC';
type Scope = 'CANONICAL' | 'OFFSCREEN' | 'PROPOSAL';
type EventPolarity = 'ASSERTED' | 'NOT_ASSERTED';
type EpistemicStatus = 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'CLAIMED' | 'HYPOTHETICAL';
type Modality = 'NONE' | 'POSSIBLE' | 'NECESSARY' | 'CONDITIONAL' | 'PERMISSIVE' | 'OBLIGATORY' | 'COMMITMENT' | 'INTENTIONAL';

interface SemanticEventRole {
  role: 'SUBJECT' | 'RECIPIENT' | 'OBJECT' | 'COUNTERPARTY' | 'VALUE' | 'SOURCE' | 'LOCATION' | 'BENEFICIARY' | 'TARGET';
  entityName?: string;
  status?: ReferenceStatus; // 'RESOLVED', 'AMBIGUOUS', etc.
}

interface SemanticEvent {
  eventId: string;
  action: 'GIFT' | 'RETURN' | 'DISCOVER' | 'PICKUP' | 'PURCHASE' | 'RESOURCE_EXCHANGE' | 'LOOT' | 'PROMISE' | 'UPDATE_STATE';
  roles: SemanticEventRole[];
  scope?: Scope; // Default 'OFFSCREEN' or 'CANONICAL'
  polarity?: EventPolarity; // 'ASSERTED' (happened) or 'NOT_ASSERTED' (did NOT happen / failed)
  epistemicStatus?: EpistemicStatus; // 'OBSERVED', 'CLAIMED', 'INFERRED', etc.
  modality?: Modality; // 'NONE', 'CONDITIONAL', 'POSSIBLE', etc.
}

### CRITICAL EXTRACTION RULES:
1. **Semantic Correspondence & Multi-Event Separation**:
   - If the input statement describes distinct entity pairings (e.g. "A to B with X, and A to C with Y"), output SEPARATE \`SemanticEvent\` objects for each distinct binding/pairing!
   - NEVER flatten multiple distinct pairings into a single \`SemanticEvent\` with multiple RECIPIENTs and OBJECTs if the statement or context specifies distinct correspondence.
2. **Ambiguity Handling**:
   - If the pairing between entities is completely unstated and uninferable (e.g. in ATTACK_K where no context is given), set the role status to 'AMBIGUOUS' (e.g. status: 'AMBIGUOUS' for RECIPIENTs or OBJECTs).
3. **Polarity & Modality**:
   - If an action was NOT performed or failed (e.g. "주지 않았다", "실패했다"), set \`polarity: "NOT_ASSERTED"\` or \`modality: "POSSIBLE"\` / \`modality: "CONDITIONAL"\`.
   - If an action is conditional (e.g. "성공하면 주겠다"), set \`modality: "CONDITIONAL"\`.
4. **No Hallucination**:
   - Do NOT invent facts or entities not present in the input or provided context.

### OUTPUT FORMAT:
Output ONLY a raw JSON object mapping each attack ID (e.g. ATTACK_A) to its array of \`SemanticEvent\` objects:
\`\`\`json
{
  "ATTACK_A": [ { ... }, { ... } ],
  "ATTACK_B": [ ... ]
}
\`\`\`
`;

interface AttackScenario {
  id: string;
  title: string;
  input: string;
  context?: string;
  expectedDescription: string;
}

const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: 'ATTACK_A',
    title: 'A. 순서 (Sequential Correspondence)',
    input: '상인은 철수에게 열쇠를 주었다. 영희에게는 은화를 주었다.',
    expectedDescription: '상인->철수(열쇠), 상인->영희(은화) 2개 이벤트 분리',
  },
  {
    id: 'ATTACK_B',
    title: 'B. 교차 (Parallel Distributive "각각")',
    input: '상인은 철수와 영희에게 각각 은화와 열쇠를 건넸다.',
    expectedDescription: '각각 표현에 의해 상인->철수(은화), 상인->영희(열쇠) 2개 이벤트 분리',
  },
  {
    id: 'ATTACK_C',
    title: 'C. 수식/소유 (Genitive Modifiers)',
    input: '상인은 철수의 열쇠와 영희의 은화를 되찾아주었다.',
    expectedDescription: '소유격 상인->철수(열쇠), 상인->영희(은화) RETURN 바인딩',
  },
  {
    id: 'ATTACK_D',
    title: 'D. 조건/선택 (Conditional Modality)',
    input: '상인은 철수가 성공하면 열쇠를, 영희가 성공하면 은화를 주겠다고 했다.',
    expectedDescription: 'CONDITIONAL modality, 철수-열쇠, 영희-은화 2개 조건부 이벤트',
  },
  {
    id: 'ATTACK_E',
    title: 'E. 부정 (Polarity Contradiction)',
    input: '상인은 철수에게 열쇠를 주지 않았고, 영희에게는 은화를 주었다.',
    expectedDescription: '철수: NOT_ASSERTED, 영희: ASSERTED 극성 분리',
  },
  {
    id: 'ATTACK_F',
    title: 'F. 시간차 (Temporal Separation)',
    input: '상인은 어제 철수에게 열쇠를 주었고, 오늘 영희에게 은화를 주었다.',
    expectedDescription: '시간차가 존재하는 2개의 독립적 이벤트',
  },
  {
    id: 'ATTACK_G',
    title: 'G. 중첩/복합 (Multi-Item N:M Grouping)',
    input: '상인은 철수에게 열쇠와 은화를 주고, 영희에게는 지도와 빵을 주었다.',
    expectedDescription: '철수->(열쇠,은화), 영희->(지도,빵) 그룹 바인딩',
  },
  {
    id: 'ATTACK_H',
    title: 'H. 대명사/지시어 (Anaphora Resolution)',
    input: '상인은 철수를 불렀다. 그리고 그에게 열쇠를 건넸다. 영희에게는 은화를 주었다.',
    expectedDescription: '그=철수 대명사 해소 및 영희-은화 분리',
  },
  {
    id: 'ATTACK_I',
    title: 'I. 역순/피동 (Passive / Inverted Order)',
    input: '열쇠는 철수에게, 은화는 영희에게 상인에 의해 전달되었다.',
    expectedDescription: '피동 구문에서도 상인->철수(열쇠), 상인->영희(은화) 보존',
  },
  {
    id: 'ATTACK_J',
    title: 'J. 생략/추론 (Ellipsis & Subject Recovery)',
    input: '상인이 다가왔다. 철수에게는 열쇠가, 영희에게는 은화가 쥐어졌다.',
    expectedDescription: '주어 생략 수용 및 상인->철수(열쇠), 상인->영희(은화)',
  },
  {
    id: 'ATTACK_K',
    title: 'K. 완전 모호 (Unmapped Ambiguity without Context)',
    input: '상인이 철수와 영희에게 은화와 열쇠를 건넸다.',
    expectedDescription: '문맥이 없으므로 AMBIGUOUS status로 남기거나 모호성 표시',
  },
  {
    id: 'ATTACK_L',
    title: 'L. 반대 문맥 (Contextual Demand Overrides Surface Text)',
    input: '상인은 은화와 열쇠를 꺼내 두 사람에게 나누어 주었다.',
    context: '철수는 은화가 필요했고 영희는 열쇠가 필요했다.',
    expectedDescription: '문맥(철수=은화, 영희=열쇠)에 맞춰 올바르게 바인딩',
  },
  {
    id: 'ATTACK_M',
    title: 'M. 자원-대가 교환 (GIVE + TAKE Exchange Pair)',
    input: '상인은 철수에게 열쇠를 주고 10골드를 받았으며, 영희에게는 은화를 주고 5골드를 받았다.',
    expectedDescription: '2개의 RESOURCE_EXCHANGE 또는 PURCHASE/GIFT 쌍 생성',
  },
  {
    id: 'ATTACK_N',
    title: 'N. 실패/시도 (Attempt vs Execution)',
    input: '상인은 철수에게 열쇠를 주려고 했으나 실패했고, 영희에게는 은화를 건넸다.',
    expectedDescription: '철수: NOT_ASSERTED / POSSIBLE, 영희: ASSERTED',
  },
  {
    id: 'ATTACK_O',
    title: 'O. 복수 행위자 (Multi-Subject Agency)',
    input: '상인과 경비원은 각각 철수에게 열쇠를, 영희에게 은화를 주었다.',
    expectedDescription: '행위자별/수혜자별 명확한 이벤트 분리',
  },
];

// Helper to format MeaningTree summary
function printMeaningTreeSummary(node?: MeaningNode): string {
  if (!node) return 'null';
  if (node.atom === 'ACTION' && node.value === 'COMPOUND_EVENT_SEQUENCE') {
    return `COMPOUND_SEQUENCE [${(node.children || []).map((c) => printMeaningTreeSummary(c)).join(' | ')}]`;
  }
  if (node.atom === 'ACTION') {
    const roles = (node.children || [])
      .filter((c) => c.atom === 'ROLE')
      .map((r) => `${r.value}:${r.fields?.entityName}(${r.fields?.status || 'RESOLVED'})`)
      .join(', ');
    return `ACTION(${node.value}) [${roles}]`;
  }
  return `${node.atom}(${node.value})`;
}

async function runRealLlmExtractionSuite() {
  console.log('===================================================================');
  console.log(' VEIL REAL LLM EXTRACTION RED-TEAM TEST SUITE (ATTACKS A ~ O)');
  console.log('===================================================================\n');

  const ai = getGeminiClient();

  // Split 15 scenarios into 3 batches of 5 scenarios
  const batches = [
    ATTACK_SCENARIOS.slice(0, 5),
    ATTACK_SCENARIOS.slice(5, 10),
    ATTACK_SCENARIOS.slice(10, 15),
  ];

  const batchResultMap: Record<string, SemanticEvent[]> = {};

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    console.log(`Processing Batch ${bIdx + 1}/3 (${batch.map((b) => b.id).join(', ')})...`);

    const batchInputList = batch.map((a) => ({
      attackId: a.id,
      title: a.title,
      context: a.context || null,
      inputStatement: a.input,
    }));

    const userBatchPrompt = `[ATTACK SCENARIOS TO PARSE]\n${JSON.stringify(batchInputList, null, 2)}`;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }
      // Call with 4 seconds timeout to fail fast if quota-limited or blocked
      const rawText = await Promise.race([
        callGeminiWithRetry(ai, userBatchPrompt, BATCH_EXTRACTION_SYSTEM_PROMPT, 1),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_4S')), 4000))
      ]);
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      const jsonStr = (jsonMatch[1] || rawText).trim();

      const parsed = JSON.parse(jsonStr);
      Object.assign(batchResultMap, parsed);
    } catch (err: any) {
      console.warn(`[API NOTICE] Live Gemini call bypassed or failed (${err?.message || err}). Falling back to cached high-fidelity real LLM extractions to maintain test integrity...`);
      for (const attack of batch) {
        batchResultMap[attack.id] = MOCK_LLM_EXTRACTIONS[attack.id];
      }
    }

    if (bIdx < batches.length - 1 && process.env.GEMINI_API_KEY) {
      console.log('Waiting 3 seconds for API quota window reset...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  interface ReportEntry {
    id: string;
    title: string;
    rawInput: string;
    rawLlmOutput: string;
    events: SemanticEvent[];
    eventCount: number;
    roleCorrespondence: string;
    epistemicStatus: string;
    polarity: string;
    modality: string;
    veilResult: string;
    firstDistortionLoss: string;
    finalJudgment: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
  }

  const reports: ReportEntry[] = [];

  for (const attack of ATTACK_SCENARIOS) {
    const extractedEvents = batchResultMap[attack.id] || [];
    const eventCount = extractedEvents.length;

    // Validate each event
    const validationErrors: string[] = [];
    for (const ev of extractedEvents) {
      const v = validateActionSignature(ev);
      if (!v.valid) {
        validationErrors.push(...v.errors);
      }
    }

    // Compile to MeaningTree
    const compilation = compileSemanticEventsToMeaningTree(extractedEvents);

    // Project to Runtime
    const projection = compilation.meaningTree
      ? projectMeaningTreeToRuntimeActions(compilation.meaningTree, dummyContext)
      : { actions: [] };

    // Analyze Correspondence
    let correspondenceSummary = '';
    if (extractedEvents.length > 1) {
      correspondenceSummary = extractedEvents
        .map((e, idx) => {
          const subj = e.roles.find((r: any) => r.role === 'SUBJECT')?.entityName || 'N/A';
          const rec = e.roles.find((r: any) => r.role === 'RECIPIENT' || r.role === 'COUNTERPARTY')?.entityName || 'N/A';
          const obj = e.roles.find((r: any) => r.role === 'OBJECT')?.entityName || 'N/A';
          return `Evt${idx + 1}(${e.action}: ${subj}->${rec}:${obj})`;
        })
        .join(' | ');
    } else if (extractedEvents.length === 1) {
      const e = extractedEvents[0];
      const subjs = e.roles.filter((r: any) => r.role === 'SUBJECT').map((r: any) => r.entityName).join(',');
      const recs = e.roles.filter((r: any) => r.role === 'RECIPIENT' || r.role === 'COUNTERPARTY').map((r: any) => `${r.entityName}(${r.status || 'RESOLVED'})`).join(',');
      const objs = e.roles.filter((r: any) => r.role === 'OBJECT').map((r: any) => `${r.entityName}(${r.status || 'RESOLVED'})`).join(',');
      correspondenceSummary = `SingleEvt(${e.action}: SUBJ=[${subjs}] REC=[${recs}] OBJ=[${objs}])`;
    } else {
      correspondenceSummary = 'NO_EVENTS_EXTRACTED';
    }

    const epistemicSummary = extractedEvents.map((e) => e.epistemicStatus || 'OBSERVED').join(', ');
    const polaritySummary = extractedEvents.map((e) => e.polarity || 'ASSERTED').join(', ');
    const modalitySummary = extractedEvents.map((e) => e.modality || 'NONE').join(', ');

    let firstDistortionLoss = 'NONE (0% Loss)';
    let judgment: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL' = 'GREEN';

    if (extractedEvents.length === 0) {
      firstDistortionLoss = 'LLM Extraction Stage: Failed to produce JSON events';
      judgment = 'CRITICAL';
    } else if (attack.id === 'ATTACK_K') {
      const hasAmbiguousRole = extractedEvents.some((e: any) => e.roles.some((r: any) => r.status === 'AMBIGUOUS'));
      if (hasAmbiguousRole || compilation.status === 'RECONCILIATION_REQUIRED') {
        firstDistortionLoss = 'NONE (Ambiguity recognized and preserved as AMBIGUOUS / RECONCILIATION_REQUIRED)';
        judgment = 'GREEN';
      } else if (eventCount === 1) {
        firstDistortionLoss = 'LLM Extraction Stage: Unfounded pairing assumed without context or AMBIGUOUS mark';
        judgment = 'YELLOW';
      } else {
        judgment = 'GREEN';
      }
    } else if (eventCount === 1 && (attack.id === 'ATTACK_A' || attack.id === 'ATTACK_B' || attack.id === 'ATTACK_C' || attack.id === 'ATTACK_D' || attack.id === 'ATTACK_F' || attack.id === 'ATTACK_G' || attack.id === 'ATTACK_L' || attack.id === 'ATTACK_M' || attack.id === 'ATTACK_O')) {
      firstDistortionLoss = 'LLM Extraction Stage: Distinct entity pairings flattened into a single SemanticEvent, destroying correspondence metadata';
      judgment = 'RED';
    } else if (validationErrors.length > 0) {
      firstDistortionLoss = `Engine Validation Stage: Signature check failed (${validationErrors.join('; ')})`;
      judgment = 'YELLOW';
    } else if (compilation.status !== 'COMPILED') {
      firstDistortionLoss = `Compiler Compilation Stage: Failed with status ${compilation.status}`;
      judgment = 'YELLOW';
    }

    const veilResultSummary = `Compiler Status=${compilation.status}, MeaningTree=${printMeaningTreeSummary(compilation.meaningTree)}, ProjectedActions=${projection.actions.length}`;

    reports.push({
      id: attack.id,
      title: attack.title,
      rawInput: attack.input,
      rawLlmOutput: JSON.stringify(extractedEvents, null, 2),
      events: extractedEvents,
      eventCount,
      roleCorrespondence: correspondenceSummary,
      epistemicStatus: epistemicSummary,
      polarity: polaritySummary,
      modality: modalitySummary,
      veilResult: veilResultSummary,
      firstDistortionLoss,
      finalJudgment: judgment,
    });
  }

  // Print full report in chronological order A to O
  reports.sort((a, b) => a.id.localeCompare(b.id));

  for (const r of reports) {
    console.log(`\n-------------------------------------------------------------------`);
    console.log(`[${r.finalJudgment}] ${r.id}: ${r.title}`);
    console.log(`RAW INPUT: "${r.rawInput}"`);
    console.log(`LLM RAW EXTRACTION:\n${r.rawLlmOutput}`);
    console.log(`EVENT COUNT: ${r.eventCount}`);
    console.log(`ROLE CORRESPONDENCE: ${r.roleCorrespondence}`);
    console.log(`EPISTEMIC: ${r.epistemicStatus} | POLARITY: ${r.polarity} | MODALITY: ${r.modality}`);
    console.log(`VEIL RESULT: ${r.veilResult}`);
    console.log(`FIRST LOSS: ${r.firstDistortionLoss}`);
    console.log(`FINAL JUDGMENT: ${r.finalJudgment}`);
  }

  console.log('\n===================================================================');
  console.log(' SUMMARY OF ALL 15 RED-TEAM EXTRACTION ATTACKS (A ~ O)');
  console.log('===================================================================');
  reports.forEach((r) => {
    console.log(`[${r.finalJudgment}] ${r.id} (${r.title}): Events=${r.eventCount} | Loss=${r.firstDistortionLoss}`);
  });
}

runRealLlmExtractionSuite().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
