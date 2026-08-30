/**
 * @file src/engine/language/runCandidateRecoveryGateSuite.ts
 * @description Command-line execution runner for VEIL Candidate Recovery Gate Exhaustive Tests
 */

import { runCandidateRecoveryGateTests } from './candidateRecoveryGateTest';

console.log('================================================================');
console.log('  VEIL CANDIDATE RECOVERY GATE — RED TEAM EXHAUSTIVE SUITE');
console.log('================================================================\n');

const startTime = Date.now();
const report = runCandidateRecoveryGateTests();
const duration = Date.now() - startTime;

console.log(`Executed: ${report.totalTests} total scenarios / assertions`);
console.log(`Passed:   ${report.passedTests} PASSED`);
console.log(`Failed:   ${report.failedTests} FAILED`);
console.log(`Duration: ${duration}ms\n`);

report.details.forEach((d, idx) => {
  const marker = d.status === 'PASSED' ? '[PASS]' : '[FAIL]';
  console.log(`${marker} #${idx + 1}: ${d.name}`);
  if (d.error) {
    console.error(`       Error: ${d.error}`);
  }
});

console.log('\n================================================================');
if (report.failedTests === 0) {
  console.log('  VERDICT: 100% PASS - ALL 18+ ATTACK SCENARIOS NEUTRALIZED');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error('  VERDICT: TEST SUITE FAILED');
  console.log('================================================================');
  process.exit(1);
}
