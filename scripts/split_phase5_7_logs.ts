import fs from 'fs';
import path from 'path';

const rawLogPath = path.join(process.cwd(), 'phase5_7_raw_evidence_log.txt');
const rawContent = fs.readFileSync(rawLogPath, 'utf8');

const lines = rawContent.split('\n');
const totalLines = lines.length;
const chunkSize = 500;
const totalChunks = Math.ceil(totalLines / chunkSize);

const reportDir = path.join(process.cwd(), 'idea', 'report');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

console.log(`Total lines: ${totalLines}, chunk size: ${chunkSize}, total parts: ${totalChunks}`);

for (let i = 0; i < totalChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min((i + 1) * chunkSize, totalLines);
  const chunkLines = lines.slice(start, end);
  const partNum = i + 1;
  const fileName = `phase5_7_runtime_boundary_audit_raw_report_part_${partNum}.md`;
  const filePath = path.join(reportDir, fileName);

  let header = `# TRPG 3.1 — Phase 5.7 Runtime Authority Boundary Audit Raw Execution Report (Part ${partNum}/${totalChunks})\n\n`;
  header += `> Lines ${start + 1} ~ ${end} of ${totalLines}\n\n\`\`\`text\n`;
  let footer = `\n\`\`\`\n`;

  fs.writeFileSync(filePath, header + chunkLines.join('\n') + footer, 'utf8');
  console.log(`Wrote ${fileName} (${chunkLines.length} lines) [lines ${start + 1} to ${end}]`);
}
