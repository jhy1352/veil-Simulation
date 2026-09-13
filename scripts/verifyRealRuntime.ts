import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/index.js';
import { createEmptyWorldInfo, createEmptyCharacter, createEmptyEngineState } from '../src/utils/factory.js';

async function runRealRuntimeVerification() {
  console.log('=== REAL RUNTIME VERIFICATION START ===');
  console.log('Connecting to real server http://localhost:3000/api/chat...');

  const userPrompt = '마을 선술집 문을 열고 들어가 주모에게 소문과 의뢰에 대해 묻는다.';
  const payload = {
    messages: [{ role: 'user', content: userPrompt }],
    worldInfo: createEmptyWorldInfo(),
    character: createEmptyCharacter(),
    engineState: createEmptyEngineState(),
    storyTurnCount: 1,
    userPrompt,
    selectedModel: 'gemini-3.1-flash-lite',
    narrativeLocale: 'ko-KR'
  };

  const startTime = Date.now();
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VEIL-Narrative-Locale': 'ko-KR'
    },
    body: JSON.stringify(payload)
  });

  const durationMs = Date.now() - startTime;
  console.log(`HTTP Status: ${res.status} (${durationMs}ms)`);

  if (!res.ok) {
    const errText = await res.text();
    console.error('HTTP Error response:', errText);
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const responseJson = await res.json();
  console.log('Response JSON keys:', Object.keys(responseJson));
  console.log('Actual Model Version:', responseJson.actualModelVersion);
  console.log('Git Commit:', responseJson.gitCommit);

  const reportDir = path.join(process.cwd(), 'report', '01_candidate_lifecycle_real_runtime');
  fs.mkdirSync(reportDir, { recursive: true });

  // 1. Evidence A: HTTP Raw Response
  const evidenceA = {
    httpStatus: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    actualModelVersion: responseJson.actualModelVersion,
    requestedModel: responseJson.requestedModel,
    gitCommit: responseJson.gitCommit,
    responseJson
  };
  fs.writeFileSync(path.join(reportDir, 'evidence_A_http_raw.json'), JSON.stringify(evidenceA, null, 2));

  // 2. Evidence B: Server Raw Telemetry Report
  const telemetryReport = responseJson.telemetryReport;
  fs.writeFileSync(path.join(reportDir, 'evidence_B_telemetry_report.json'), JSON.stringify(telemetryReport, null, 2));

  // 3. Evidence C: Server Forensic Execution Capture
  const forensicCapture = responseJson.forensicCapture;
  fs.writeFileSync(path.join(reportDir, 'evidence_C_forensic_capture.json'), JSON.stringify(forensicCapture, null, 2));

  // 4. Evidence D: Canonical State Delta (execute actual SovereignEngine submitProposal if authorizedProposal exists)
  const initialWorld = createEmptyWorldInfo();
  const initialChar = createEmptyCharacter();
  const engine = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
  const beforeSnapshot = JSON.parse(JSON.stringify(engine.getSnapshot()));

  let commitSuccess = false;
  let commitResult = null;
  let afterSnapshot = null;

  if (responseJson.authorizedProposal) {
    commitResult = engine.submitProposal(responseJson.authorizedProposal);
    commitSuccess = commitResult.success;
    afterSnapshot = JSON.parse(JSON.stringify(engine.getSnapshot()));
  }

  const evidenceD = {
    authorizedProposal: responseJson.authorizedProposal,
    selectedCandidateId: responseJson.selectedCandidateId,
    commitExecutedOnClientEngine: Boolean(responseJson.authorizedProposal),
    commitSuccess,
    commitResult,
    beforeSnapshot,
    afterSnapshot
  };
  fs.writeFileSync(path.join(reportDir, 'evidence_D_canonical_state_delta.json'), JSON.stringify(evidenceD, null, 2));

  // 5. Evidence E: Raw Gemini Phase 1 candidates block
  const rawCandidatesBlock = responseJson.forensicCapture?.phase1?.rawCandidatesBlock || '';
  const evidenceE = {
    rawCandidatesBlock,
    rawResponseText: responseJson.forensicCapture?.phase1?.rawResponseText || ''
  };
  fs.writeFileSync(path.join(reportDir, 'evidence_E_raw_gemini_output.json'), JSON.stringify(evidenceE, null, 2));

  console.log('\n=== CROSS VERIFICATION SUMMARY ===');
  console.log(`Raw Gemini Candidate Block Length: ${rawCandidatesBlock.length}`);
  console.log(`Telemetry Report Raw Candidate Count: ${telemetryReport?.rawCandidateCount}`);
  console.log(`Stage 0 Extraction Extracted: ${telemetryReport?.blockExtraction?.extracted}`);
  console.log(`Invariants Valid: ${telemetryReport?.invariants?.valid}`);
  if (telemetryReport?.invariants?.violations?.length > 0) {
    console.log('Invariant Violations:', telemetryReport.invariants.violations);
  }

  console.log('\nMatrix:');
  console.table(telemetryReport?.matrix);

  console.log('\nCandidates Traces:');
  for (const c of telemetryReport?.candidates || []) {
    console.log(`- Candidate ${c.candidateId} (${c.label}): Final=${c.finalDisposition}, Terminal=${c.terminalStage}`);
    for (const st of Object.keys(c.stages)) {
      console.log(`  * ${st}: ${c.stages[st].status} ${c.stages[st].reason ? `(${c.stages[st].reason})` : ''}`);
    }
  }

  console.log(`\nCanonical State Commit: Success=${commitSuccess}`);
  if (commitResult) {
    console.log('Committed Record IDs:', commitResult.committedRecordIds);
    console.log('Committed Actions Count:', commitResult.committedActionsCount);
  }

  console.log(`\nAll 5 evidence files saved to ${reportDir}`);
  console.log('=== REAL RUNTIME VERIFICATION COMPLETE ===');
}

runRealRuntimeVerification().catch(err => {
  console.error('Real runtime verification failed:', err);
  process.exit(1);
});
