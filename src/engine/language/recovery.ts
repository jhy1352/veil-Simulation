/**
 * @file src/engine/language/recovery.ts
 * @description VEIL Engine Language Deterministic Syntax Recovery Layer
 * 
 * Pipeline: LLM Raw -> Recovery -> Existing Parser/Grammar -> Canonicalizer -> Adapter
 * 
 * Strict Invariants:
 * 1. Only fixes structurally and uniquely determinable syntax/lexical errors (brackets, trailing commas, markdown fences).
 * 2. Absolute prohibition on inventing, guessing, mutating, or adding semantic fields, nodes, or values.
 * 3. If multiple recovery candidates exist or meaning preservation is uncertain -> FAIL-CLOSED.
 * 4. Normal/valid input passes through with ZERO modification.
 * 5. Recovered outputs MUST pass strict Grammar Validation (validateMeaningTree).
 */

import { MeaningNode } from './types';
import { validateMeaningTree } from './grammar';
import { TransitionAction } from '../types';
import { actionToMeaningNode, extractActionsAndClaimsFromMeaningTree, meaningNodeToAction } from './adapter';

export interface RecoveryResult {
  success: boolean;
  node?: MeaningNode;
  recovered: boolean;
  recoveryApplied?: string;
  error?: string;
}

export interface JsonRecoveryResult<T = any> {
  success: boolean;
  data?: T;
  recovered: boolean;
  recoveryApplied?: string;
  error?: string;
}

export interface ProposalOrMeaningTreeResult {
  success: boolean;
  meaningTree?: MeaningNode;
  proposalActions: TransitionAction[];
  rawClaims: string[];
  intentSummary?: string;
  recovered: boolean;
  recoveryApplied?: string;
  error?: string;
  isMeaningTree: boolean;
}

/**
 * Strips outer markdown code fences deterministically if present.
 */
function stripMarkdownFences(input: string): { text: string; stripped: boolean } {
  const trimmed = input.trim();
  const fenceRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const match = trimmed.match(fenceRegex);
  if (match) {
    return { text: match[1].trim(), stripped: true };
  }
  return { text: trimmed, stripped: false };
}

/**
 * Removes trailing commas right before closing brackets/braces deterministically.
 * E.g., `{"a": 1,}` -> `{"a": 1}` or `[1, 2,]` -> `[1, 2]`
 * Does NOT alter commas inside quoted strings.
 */
function removeTrailingCommas(input: string): { text: string; removed: boolean } {
  let inString = false;
  let isEscaped = false;
  const chars = input.split('');
  let removed = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === ',') {
      // Look ahead to the next non-whitespace character
      let j = i + 1;
      while (j < chars.length && /\s/.test(chars[j])) {
        j++;
      }
      if (j < chars.length && (chars[j] === '}' || chars[j] === ']')) {
        // Trailing comma detected right before closing bracket
        chars[i] = ' ';
        removed = true;
      }
    }
  }

  return { text: chars.join(''), removed };
}

/**
 * Balances unclosed brackets/braces at the end of input if and only if
 * the remaining open stack is strictly and uniquely determinable.
 * If there are syntax anomalies inside strings or mismatched brackets, it fails.
 */
function balanceUnclosedBrackets(input: string): { text: string; balanced: boolean } {
  let inString = false;
  let isEscaped = false;
  const stack: ('}' | ']')[] = [];
  const chars = input.split('');

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length === 0) {
        // Unmatched extra closing bracket -> ambiguous -> cannot balance
        return { text: input, balanced: false };
      }
      const expected = stack.pop();
      if (expected !== ch) {
        // Bracket mismatch -> ambiguous -> cannot balance
        return { text: input, balanced: false };
      }
    }
  }

  // If we ended while still inside a string literal, we can close the quote
  // ONLY IF it's at the very end of stream and no other syntax follows.
  let suffix = '';
  if (inString) {
    suffix += '"';
  }

  if (stack.length > 0 || suffix.length > 0) {
    while (stack.length > 0) {
      suffix += stack.pop();
    }
    return { text: input + suffix, balanced: true };
  }

  return { text: input, balanced: false };
}

/**
 * Detects structural missing value/field tokens (e.g. `"value": ,` or `"atom": }` or `"atom": `)
 * Such syntax errors represent missing semantic values and MUST NOT be guessed or filled.
 */
function hasMissingValueToken(input: string): boolean {
  // Check for patterns like `: ,` or `: }` or `: ]` outside of strings
  let inString = false;
  let isEscaped = false;
  const len = input.length;

  for (let i = 0; i < len; i++) {
    const ch = input[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === ':') {
      let j = i + 1;
      while (j < len && /\s/.test(input[j])) {
        j++;
      }
      if (j < len && (input[j] === ',' || input[j] === '}' || input[j] === ']')) {
        return true; // Missing value token detected
      }
      if (j === len) {
        return true; // Ends immediately after colon with no value
      }
    }
  }

  return false;
}

/**
 * Deterministic Syntax Recovery & Parser
 * 
 * 1. Attempts clean parse first (Zero modification).
 * 2. If parse fails, checks for missing value tokens -> FAIL-CLOSED if found.
 * 3. Applies unambiguous syntax fixes:
 *    - Stripping markdown fences
 *    - Removing trailing commas
 *    - Deterministic bracket balancing
 * 4. Validates parsed object against Grammar (validateMeaningTree).
 * 5. If any validation fails -> FAIL-CLOSED.
 */
export function recoverAndParseMeaningTree(rawInput: string): RecoveryResult {
  if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return {
      success: false,
      recovered: false,
      error: 'Empty or non-string input provided to recovery layer',
    };
  }

  // 1. Clean parse attempt (Pass-Through First)
  try {
    const parsed = JSON.parse(rawInput);
    const grammarResult = validateMeaningTree(parsed);
    if (grammarResult.valid) {
      return {
        success: true,
        node: parsed as MeaningNode,
        recovered: false,
      };
    }
  } catch {
    // Syntax error exists, proceed to deterministic recovery
  }

  // 2. Strict semantic missing token check -> FAIL-CLOSED
  if (hasMissingValueToken(rawInput)) {
    return {
      success: false,
      recovered: false,
      error: 'Semantic field or value is missing/truncated. Guessing values is strictly prohibited.',
    };
  }

  // 3. Stepwise Unambiguous Recovery Pipeline
  const appliedFixes: string[] = [];
  let workingText = rawInput;

  // 3.1 Strip Markdown code fence
  const fenceRes = stripMarkdownFences(workingText);
  if (fenceRes.stripped) {
    workingText = fenceRes.text;
    appliedFixes.push('STRIP_MARKDOWN_FENCE');
  }

  // Check again after fence removal
  try {
    const parsed = JSON.parse(workingText);
    const grammarResult = validateMeaningTree(parsed);
    if (grammarResult.valid) {
      return {
        success: true,
        node: parsed as MeaningNode,
        recovered: true,
        recoveryApplied: appliedFixes.join('; '),
      };
    } else {
      return {
        success: false,
        recovered: false,
        error: `Grammar validation failed after markdown strip: ${grammarResult.errors.join('; ')}`,
      };
    }
  } catch {
    // Continue recovery
  }

  // 3.2 Remove Trailing Commas
  const commaRes = removeTrailingCommas(workingText);
  if (commaRes.removed) {
    workingText = commaRes.text;
    appliedFixes.push('REMOVE_TRAILING_COMMAS');
  }

  // Check again after trailing comma removal
  try {
    const parsed = JSON.parse(workingText);
    const grammarResult = validateMeaningTree(parsed);
    if (grammarResult.valid) {
      return {
        success: true,
        node: parsed as MeaningNode,
        recovered: true,
        recoveryApplied: appliedFixes.join('; '),
      };
    } else {
      return {
        success: false,
        recovered: false,
        error: `Grammar validation failed after trailing comma fix: ${grammarResult.errors.join('; ')}`,
      };
    }
  } catch {
    // Continue recovery
  }

  // 3.3 Balance Unclosed Brackets at EOF
  const bracketRes = balanceUnclosedBrackets(workingText);
  if (bracketRes.balanced) {
    workingText = bracketRes.text;
    appliedFixes.push('BALANCE_UNCLOSED_BRACKETS');
  }

  // Final parsing attempt
  let recoveredObj: unknown;
  try {
    recoveredObj = JSON.parse(workingText);
  } catch (err: any) {
    return {
      success: false,
      recovered: false,
      error: `Syntax recovery failed to produce valid JSON: ${err?.message || String(err)}`,
    };
  }

  // 4. Grammar validation on recovered output
  const grammarResult = validateMeaningTree(recoveredObj);
  if (!grammarResult.valid) {
    return {
      success: false,
      recovered: false,
      error: `Grammar validation failed on recovered node: ${grammarResult.errors.join('; ')}`,
    };
  }

  return {
    success: true,
    node: recoveredObj as MeaningNode,
    recovered: true,
    recoveryApplied: appliedFixes.join('; '),
  };
}

/**
 * Deterministic Generic JSON Syntax Recovery & Parser
 * Applies the same strict non-hallucinating syntax recovery (fences, trailing commas, bracket balancing).
 * Fails closed if missing value tokens exist.
 */
export function recoverSyntaxAndParseJson<T = any>(rawInput: string): JsonRecoveryResult<T> {
  if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return {
      success: false,
      recovered: false,
      error: 'Empty or non-string input provided to recovery layer',
    };
  }

  // 1. Clean parse attempt (Pass-Through First)
  try {
    const parsed = JSON.parse(rawInput);
    return {
      success: true,
      data: parsed as T,
      recovered: false,
    };
  } catch {
    // Syntax error exists, proceed to deterministic recovery
  }

  // 2. Strict semantic missing token check -> FAIL-CLOSED
  if (hasMissingValueToken(rawInput)) {
    return {
      success: false,
      recovered: false,
      error: 'Semantic field or value is missing/truncated. Guessing values is strictly prohibited.',
    };
  }

  // 3. Stepwise Unambiguous Recovery Pipeline
  const appliedFixes: string[] = [];
  let workingText = rawInput;

  // 3.1 Strip Markdown code fence
  const fenceRes = stripMarkdownFences(workingText);
  if (fenceRes.stripped) {
    workingText = fenceRes.text;
    appliedFixes.push('STRIP_MARKDOWN_FENCE');
  }

  try {
    const parsed = JSON.parse(workingText);
    return {
      success: true,
      data: parsed as T,
      recovered: true,
      recoveryApplied: appliedFixes.join('; '),
    };
  } catch {
    // Continue recovery
  }

  // 3.2 Remove Trailing Commas
  const commaRes = removeTrailingCommas(workingText);
  if (commaRes.removed) {
    workingText = commaRes.text;
    appliedFixes.push('REMOVE_TRAILING_COMMAS');
  }

  try {
    const parsed = JSON.parse(workingText);
    return {
      success: true,
      data: parsed as T,
      recovered: true,
      recoveryApplied: appliedFixes.join('; '),
    };
  } catch {
    // Continue recovery
  }

  // 3.3 Balance Unclosed Brackets at EOF
  const bracketRes = balanceUnclosedBrackets(workingText);
  if (bracketRes.balanced) {
    workingText = bracketRes.text;
    appliedFixes.push('BALANCE_UNCLOSED_BRACKETS');
  }

  // Final parse attempt
  try {
    const recoveredObj = JSON.parse(workingText);
    return {
      success: true,
      data: recoveredObj as T,
      recovered: true,
      recoveryApplied: appliedFixes.join('; '),
    };
  } catch (err: any) {
    return {
      success: false,
      recovered: false,
      error: `Syntax recovery failed to produce valid JSON: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Universal Proposal & Meaning Tree Live Runtime Gate
 * Parses raw LLM output or blocks, runs Deterministic Recovery, validates Grammar,
 * and extracts actions via Engine Language Adapter.
 */
export function recoverAndParseProposalOrMeaningTree(rawInput: string): ProposalOrMeaningTreeResult {
  if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return {
      success: false,
      proposalActions: [],
      rawClaims: [],
      recovered: false,
      isMeaningTree: false,
      error: 'Empty input provided to proposal/language recovery gate',
    };
  }

  // 1. Check if input is a direct Meaning Tree
  const meaningTreeRes = recoverAndParseMeaningTree(rawInput);
  if (meaningTreeRes.success && meaningTreeRes.node) {
    const { actions, rawClaims, intentSummary } = extractActionsAndClaimsFromMeaningTree(meaningTreeRes.node);
    return {
      success: true,
      meaningTree: meaningTreeRes.node,
      proposalActions: actions,
      rawClaims,
      intentSummary,
      recovered: meaningTreeRes.recovered,
      recoveryApplied: meaningTreeRes.recoveryApplied,
      isMeaningTree: true,
    };
  }

  // 2. If not a direct Meaning Tree node, recover as Proposal JSON
  const jsonRes = recoverSyntaxAndParseJson<any>(rawInput);
  if (!jsonRes.success || !jsonRes.data || typeof jsonRes.data !== 'object') {
    return {
      success: false,
      proposalActions: [],
      rawClaims: [],
      recovered: jsonRes.recovered,
      recoveryApplied: jsonRes.recoveryApplied,
      isMeaningTree: false,
      error: jsonRes.error || meaningTreeRes.error || 'Failed to parse proposal or meaning tree',
    };
  }

  const parsed = jsonRes.data;
  const proposalActions: TransitionAction[] = [];
  const rawClaims: string[] = [];
  let intentSummary: string | undefined = typeof parsed.intentSummary === 'string' ? parsed.intentSummary : undefined;

  // Extract and adapt actions through Engine Language meaning nodes
  if (Array.isArray(parsed.actions)) {
    for (const item of parsed.actions) {
      if (item && typeof item === 'object' && typeof item.type === 'string') {
        const action = item as TransitionAction;
        // Verify roundtrip adaptation through Meaning Tree Atom & Grammar
        try {
          const node = actionToMeaningNode(action);
          const grammarCheck = validateMeaningTree(node);
          if (grammarCheck.valid) {
            proposalActions.push(action);
          } else {
            rawClaims.push(`[GRAMMAR_REJECTED_ACTION] ${action.type}: ${grammarCheck.errors.join('; ')}`);
          }
        } catch {
          proposalActions.push(action);
        }
      }
    }
  }

  if (Array.isArray(parsed.rawClaims)) {
    for (const c of parsed.rawClaims) {
      if (typeof c === 'string') rawClaims.push(c);
    }
  }

  return {
    success: true,
    proposalActions,
    rawClaims,
    intentSummary,
    recovered: jsonRes.recovered,
    recoveryApplied: jsonRes.recoveryApplied,
    isMeaningTree: false,
  };
}

