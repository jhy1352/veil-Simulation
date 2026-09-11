from pathlib import Path

server = Path('server.ts')
s = server.read_text(encoding='utf-8')
old = '''    const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : null;
    const selectedCandidate = selectedId !== null ? (allowedCandidates.find(c => c.candidateId === selectedId) || null) : null;
'''
new = '''    const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : null;
    const selectedTranslation = selectedId !== null
      ? (translatedCandidates.find(tc =>
          tc.candidate.candidateId === selectedId &&
          allowedCandidates.some(ac => ac.candidateId === selectedId)
        ) || null)
      : null;
    const selectedCandidate = selectedTranslation?.candidate || null;
'''
assert old in s, 'server selection block not found'
s = s.replace(old, new, 1)
old = '''      selectedCandidateId: authorizedCandidateId,
      originInputId: authorizedCandidateId ? playerInputId : undefined,
      isFallbackNonMutation: !selectedCandidate,
'''
new = '''      selectedCandidateId: authorizedCandidateId,
      originInputId: authorizedCandidateId ? playerInputId : undefined,
      authorizedCandidate: selectedTranslation?.candidate || undefined,
      authorizedCandidatePacket: selectedTranslation?.candidatePacket || undefined,
      authorizedProposal: selectedTranslation?.proposal || undefined,
      isFallbackNonMutation: !selectedCandidate,
'''
assert old in s, 'server response block not found'
server.write_text(s.replace(old, new, 1), encoding='utf-8')

app = Path('src/App.tsx')
s = app.read_text(encoding='utf-8')
s = s.replace("import {\n  extractCandidatesFromMetadata\n} from './utils/engineValidator';\n", '', 1)
s = s.replace("import { buildSafeProposalFromCandidate, generateProposalId } from './engine/proposalParser';", "import { generateProposalId } from './engine/proposalParser';", 1)
s = s.replace("import { runCandidateRecoveryGate, VeilCandidate } from './engine/language/candidateRecoveryGate';", '', 1)
start_marker = "      // Check if server explicitly issued and authorized a candidate state mutation"
end_marker = "      // Checkpoint Snapshot (Every 100 turns or first turn)"
start = s.index(start_marker)
end = s.index(end_marker, start)
replacement = '''      // Server-authorized mutation boundary: the client NEVER reconstructs Candidate/Proposal.
      // Only the exact CandidatePacket + Proposal admitted by the server may enter the local Sovereign Engine.
      const hasAuthorizedMutation = Boolean(
        data?.authorizedProposal &&
        data?.authorizedCandidatePacket &&
        data?.selectedCandidateId &&
        !data?.isFallbackNonMutation
      );

      if (hasAuthorizedMutation) {
        const candidate = data.authorizedCandidatePacket as CandidatePacket;
        const proposal = data.authorizedProposal as StateTransitionProposal;
        const authorizedCandidate = data.authorizedCandidate;

        const commitResult = engine.submitProposal(proposal);

        if (commitResult.success) {
          currentWorldInfo = commitResult.snapshot.worldInfo;
          currentCharacter = commitResult.snapshot.character;

          const currentNovelRecords = (nextEngineState as any).novelHistoryRecords || [];
          const observationResult = observeCandidateNovelHistory(
            currentNovelRecords,
            candidate,
            proposal,
            commitResult.snapshot,
            storyTurnCount,
            engine.getHistory()
          );
          (nextEngineState as any).novelHistoryRecords = observationResult.updatedRecords;
          nextEngineState.passports = projectPassports(
            commitResult.snapshot,
            engine.getHistory(),
            observationResult.updatedRecords
          );
          turnVerdict = 'PASSED';
          turnCommittedIds = commitResult.newHistoricalRecords.map(r => r.recordId);

          const diagnosticLog: ValidationDiagnosticLog = {
            logId: `log-${Date.now()}`,
            turn: storyTurnCount,
            timestamp: new Date().toISOString(),
            outcome: 'PASSED',
            details: `Turn ${storyTurnCount} server-authorized proposal committed cleanly (${commitResult.committedActionsCount} actions, StateVersion: ${commitResult.stateVersion}).`,
            rejectedReasons: []
          };
          nextEngineState.historicalRecords = engine.getHistory() as any;
          nextEngineState.diagnostics = engine.getDiagnostics();
          nextEngineState.pendingCandidates.push(candidate);
          nextEngineState.validationLogs.push(diagnosticLog);

          traceSteps.push({ step: 'T6_VALIDATED', status: 'OK', timestamp: Date.now(), details: 'Exact server-authorized proposal passed the Sovereign Engine commit gate' });
          traceSteps.push({ step: 'T7_COMMITTED', status: 'OK', timestamp: Date.now(), details: `Committed ${commitResult.committedActionsCount} server-authorized actions into canonical state (StateVersion: ${commitResult.stateVersion})` });

          setWorldInfo(commitResult.snapshot.worldInfo);
          setCharacter(commitResult.snapshot.character);
          const assistantMessage: StoryMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: rawOutputText,
            cleanText: cleanText || rawOutputText,
            metaData: authorizedCandidate?.rawMetadata || undefined,
            rawMetaBlock: rawMetaBlock || undefined,
            rawResponse: rawOutputText,
            contextSnapshot: contextSnapshot || undefined,
            turn: storyTurnCount,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setStoryTurnCount(prev => prev + 1);
        } else {
          turnVerdict = 'REJECTED';
          turnRejections = [...commitResult.rejectedReasons, ...commitResult.conflictDetails];
          nextEngineState.validationLogs.push({
            logId: `log-${Date.now()}`,
            turn: storyTurnCount,
            timestamp: new Date().toISOString(),
            outcome: 'REJECTED',
            details: `Turn ${storyTurnCount} exact server-authorized proposal rejected by Sovereign Gate: ${commitResult.rejectedReasons.join('; ')}`,
            rejectedReasons: turnRejections
          });
          traceSteps.push({ step: 'T6_VALIDATED', status: 'REJECTED', timestamp: Date.now(), details: `Sovereign Commit Gate rejected exact server-authorized proposal: ${commitResult.rejectedReasons.join('; ')}` });
          traceSteps.push({ step: 'T7_COMMITTED', status: 'REJECTED', timestamp: Date.now(), details: 'Canonical state and Novel History protected without mutation (Atomic safe no-commit)' });
          setModelError(`[VEIL_COMMIT_BLOCKED] 서버 승인 제안이 Sovereign Commit Gate에서 거부되었습니다: ${commitResult.rejectedReasons.join('; ')}`);
        }
      } else {
        traceSteps.push({ step: 'T6_VALIDATED', status: 'SKIPPED', timestamp: Date.now(), details: 'No exact server-authorized candidate/proposal received; no state mutation' });
        traceSteps.push({ step: 'T7_COMMITTED', status: 'SKIPPED', timestamp: Date.now(), details: 'Canonical state unchanged' });
        const assistantMessage: StoryMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: rawOutputText,
          cleanText: cleanText || rawOutputText,
          metaData: undefined,
          rawMetaBlock: rawMetaBlock || undefined,
          rawResponse: rawOutputText,
          contextSnapshot: contextSnapshot || undefined,
          turn: storyTurnCount,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStoryTurnCount(prev => prev + 1);
      }

'''
app.write_text(s[:start] + replacement + s[end:], encoding='utf-8')
