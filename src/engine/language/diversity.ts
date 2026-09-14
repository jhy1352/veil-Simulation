/**
 * @file src/engine/language/diversity.ts
 * @description VEIL Engine Language Structural Diversity Gate
 *
 * Enforces structural diversity across LLM-generated candidates using canonical
 * semantic structural equality.
 *
 * Rules:
 * 1. Location: Immediately post-Translation / Prior to Sovereign Authority.
 * 2. Uses ONLY Engine Language canonical structural equality (`areMeaningsSemanticallyEqual`).
 * 3. NO natural language / label / summary / style similarity heuristics.
 * 4. Strictly deduplicates identical MeaningNodes.
 * 5. Preserves the first occurring candidate's natural language metadata.
 * 6. Returns 1..N candidates (never 0 if input is non-empty).
 * 7. ZERO re-invocation / re-generation of LLM.
 * 8. Pure filter: Does NOT perform ALLOW / DENY / Mutation / Authority decisions.
 */

import { MeaningNode } from './types';
import { areMeaningsSemanticallyEqual } from './canonicalizer';
import { CandidatePacket } from '../../types';

export interface CandidateWithMeaningTree {
  candidate: CandidatePacket;
  meaningTree: MeaningNode;
}

/**
 * Filters an array of MeaningNodes to keep only structurally distinct trees.
 * Order of first occurrence is strictly preserved.
 */
export function filterDiverseMeaningNodes(nodes: MeaningNode[]): MeaningNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const uniqueNodes: MeaningNode[] = [];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;

    // Check if this node is structurally equal to any already accepted unique node
    const isDuplicate = uniqueNodes.some((existing) =>
      areMeaningsSemanticallyEqual(existing, node)
    );

    if (!isDuplicate) {
      uniqueNodes.push(node);
    }
  }

  // Guarantee at least 1 candidate if input had valid nodes
  if (uniqueNodes.length === 0 && nodes.length > 0 && nodes[0]) {
    uniqueNodes.push(nodes[0]);
  }

  return uniqueNodes;
}

/**
 * Filters an array of Candidates with their translated MeaningTrees.
 * Deduplicates purely based on MeaningTree canonical equality.
 * Preserves the natural language metadata of the first unique occurrence.
 */
export function filterDiverseCandidates(
  candidatesWithTrees: CandidateWithMeaningTree[]
): CandidateWithMeaningTree[] {
  if (!Array.isArray(candidatesWithTrees) || candidatesWithTrees.length === 0) {
    return [];
  }

  const uniqueCandidates: CandidateWithMeaningTree[] = [];

  for (const item of candidatesWithTrees) {
    if (!item || !item.meaningTree) continue;

    const isDuplicate = uniqueCandidates.some((existing) =>
      areMeaningsSemanticallyEqual(existing.meaningTree, item.meaningTree)
    );

    if (!isDuplicate) {
      uniqueCandidates.push(item);
    }
  }

  // Safety invariant: Never return 0 if input was non-empty
  if (uniqueCandidates.length === 0 && candidatesWithTrees.length > 0 && candidatesWithTrees[0]) {
    uniqueCandidates.push(candidatesWithTrees[0]);
  }

  return uniqueCandidates;
}
