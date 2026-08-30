/**
 * @file src/engine/language/types.ts
 * @description VEIL Engine Language Core Type Definitions
 * Fixed 11 Core Atoms, Scopes, Composable Nodes, and Meaning Tree structures.
 */

/**
 * 1. Fixed Core 11 Atoms
 * Strict invariant: Exactly 11 atoms. Adding, removing, or changing semantics is prohibited.
 */
export const CORE_ATOMS = [
  'ENTITY',
  'ACTION',
  'STATE',
  'RELATION',
  'CLAIM',
  'TIME',
  'CAUSE',
  'ROLE',
  'INTENT',
  'VALUE',
  'CONSTRAINT',
] as const;

export type CoreAtom = (typeof CORE_ATOMS)[number];

/**
 * Set of core atoms for O(1) membership check.
 */
export const CORE_ATOM_SET = new Set<string>(CORE_ATOMS);

/**
 * 2. Scope definition
 * Represents semantic and epistemic context of a Node.
 */
export type Scope =
  | 'CANONICAL'
  | 'CLAIM'
  | 'HYPOTHETICAL'
  | 'PROPOSAL'
  | 'OFFSCREEN'
  | 'INTENT'
  | 'HISTORICAL'
  | 'OBSERVATION'
  | 'UNVERIFIED';

export const SCOPES: readonly Scope[] = [
  'CANONICAL',
  'CLAIM',
  'HYPOTHETICAL',
  'PROPOSAL',
  'OFFSCREEN',
  'INTENT',
  'HISTORICAL',
  'OBSERVATION',
  'UNVERIFIED',
] as const;

export const SCOPE_SET = new Set<string>(SCOPES);

/**
 * 3. Semantic Reference
 */
export interface SemanticReference {
  id: string;
  targetAtom?: CoreAtom;
  role?: string;
  uri?: string;
  [key: string]: unknown;
}

/**
 * 4. Semantic Value type (primitive, structured payload, or record)
 */
export type SemanticValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

/**
 * 4.5 Composition Semantics
 * Explicitly distinguishes ordered sequences (A, B != B, A) from unordered sets (A, B == B, A).
 *
 * UNORDERED Semantics Specification:
 * = 의미상 child 선언 순서 비의존 (Order-independent in semantics & equality)
 * + Runtime에서는 deterministic canonical order로 linearize하여 실행 (Projected deterministically for execution)
 */
export type CompositionType = 'ORDERED' | 'UNORDERED';

export const COMPOSITION_TYPES: readonly CompositionType[] = ['ORDERED', 'UNORDERED'] as const;
export const COMPOSITION_SET = new Set<string>(COMPOSITION_TYPES);

/**
 * 5. Composable Node (The core unit of Engine Language)
 * Node = Atom + Scope + Composition + Semantic Fields/Value + Children/Nested Nodes + References
 */
export interface MeaningNode {
  id?: string;
  atom: CoreAtom;
  scope: Scope;
  composition?: CompositionType;
  value?: SemanticValue;
  fields?: Record<string, unknown>;
  auxiliary?: string[];
  references?: SemanticReference[];
  children?: MeaningNode[];
}

/**
 * 6. Canonicalized Meaning Node
 * Deeply sorted (where UNORDERED), normalized, invariant structure for deterministic equality and serialization.
 */
export interface CanonicalMeaningNode {
  atom: CoreAtom;
  scope: Scope;
  composition?: CompositionType;
  id?: string;
  value?: SemanticValue;
  fields?: Record<string, unknown>;
  auxiliary?: string[];
  references?: SemanticReference[];
  children?: CanonicalMeaningNode[];
}

/**
 * 7. Grammar & Validation types
 */
export interface GrammarValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
