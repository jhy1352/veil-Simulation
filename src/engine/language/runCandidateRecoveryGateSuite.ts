/**
 * @file src/engine/language/runCandidateRecoveryGateSuite.ts
 * @description Command-line execution runner for VEIL Candidate Recovery Gate Exhaustive Tests
 */

import { runCandidateRecoveryGateTests } from './candidateRecoveryGateTest';
import { runEntityIdentityResolverTests } from '../index/entityIdentityResolverTest';

console.log('================================================================');
console.log('  VEIL CANDIDATE RECOVERY GATE — RED TEAM EXHAUSTIVE SUITE');
console.log('================================================================\n');

const startTime = Date.now();
const report = runCandidateRecoveryGateTests();
const identityReport = runEntityIdentityResolverTests();
const duration = Date.now() - startTime;

console.log(`Executed: ${report.totalTests} candidate-gate assertions + ${identityReport.passed + identityReport.failed} identity assertions`);
console.log(`Passed:   ${report.passedTests + identityReport.passed} PASSED`);
console.log(`Failed:   ${report.failedTests + identityReport.failed} FAILED`);
console.log(`Duration: ${duration}ms\n`);

report.details.forEach((d, idx) => {
  const marker = d.status === 'PASSED' ? '[PASS]' : '[FAIL]';
  console.log(`${marker} #${idx + 1}: ${d.name}`);
  if (d.error) console.error(`       Error: ${d.error}`);
});
identityReport.details.forEach((d, idx) => console.log(`${d.startsWith('PASS:') ? '[PASS]' : '[FAIL]'} [IDENTITY #${idx + 1}] ${d.replace(/^(PASS|FAIL):\s*/, '')}`));

console.log('\n================================================================');
if (report.failedTests === 0 && identityReport.failed === 0) {
  console.log('  VERDICT: 100% PASS - CANDIDATE GATE + IDENTITY REGRESSION SUITE');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error('  VERDICT: TEST SUITE FAILED');
  console.log('================================================================');
  process.exit(1);
}
