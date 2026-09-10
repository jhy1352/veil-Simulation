# ROLE Red-Team Map Overwrite Vulnerability Remediation Report

## 1. Remediation Summary
- **Target File**: `src/engine/language/causalCompiler.ts`
- **Vulnerability**: `validateActionSignature()` used `Map<CanonicalRole, SemanticEventRole>` which caused duplicate ROLEs in an event to overwrite previous entries, dropping `AMBIGUOUS` / `UNRESOLVED` role reference statuses if followed by a `RESOLVED` role.
- **Fix**: Replaced Map lookup with direct array iteration (`event.roles.filter(...)` and `for (const r of event.roles)`), guaranteeing every role in the original event array is validated independently without overwrite.

## 2. Modified Files
1. `src/engine/language/causalCompiler.ts`
2. `src/engine/language/roleRedTeamRunner.ts`

## 3. Red-Team Test Results
- Attack A (Duplicate ROLE Input): PASS
- Attack B (Explicit Binding): PASS
- Attack C (Unbound Multiple Roles): PASS [WARNING: Validator/Compiler passes Event C; RuntimeProjection Fail-Closed blocks execution]
- Attack D (Map Overwrite Direct Attack): PASS
- Attack D-2 (Reversed Order Overwrite): PASS
- Attack D-3 (AMBIGUOUS + RESOLVED): PASS
- Attack D-4 (UNRESOLVED + RESOLVED): PASS
- Attack E (AMBIGUOUS Silent Promotion): PASS
- Attack F (Multiple Roles + UNPROVEN Cause): PASS

## 4. Regression Test Results
- `npm run test:temporal-redteam`: 12/12 PASSED (ALL PASSED)
- `npx tsx src/engine/language/semanticExecutionBoundaryRedTeamTest.ts`: ALL PROBES PASSED
