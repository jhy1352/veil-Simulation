import fs from 'fs';
import path from 'path';
import { runSovereignEngineTestSuite } from '../src/engine/testRunner';

async function main() {
  const reportDir = path.resolve(process.cwd(), 'report/08_5_7_break_remediation');
  console.log('Running full 90-test engine test suite for regression evidence...');
  
  const results = runSovereignEngineTestSuite();
  const passedCount = results.results.filter(r => r.passed).length;
  const failedCount = results.results.filter(r => !r.passed).length;
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.results.length,
    passed: passedCount,
    failed: failedCount,
    allPassed: results.passed,
    tests: results.results
  };

  const regressionPath = path.join(reportDir, '04_regression_suite_results.json');
  fs.writeFileSync(regressionPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Saved regression evidence: ${regressionPath}`);
  console.log(`Summary: ${passedCount}/${results.results.length} tests passed.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
