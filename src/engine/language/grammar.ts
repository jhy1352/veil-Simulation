/**
 * @file src/engine/language/grammar.ts
 * @description VEIL Engine Language Grammar Rules & Structural/Compositional Validator
 */

import {
  COMPOSITION_SET,
  CORE_ATOM_SET,
  CoreAtom,
  GrammarValidationResult,
  MeaningNode,
  SCOPE_SET,
  Scope,
} from './types';

/**
 * Permitted Child Atoms for each Parent Core Atom
 */
export const ALLOWED_COMPOSITIONS: Record<CoreAtom, readonly CoreAtom[]> = {
  CLAIM: ['CLAIM', 'STATE', 'ACTION', 'RELATION', 'VALUE', 'ENTITY', 'CONSTRAINT', 'TIME', 'CAUSE'],
  CAUSE: ['ACTION', 'STATE', 'VALUE', 'ENTITY', 'TIME', 'CLAIM'],
  INTENT: ['ACTION', 'VALUE', 'ENTITY', 'STATE', 'CONSTRAINT', 'ROLE', 'TIME'],
  CONSTRAINT: ['STATE', 'ACTION', 'VALUE', 'ENTITY', 'RELATION', 'TIME'],
  ACTION: ['ENTITY', 'STATE', 'VALUE', 'TIME', 'ROLE', 'RELATION', 'CAUSE', 'CONSTRAINT', 'ACTION'],
  STATE: ['ENTITY', 'VALUE', 'TIME', 'CONSTRAINT', 'RELATION', 'STATE'],
  RELATION: ['ENTITY', 'ROLE', 'VALUE', 'STATE', 'TIME', 'RELATION'],
  ENTITY: ['STATE', 'RELATION', 'ROLE', 'VALUE', 'CONSTRAINT', 'ENTITY'],
  TIME: ['VALUE', 'ACTION', 'STATE', 'TIME'],
  ROLE: ['ENTITY', 'VALUE', 'RELATION'],
  VALUE: ['VALUE'],
};

/**
 * Scope Compatibility Rules
 * Determines whether a child's scope is legally nested inside a parent's scope.
 */
function isScopeCompatible(parentScope: Scope, childScope: Scope, parentAtom: CoreAtom): boolean {
  // Same scope is always compatible
  if (parentScope === childScope) return true;

  // Unverified/Hypothetical/Claim containers can hold any nested epistemic scope
  if (parentScope === 'HYPOTHETICAL' || parentScope === 'CLAIM' || parentScope === 'UNVERIFIED' || parentScope === 'PROPOSAL') {
    return true;
  }

  // Under CANONICAL or HISTORICAL:
  // Direct children cannot declare HYPOTHETICAL or UNVERIFIED directly unless wrapped in CLAIM or INTENT
  if (parentScope === 'CANONICAL' || parentScope === 'HISTORICAL') {
    if (childScope === 'HYPOTHETICAL' || childScope === 'UNVERIFIED') {
      return parentAtom === 'CLAIM' || parentAtom === 'INTENT';
    }
    if (childScope === 'PROPOSAL' || childScope === 'CLAIM' || childScope === 'INTENT' || childScope === 'OFFSCREEN' || childScope === 'OBSERVATION') {
      return true;
    }
  }

  // Under INTENT:
  if (parentScope === 'INTENT') {
    return childScope === 'INTENT' || childScope === 'PROPOSAL' || childScope === 'HYPOTHETICAL' || childScope === 'CLAIM' || childScope === 'CANONICAL';
  }

  // Under OFFSCREEN:
  if (parentScope === 'OFFSCREEN') {
    return childScope === 'OFFSCREEN' || childScope === 'CANONICAL' || childScope === 'STATE' as any || childScope === 'CLAIM' || childScope === 'OBSERVATION';
  }

  return true;
}

/**
 * Validates a single MeaningNode and all its descendants against the Engine Language Grammar.
 */
export function validateMeaningTree(
  node: unknown,
  options: { maxDepth?: number } = {}
): GrammarValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxDepth = options.maxDepth ?? 64;
  const visited = new Set<unknown>();

  function traverse(current: unknown, path: string, depth: number, parentNode?: MeaningNode) {
    if (depth > maxDepth) {
      errors.push(`${path}: Exceeded maximum nesting depth of ${maxDepth}`);
      return;
    }

    if (!current || typeof current !== 'object') {
      errors.push(`${path}: Node must be a non-null object`);
      return;
    }

    if (visited.has(current)) {
      errors.push(`${path}: Circular reference detected`);
      return;
    }
    visited.add(current);

    const candidate = current as Record<string, unknown>;

    // 1. Atom Validation (Exact 11 Core Atoms)
    const atom = candidate.atom;
    if (typeof atom !== 'string' || !CORE_ATOM_SET.has(atom)) {
      errors.push(
        `${path}: Invalid atom "${String(atom)}". Must be one of 11 Core Atoms: ${Array.from(
          CORE_ATOM_SET
        ).join(', ')}`
      );
      return;
    }
    const coreAtom = atom as CoreAtom;

    // 2. Scope Validation
    const scope = candidate.scope;
    if (typeof scope !== 'string' || !SCOPE_SET.has(scope)) {
      errors.push(
        `${path}: Invalid scope "${String(scope)}". Must be one of: ${Array.from(SCOPE_SET).join(
          ', '
        )}`
      );
      return;
    }
    const coreScope = scope as Scope;

    // 2.5 Composition Validation (ORDERED | UNORDERED)
    if (candidate.composition !== undefined) {
      if (typeof candidate.composition !== 'string' || !COMPOSITION_SET.has(candidate.composition)) {
        errors.push(
          `${path}: Invalid composition "${String(candidate.composition)}". Must be one of: ${Array.from(
            COMPOSITION_SET
          ).join(', ')}`
        );
        return;
      }
    }

    // 3. Composition Matrix Validation (Parent Atom -> Child Atom)
    if (parentNode) {
      const allowedChildren = ALLOWED_COMPOSITIONS[parentNode.atom];
      if (!allowedChildren.includes(coreAtom)) {
        errors.push(
          `${path}: Illegal composition: Atom "${parentNode.atom}" cannot have child atom "${coreAtom}". Allowed: [${allowedChildren.join(
            ', '
          )}]`
        );
      }

      // 4. Scope Compatibility Validation
      if (!isScopeCompatible(parentNode.scope, coreScope, parentNode.atom)) {
        errors.push(
          `${path}: Conflicting Scope: Scope "${coreScope}" is invalid under parent scope "${parentNode.scope}" (Parent Atom: ${parentNode.atom})`
        );
      }
    }

    // 5. Auxiliary Tags Validation
    if (candidate.auxiliary !== undefined) {
      if (!Array.isArray(candidate.auxiliary)) {
        errors.push(`${path}: auxiliary must be an array of strings if provided`);
      } else {
        for (let i = 0; i < candidate.auxiliary.length; i++) {
          if (typeof candidate.auxiliary[i] !== 'string') {
            errors.push(`${path}.auxiliary[${i}]: auxiliary tag must be a string`);
          }
        }
      }
    }

    // 6. References Validation
    if (candidate.references !== undefined) {
      if (!Array.isArray(candidate.references)) {
        errors.push(`${path}: references must be an array if provided`);
      } else {
        for (let i = 0; i < candidate.references.length; i++) {
          const ref = candidate.references[i];
          if (!ref || typeof ref !== 'object' || typeof (ref as any).id !== 'string') {
            errors.push(`${path}.references[${i}]: Reference must have a valid string "id"`);
          } else if (
            (ref as any).targetAtom !== undefined &&
            !CORE_ATOM_SET.has((ref as any).targetAtom)
          ) {
            errors.push(
              `${path}.references[${i}]: targetAtom must be one of 11 Core Atoms if provided`
            );
          }
        }
      }
    }

    // 7. Fields Validation
    if (candidate.fields !== undefined && (typeof candidate.fields !== 'object' || candidate.fields === null || Array.isArray(candidate.fields))) {
      errors.push(`${path}: fields must be a key-value object if provided`);
    }

    // 8. Children Validation
    const meaningfulNode: MeaningNode = {
      id: typeof candidate.id === 'string' ? candidate.id : undefined,
      atom: coreAtom,
      scope: coreScope,
      value: candidate.value as any,
      fields: candidate.fields as any,
      auxiliary: candidate.auxiliary as any,
      references: candidate.references as any,
      children: Array.isArray(candidate.children) ? (candidate.children as MeaningNode[]) : undefined,
    };

    if (candidate.children !== undefined) {
      if (!Array.isArray(candidate.children)) {
        errors.push(`${path}: children must be an array if provided`);
      } else {
        for (let i = 0; i < candidate.children.length; i++) {
          traverse(candidate.children[i], `${path}.children[${i}]`, depth + 1, meaningfulNode);
        }
      }
    }
  }

  traverse(node, 'root', 1);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Asserts that a MeaningNode strictly passes grammar validation; throws on failure.
 */
export function assertValidMeaningTree(node: unknown, options?: { maxDepth?: number }): asserts node is MeaningNode {
  const result = validateMeaningTree(node, options);
  if (!result.valid) {
    throw new Error(`[Grammar Validation Error] ${result.errors.join('; ')}`);
  }
}
