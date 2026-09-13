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

/**
 * 8. Causal Language v1 Fixed ROLE Vocabulary
 */
export const CANONICAL_ROLES = [
  'SUBJECT',
  'TARGET',
  'OBJECT',
  'RECIPIENT',
  'SOURCE',
  'COUNTERPARTY',
  'LOCATION',
  'INSTRUMENT',
  'BENEFICIARY',
  'SPEAKER',
  'OBSERVER',
  'HOLDER',
  'OWNER',
  'TIME',
  'CAUSE',
  'VALUE',
  'STATE',
  'CONSTRAINT',
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

/**
 * Epistemic & Modality Context Types
 */
export type Polarity = 'ASSERTED' | 'NEGATED' | 'UNKNOWN';

export type EpistemicStatus =
  | 'OBSERVED'
  | 'ASSERTED'
  | 'HEARSAY'
  | 'INFERRED'
  | 'UNVERIFIED'
  | 'UNKNOWN'
  | 'VERIFIED';

export type Modality =
  | 'NONE'
  | 'POSSIBLE'
  | 'NECESSARY'
  | 'COUNTERFACTUAL'
  | 'INTENTIONAL'
  | 'COMMITMENT';

export type ReferenceResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';

export interface SemanticEventRole {
  role: CanonicalRole;
  entityId?: string;
  entityName?: string;
  status?: ReferenceResolutionStatus;
  [key: string]: unknown;
}

/**
 * Semantic Event IR (Intermediate Representation)
 */
export interface SemanticEvent {
  eventId: string;
  action: string;
  roles: SemanticEventRole[];
  states?: Record<string, unknown>[];
  relations?: Record<string, unknown>[];
  values?: Record<string, unknown>[];
  times?: Record<string, unknown>[];
  causes?: Record<string, unknown>[];
  constraints?: Record<string, unknown>[];
  intent?: string;
  scope: Scope;
  polarity: Polarity;
  epistemicStatus: EpistemicStatus;
  modality: Modality;
  provenance?: string;
  references?: SemanticReference[];
  temporalPrecision?: string;
  literalness?: boolean;
}

export type CausalCompilerStatus =
  | 'COMPILED'
  | 'UNKNOWN'
  | 'UNPROVEN'
  | 'CONTRADICTED'
  | 'RECONCILIATION_REQUIRED'
  | 'INVALID'
  | 'AMBIGUOUS';

export interface CausalCompilationResult {
  status: CausalCompilerStatus;
  events: SemanticEvent[];
  meaningTree?: MeaningNode;
  errors?: string[];
  warnings?: string[];
}

