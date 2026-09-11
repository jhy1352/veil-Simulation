import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { MASTER_SYSTEM_INSTRUCTION } from '../src/engine/language/masterPrompt.ts';

interface TestCase {
  id: string;
  category: string;
  input: string;
}

const TEST_CASES: TestCase[] = [
  { id: 'T01', category: '단순 사건', input: '플레이어가 바닥에서 녹슨 단검을 주웠다.' },
  { id: 'T02', category: '복합 사건', input: '경비병이 문을 열고 안으로 들어간 뒤, 바닥에 떨어진 열쇠를 주워 주머니에 넣었다.' },
  { id: 'T03', category: '의도', input: '플레이어는 경비병에게서 열쇠를 훔치려고 했다.' },
  { id: 'T04', category: '실패한 시도', input: '플레이어가 열쇠를 훔치려 했지만 실패했다.' },
  { id: 'T05', category: '전언', input: '마을 사람들은 북쪽 폐허에 검은 보물이 있다고 말했다.' },
  { id: 'T06', category: '부정', input: '플레이어는 열쇠를 줍지 않았다.' },
  { id: 'T07', category: '추론', input: '문이 열려 있는 것을 보니 누군가 조금 전에 들어간 것 같다.' },
  { id: 'T08', category: '가능성', input: '아마 경비병이 열쇠를 숨겼을 것이다.' },
  { id: 'T09', category: '명시적 인과', input: '경비병이 문을 열고 들어갔다. 그래서 플레이어가 안으로 들어갔다.' },
  { id: 'T10', category: '단순 시간적 순서', input: '경비병이 문을 열고 들어간 뒤 플레이어가 열쇠를 주웠다.' },
  { id: 'T11', category: '존재하지 않는 대상', input: '존재하지 않는 NPC가 플레이어에게 검을 주었다.' },
  { id: 'T12', category: '동일명 개체', input: '같은 이름의 경비병 두 명 중 한 명이 열쇠를 건넸다.' },
  { id: 'T13', category: '발견과 고민', input: '플레이어가 열쇠를 발견했고, 그것을 챙길까 고민했다.' },
  { id: 'T14', category: '대명사', input: '플레이어가 낡은 상자를 열었다. 그는 그것을 주머니에 넣었다.' },
  { id: 'T15', category: '주장과 검증', input: '플레이어가 열쇠를 가져갔다고 경비병이 주장했지만 실제로는 확인되지 않았다.' },
  { id: 'T16', category: '복합 의미', input: '플레이어가 열쇠를 주우려고 했지만 손이 닿지 않았고, 결국 경비병에게 열쇠를 달라고 부탁했다.' }
];

const DIRECTIVE_TEXT = `#### SEMANTIC PRESERVATION DIRECTIVE (헌법 제1장, 제7장, 제8장, 제26장):
Translate natural language into SemanticEvents without adding, removing, upgrading, or reversing meaning:
1. Event ≠ Intent: An intended, attempted, desired, or planned action is not an accomplished action.
2. Fact ≠ Claim ≠ Hearsay ≠ Inference ≠ Possibility: Never promote one epistemic state into another.
3. Asserted ≠ Verified: Linguistic assertion alone never establishes canonical truth.
4. Asserted ≠ Negated: A negated event must never be emitted as an asserted event.
5. Observation ≠ Inference: Do not convert an inferred cause, motive, identity, or event into an observed fact.
6. Temporal sequence ≠ Causation: Create CAUSE only when causal meaning is explicitly supported by the source text.
7. Attempt ≠ Outcome: Preserve both intention and actual outcome when both are expressed.
8. Compound meaning must remain decomposable: Do not collapse independently meaningful events into one event merely because they occur in the same sentence.
9. Preserve uncertainty: When the source does not establish a fact, use the appropriate epistemic, polarity, modality, and scope state rather than inventing certainty.
10. No semantic invention: Do not invent entities, relationships, causes, provenance, canonical IDs, outcomes, or world facts absent from the source.
*SemanticEvents describe interpreted meaning only. They do not authorize Canonical State changes.*`;

// Condition B = Full Master System Instruction with Directive
const SYSTEM_INSTRUCTION_CONDITION_B = MASTER_SYSTEM_INSTRUCTION;

// Condition A = Master System Instruction with Directive removed
const SYSTEM_INSTRUCTION_CONDITION_A = MASTER_SYSTEM_INSTRUCTION.replace(DIRECTIVE_TEXT, '').replace(/\n\s*\n\s*\ntype CandidateOutput/g, '\n\ntype CandidateOutput');

const initialContextPrompt = `[TRPG Campaign Context]
- 세계관명: 기본 세계
- 세계관 설정: 중세 판타지 세계관
- 문체 스타일: 정통 고전 판타지
- 주인공 프로필: 주인공 (나이: 25, 성별: 남)
  * 출신/배경: [preset] 방랑자
  * 결핍/트라우마: [preset] 없음
  * 맹세: [preset] 없음
  * 닻: [preset] 없음
  * 소속/세력: [preset] 무소속
  * 능력치: STR 10 / AGI 10 / CON 10 / INT 10 / WIS 10 / CHA 10
  * 소장품: 없음`;

function extractJsonBlock(rawText: string): { parsed: any | null; success: boolean; error?: string } {
  try {
    const blockMatch = rawText.match(/\[CANDIDATES_BLOCK\]([\s\S]*?)\[CANDIDATES_END\]/);
    let target = blockMatch ? blockMatch[1].trim() : rawText.trim();
    if (target.startsWith('```json')) {
      target = target.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    } else if (target.startsWith('```')) {
      target = target.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }
    const parsed = JSON.parse(target);
    return { parsed, success: true };
  } catch (err: any) {
    return { parsed: null, success: false, error: err?.message || String(err) };
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('FATAL: GEMINI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-3.7-flash';
  const generationConfig = {
    thinkingConfig: {
      thinkingBudget: 4096
    }
  };

  const results: any[] = [];
  const outputDir = path.resolve(process.cwd(), 'report', '63_semantic_preservation_ab_test');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('================================================================');
  console.log('Starting VEIL Semantic Preservation A/B Test (16 cases x 2 cond)');
  console.log('Model:', modelName);
  console.log('Thinking Budget:', generationConfig.thinkingConfig.thinkingBudget);
  console.log('Output Directory:', outputDir);
  console.log('================================================================\n');

  for (const testCase of TEST_CASES) {
    console.log(`[TEST ${testCase.id}] ${testCase.category}: "${testCase.input}"`);

    // Run Condition A (Baseline - Without Directive)
    {
      console.log(`  -> Running Condition A (Baseline)...`);
      const userContent = `${initialContextPrompt}\n\n[TURN 1 PLAYER PROMPT]\n${testCase.input}`;
      const tStart = Date.now();
      let rawLlmOutput = '';
      let responseId: string | undefined = undefined;
      let modelVersion: string | undefined = undefined;
      let parseResult: { parsed: any | null; success: boolean; error?: string } = { parsed: null, success: false };

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_CONDITION_A,
            thinkingConfig: generationConfig.thinkingConfig
          }
        });
        rawLlmOutput = response.text || '';
        responseId = response.responseId;
        modelVersion = response.modelVersion;
        parseResult = extractJsonBlock(rawLlmOutput);
      } catch (err: any) {
        rawLlmOutput = `ERROR: ${err?.message || String(err)}`;
        parseResult = { parsed: null, success: false, error: String(err) };
      }

      const recordA = {
        testId: testCase.id,
        category: testCase.category,
        condition: 'A',
        conditionDescription: 'Baseline (System prompt without Semantic Preservation Directive)',
        input: testCase.input,
        rawLlmOutput,
        parsedJson: parseResult.parsed,
        parseSuccess: parseResult.success,
        parseError: parseResult.error,
        model: modelName,
        actualModelVersion: modelVersion,
        generationConfig,
        responseId,
        durationMs: Date.now() - tStart,
        timestamp: new Date().toISOString()
      };
      results.push(recordA);
      console.log(`     Condition A Complete (Parsed: ${parseResult.success}, Time: ${recordA.durationMs}ms)`);
      await sleep(1500);
    }

    // Run Condition B (Directive - With Directive)
    {
      console.log(`  -> Running Condition B (Directive)...`);
      const userContent = `${initialContextPrompt}\n\n[TURN 1 PLAYER PROMPT]\n${testCase.input}`;
      const tStart = Date.now();
      let rawLlmOutput = '';
      let responseId: string | undefined = undefined;
      let modelVersion: string | undefined = undefined;
      let parseResult: { parsed: any | null; success: boolean; error?: string } = { parsed: null, success: false };

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_CONDITION_B,
            thinkingConfig: generationConfig.thinkingConfig
          }
        });
        rawLlmOutput = response.text || '';
        responseId = response.responseId;
        modelVersion = response.modelVersion;
        parseResult = extractJsonBlock(rawLlmOutput);
      } catch (err: any) {
        rawLlmOutput = `ERROR: ${err?.message || String(err)}`;
        parseResult = { parsed: null, success: false, error: String(err) };
      }

      const recordB = {
        testId: testCase.id,
        category: testCase.category,
        condition: 'B',
        conditionDescription: 'Directive (System prompt with Semantic Preservation Directive)',
        input: testCase.input,
        rawLlmOutput,
        parsedJson: parseResult.parsed,
        parseSuccess: parseResult.success,
        parseError: parseResult.error,
        model: modelName,
        actualModelVersion: modelVersion,
        generationConfig,
        responseId,
        durationMs: Date.now() - tStart,
        timestamp: new Date().toISOString()
      };
      results.push(recordB);
      console.log(`     Condition B Complete (Parsed: ${parseResult.success}, Time: ${recordB.durationMs}ms)\n`);
      await sleep(1500);
    }
  }

  // Save raw evidence JSON
  const rawEvidencePath = path.join(outputDir, 'raw_evidence.json');
  fs.writeFileSync(rawEvidencePath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Saved raw evidence to ${rawEvidencePath}`);

  // Generate Report Text
  let reportText = `================================================================================
VEIL NARRATIVE ENGINE 3.1 - SEMANTIC PRESERVATION A/B TEST REPORT
Report ID: 63_semantic_preservation_ab_test
Model: ${modelName}
Thinking Budget: 4096
Total Test Cases: 16
Total Executed Runs: 32 (16 Cases x 2 Conditions)
Timestamp: ${new Date().toISOString()}
================================================================================

1. TEST OBJECTIVE & CONDITIONS
--------------------------------------------------------------------------------
Objective:
  Evaluate the empirical difference in SemanticEvent representation fidelity
  between Baseline (Condition A) and Semantic Preservation Directive (Condition B).

Condition A (Baseline):
  Master System Instruction for LLM #1 candidate generation WITHOUT the
  SEMANTIC PRESERVATION DIRECTIVE.

Condition B (Directive):
  Master System Instruction for LLM #1 candidate generation WITH the
  SEMANTIC PRESERVATION DIRECTIVE (10 Tenets & Epistemic Authority Axiom).

Input Cases:
  T01: 단순 사건 - 플레이어가 바닥에서 녹슨 단검을 주웠다.
  T02: 복합 사건 - 경비병이 문을 열고 안으로 들어간 뒤, 바닥에 떨어진 열쇠를 주워 주머니에 넣었다.
  T03: 의도 - 플레이어는 경비병에게서 열쇠를 훔치려고 했다.
  T04: 실패한 시도 - 플레이어가 열쇠를 훔치려 했지만 실패했다.
  T05: 전언 - 마을 사람들은 북쪽 폐허에 검은 보물이 있다고 말했다.
  T06: 부정 - 플레이어는 열쇠를 줍지 않았다.
  T07: 추론 - 문이 열려 있는 것을 보니 누군가 조금 전에 들어간 것 같다.
  T08: 가능성 - 아마 경비병이 열쇠를 숨겼을 것이다.
  T09: 명시적 인과 - 경비병이 문을 열고 들어갔다. 그래서 플레이어가 안으로 들어갔다.
  T10: 단순 시간적 순서 - 경비병이 문을 열고 들어간 뒤 플레이어가 열쇠를 주웠다.
  T11: 존재하지 않는 대상 - 존재하지 않는 NPC가 플레이어에게 검을 주었다.
  T12: 동일명 개체 - 같은 이름의 경비병 두 명 중 한 명이 열쇠를 건넸다.
  T13: 발견과 고민 - 플레이어가 열쇠를 발견했고, 그것을 챙길까 고민했다.
  T14: 대명사 - 플레이어가 낡은 상자를 열었다. 그는 그것을 주머니에 넣었다.
  T15: 주장과 검증 - 플레이어가 열쇠를 가져갔다고 경비병이 주장했지만 실제로는 확인되지 않았다.
  T16: 복합 의미 - 플레이어가 열쇠를 주우려고 했지만 손이 닿지 않았고, 결국 경비병에게 열쇠를 달라고 부탁했다.

2. A/B TEST EXECUTION SUMMARY TABLE
--------------------------------------------------------------------------------
`;

  reportText += `| Test ID | Category | Input | Cond A Parse | Cond B Parse | SemanticEvents (A) | SemanticEvents (B) |\n`;
  reportText += `|---|---|---|---|---|---|---|\n`;

  for (const testCase of TEST_CASES) {
    const resA = results.find(r => r.testId === testCase.id && r.condition === 'A');
    const resB = results.find(r => r.testId === testCase.id && r.condition === 'B');

    const aParse = resA?.parseSuccess ? 'OK' : 'FAIL';
    const bParse = resB?.parseSuccess ? 'OK' : 'FAIL';

    const eventsA = resA?.parsedJson ? resA.parsedJson.map((c: any) => c.semanticEvents?.length || 0).join('/') : 'N/A';
    const eventsB = resB?.parsedJson ? resB.parsedJson.map((c: any) => c.semanticEvents?.length || 0).join('/') : 'N/A';

    reportText += `| ${testCase.id} | ${testCase.category} | ${testCase.input} | ${aParse} | ${bParse} | ${eventsA} | ${eventsB} |\n`;
  }

  reportText += `\n3. DETAILED PER-TEST RAW EVIDENCE & SEMANTIC ANALYSIS\n--------------------------------------------------------------------------------\n`;

  for (const testCase of TEST_CASES) {
    const resA = results.find(r => r.testId === testCase.id && r.condition === 'A');
    const resB = results.find(r => r.testId === testCase.id && r.condition === 'B');

    reportText += `\n================================================================================\n`;
    reportText += `[TEST ${testCase.id}] ${testCase.category}\n`;
    reportText += `Input: "${testCase.input}"\n`;
    reportText += `--------------------------------------------------------------------------------\n`;

    reportText += `--- CONDITION A (BASELINE) ---\n`;
    reportText += `Response ID: ${resA?.responseId || 'N/A'}\n`;
    reportText += `Parse Success: ${resA?.parseSuccess}\n`;
    if (resA?.parseError) reportText += `Parse Error: ${resA.parseError}\n`;
    reportText += `Raw LLM Output:\n${resA?.rawLlmOutput}\n\n`;

    reportText += `--- CONDITION B (DIRECTIVE) ---\n`;
    reportText += `Response ID: ${resB?.responseId || 'N/A'}\n`;
    reportText += `Parse Success: ${resB?.parseSuccess}\n`;
    if (resB?.parseError) reportText += `Parse Error: ${resB.parseError}\n`;
    reportText += `Raw LLM Output:\n${resB?.rawLlmOutput}\n\n`;
  }

  reportText += `================================================================================\n`;
  reportText += `END OF REPORT\n`;
  reportText += `================================================================================\n`;

  const reportFilePath = path.join(outputDir, 'report.txt');
  fs.writeFileSync(reportFilePath, reportText, 'utf-8');
  console.log(`Saved report text to ${reportFilePath}`);
}

run().catch(err => {
  console.error('Fatal Error running A/B test:', err);
  process.exit(1);
});
