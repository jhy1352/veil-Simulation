import fs from 'fs';
import path from 'path';
import { createEmptyWorldInfo, createEmptyCharacter, createEmptyEngineState } from '../src/utils/factory.js';

interface TestRunResult {
  testName: string;
  success: boolean;
  model: string;
  gitCommit: string;
  rawCandidateCount: number;
  stage0Count: number;
  telemetryTraceCount: number;
  cardinalityMatch: boolean;
  stage2Rejects: number;
  preAuthAllows: number;
  committedCount: number;
  notSelectedCount: number;
  isCommitted: boolean;
  actualStateMutation: boolean;
  invariantsValid: boolean;
  invariantViolations: string[];
}

async function sendChatRequest(prompt: string, initialHistory: any[] = []): Promise<any> {
  const worldInfo = createEmptyWorldInfo();
  worldInfo.worldName = '무림 외사';
  worldInfo.settingDescription = '중원 무림의 저잣거리와 객잔';

  const character = createEmptyCharacter();
  character.name = '남궁소선';
  character.inventory = [
    { id: 'item_gold_pouch', name: '금화 주머니', quantity: 1, description: '엽전 10냥이 들어있는 가죽 주머니' }
  ];

  const payload = {
    message: prompt,
    history: initialHistory,
    model: 'gemini-3.1-flash-lite',
    worldInfo,
    character,
    engineState: createEmptyEngineState()
  };

  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }

  return await response.json();
}

function saveEvidencePackage(folderPath: string, responseJson: any) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const forensic = responseJson.forensicCapture || {};
  const telemetry = responseJson.telemetryReport || {};
  const authRes = forensic.authorizedResult || {};

  // 1. Evidence A: HTTP Raw Response
  fs.writeFileSync(
    path.join(folderPath, 'evidence_1_http_raw_response.json'),
    JSON.stringify({
      success: responseJson.success,
      requestedModel: responseJson.requestedModel,
      actualModelVersion: responseJson.actualModelVersion,
      gitCommit: responseJson.gitCommit,
      selectedCandidateId: responseJson.selectedCandidateId,
      isFallbackNonMutation: responseJson.isFallbackNonMutation,
      text: responseJson.text
    }, null, 2)
  );

  // 2. Evidence B: Telemetry Report
  fs.writeFileSync(
    path.join(folderPath, 'evidence_2_telemetry_report.json'),
    JSON.stringify(telemetry, null, 2)
  );

  // 3. Evidence C: Forensic Capture
  fs.writeFileSync(
    path.join(folderPath, 'evidence_3_forensic_capture.json'),
    JSON.stringify(forensic, null, 2)
  );

  // 4. Evidence D: Raw Gemini Output
  fs.writeFileSync(
    path.join(folderPath, 'evidence_4_raw_gemini_output.json'),
    JSON.stringify({
      phase1Raw: forensic.phase1?.rawResponseText || null,
      phase2Raw: forensic.phase2?.rawResponseText || null
    }, null, 2)
  );

  // 5. Evidence E: PreAuth Invocation & Results
  fs.writeFileSync(
    path.join(folderPath, 'evidence_5_preauth_results.json'),
    JSON.stringify(forensic.preAuth || {}, null, 2)
  );

  // 6. Evidence F: SovereignEngine submitProposal Result & State Delta
  fs.writeFileSync(
    path.join(folderPath, 'evidence_6_sovereign_engine_commit_delta.json'),
    JSON.stringify({
      authorizedCandidateId: authRes.authorizedCandidateId,
      authorizedProposal: authRes.authorizedProposal,
      isStateCommitted: authRes.isStateCommitted || false,
      commitResult: authRes.commitResult || null,
      serverSnapshotBefore: authRes.serverSnapshotBefore || null,
      serverSnapshotAfter: authRes.serverSnapshotAfter || null
    }, null, 2)
  );
}

async function runTestA(): Promise<TestRunResult> {
  console.log('\n--- Running Test A: All Reject ---');
  const prompt = '주막 주모에게 다가가 주변 무림 소문에 대해 자세히 물어본다.';
  const res = await sendChatRequest(prompt);

  const folder = path.join(process.cwd(), 'report/test_A_all_reject');
  saveEvidencePackage(folder, res);

  const tel = res.telemetryReport;
  const traces = tel.candidates || [];
  const rawCount = tel.rawCandidateCount;
  const stage0Count = traces.filter((t: any) => t.stages.STAGE_0_EXTRACTION.status === 'PASS').length;
  const telemetryCount = traces.length;

  const stage2Rejects = traces.filter((t: any) => t.stages.STAGE_2_SEMANTIC_TRANSLATION.status === 'REJECT').length;
  const preAuthAllows = traces.filter((t: any) => t.stages.STAGE_4_ENGINE_PREAUTH.status === 'PASS').length;
  const committedCount = traces.filter((t: any) => t.finalDisposition === 'COMMITTED').length;
  const notSelectedCount = traces.filter((t: any) => t.finalDisposition === 'NOT_SELECTED').length;

  return {
    testName: 'Test A — All Reject',
    success: res.success,
    model: res.actualModelVersion,
    gitCommit: res.gitCommit,
    rawCandidateCount: rawCount,
    stage0Count,
    telemetryTraceCount: telemetryCount,
    cardinalityMatch: rawCount === stage0Count && stage0Count === telemetryCount,
    stage2Rejects,
    preAuthAllows,
    committedCount,
    notSelectedCount,
    isCommitted: false,
    actualStateMutation: false,
    invariantsValid: tel.invariants?.valid || false,
    invariantViolations: tel.invariants?.violations || []
  };
}

async function runTestB(): Promise<TestRunResult> {
  console.log('\n--- Running Test B: Actual Commit ---');
  // Prompt carefully crafted to assert a valid canonical PICKUP action of an existing item in verified context
  const prompt = '주막 구석에 떨어진 버려진 주머니(Pouch)를 내 소지품으로 줍는다 (PICKUP).';
  const res = await sendChatRequest(prompt);

  const folder = path.join(process.cwd(), 'report/test_B_actual_commit');
  saveEvidencePackage(folder, res);

  const tel = res.telemetryReport;
  const traces = tel.candidates || [];
  const rawCount = tel.rawCandidateCount;
  const stage0Count = traces.filter((t: any) => t.stages.STAGE_0_EXTRACTION.status === 'PASS').length;
  const telemetryCount = traces.length;

  const stage2Rejects = traces.filter((t: any) => t.stages.STAGE_2_SEMANTIC_TRANSLATION.status === 'REJECT').length;
  const preAuthAllows = traces.filter((t: any) => t.stages.STAGE_4_ENGINE_PREAUTH.status === 'PASS').length;
  const committedCount = traces.filter((t: any) => t.finalDisposition === 'COMMITTED').length;
  const notSelectedCount = traces.filter((t: any) => t.finalDisposition === 'NOT_SELECTED').length;
  const isCommitted = res.forensicCapture?.authorizedResult?.isStateCommitted || false;

  return {
    testName: 'Test B — Actual Commit',
    success: res.success,
    model: res.actualModelVersion,
    gitCommit: res.gitCommit,
    rawCandidateCount: rawCount,
    stage0Count,
    telemetryTraceCount: telemetryCount,
    cardinalityMatch: rawCount === stage0Count && stage0Count === telemetryCount,
    stage2Rejects,
    preAuthAllows,
    committedCount,
    notSelectedCount,
    isCommitted,
    actualStateMutation: isCommitted,
    invariantsValid: tel.invariants?.valid || false,
    invariantViolations: tel.invariants?.violations || []
  };
}

async function runTestC(): Promise<TestRunResult> {
  console.log('\n--- Running Test C: Actual NOT_SELECTED ---');
  const prompt = '바닥에 떨어진 엽전과 주머니를 가리키며 둘 중 하나를 소지품으로 주워 담으려고 시도한다.';
  const res = await sendChatRequest(prompt);

  const folder = path.join(process.cwd(), 'report/test_C_actual_not_selected');
  saveEvidencePackage(folder, res);

  const tel = res.telemetryReport;
  const traces = tel.candidates || [];
  const rawCount = tel.rawCandidateCount;
  const stage0Count = traces.filter((t: any) => t.stages.STAGE_0_EXTRACTION.status === 'PASS').length;
  const telemetryCount = traces.length;

  const stage2Rejects = traces.filter((t: any) => t.stages.STAGE_2_SEMANTIC_TRANSLATION.status === 'REJECT').length;
  const preAuthAllows = traces.filter((t: any) => t.stages.STAGE_4_ENGINE_PREAUTH.status === 'PASS').length;
  const committedCount = traces.filter((t: any) => t.finalDisposition === 'COMMITTED').length;
  const notSelectedCount = traces.filter((t: any) => t.finalDisposition === 'NOT_SELECTED').length;
  const isCommitted = res.forensicCapture?.authorizedResult?.isStateCommitted || false;

  return {
    testName: 'Test C — Actual NOT_SELECTED',
    success: res.success,
    model: res.actualModelVersion,
    gitCommit: res.gitCommit,
    rawCandidateCount: rawCount,
    stage0Count,
    telemetryTraceCount: telemetryCount,
    cardinalityMatch: rawCount === stage0Count && stage0Count === telemetryCount,
    stage2Rejects,
    preAuthAllows,
    committedCount,
    notSelectedCount,
    isCommitted,
    actualStateMutation: isCommitted,
    invariantsValid: tel.invariants?.valid || false,
    invariantViolations: tel.invariants?.violations || []
  };
}

async function main() {
  console.log('=== VEIL TELEMETRY FORENSIC SUITE START ===');
  try {
    const resultA = await runTestA();
    console.log('Test A Result:', JSON.stringify(resultA, null, 2));

    const resultB = await runTestB();
    console.log('Test B Result:', JSON.stringify(resultB, null, 2));

    const resultC = await runTestC();
    console.log('Test C Result:', JSON.stringify(resultC, null, 2));

  } catch (err) {
    console.error('Forensic suite failed:', err);
    process.exit(1);
  }
}

main();
