/**
 * @file src/engine/language/canonicalizer.ts
 * @description VEIL Engine Language Canonicalization & Semantic Equality
 * Produces deterministic, order-invariant canonical forms of Meaning Trees.
 */

import {
  CanonicalMeaningNode,
  CoreAtom,
  MeaningNode,
  Scope,
  SemanticReference,
  SemanticValue,
} from './types';
import { assertValidMeaningTree } from './grammar';

/**
 * Deterministically sorts object keys recursively.
 */
export function canonicalizeValue(val: unknown): SemanticValue {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val !== 'object') {
    return val as SemanticValue;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue) as unknown[];
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const res: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    if (obj[k] !== undefined) {
      res[k] = canonicalizeValue(obj[k]);
    }
  }
  return res;
}

/**
 * Normalizes semantic references deterministically.
 */
function canonicalizeReferences(refs?: SemanticReference[]): SemanticReference[] | undefined {
  if (!refs || refs.length === 0) return undefined;
  const cleaned = refs.map((ref) => {
    const keys = Object.keys(ref).sort();
    const sortedRef: any = {};
    for (const k of keys) {
      if (ref[k] !== undefined) {
        sortedRef[k] = ref[k];
      }
    }
    return sortedRef as SemanticReference;
  });

  return cleaned.sort((a, b) => {
    const keyA = `${a.id}:${a.targetAtom ?? ''}:${a.role ?? ''}:${a.uri ?? ''}`;
    const keyB = `${b.id}:${b.targetAtom ?? ''}:${b.role ?? ''}:${b.uri ?? ''}`;
    return keyA.localeCompare(keyB);
  });
}

/**
 * Normalizes auxiliary tags deterministically (sorted, unique).
 */
function canonicalizeAuxiliary(aux?: string[]): string[] | undefined {
  if (!aux || aux.length === 0) return undefined;
  const unique = Array.from(new Set(aux.filter((s) => typeof s === 'string' && s.trim().length > 0)));
  if (unique.length === 0) return undefined;
  return unique.sort();
}

/**
 * Deterministic node comparator for sorting children
 */
function compareCanonicalNodes(a: CanonicalMeaningNode, b: CanonicalMeaningNode): number {
  if (a.atom !== b.atom) return a.atom.localeCompare(b.atom);
  if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
  if ((a.composition || '') !== (b.composition || '')) return (a.composition || '').localeCompare(b.composition || '');
  if ((a.id || '') !== (b.id || '')) return (a.id || '').localeCompare(b.id || '');

  const strA = JSON.stringify({ v: a.value, f: a.fields, aux: a.auxiliary, ref: a.references, c: a.children, comp: a.composition });
  const strB = JSON.stringify({ v: b.value, f: b.fields, aux: b.auxiliary, ref: b.references, c: b.children, comp: b.composition });
  return strA.localeCompare(strB);
}

/**
 * Recursively canonicalizes a MeaningNode into a CanonicalMeaningNode.
 */
export function canonicalizeMeaningTree(node: MeaningNode): CanonicalMeaningNode {
  assertValidMeaningTree(node);

  const canonical: CanonicalMeaningNode = {
    atom: node.atom,
    scope: node.scope,
  };

  if (node.composition !== undefined) {
    canonical.composition = node.composition;
  }

  if (node.id !== undefined && node.id.trim().length > 0) {
    canonical.id = node.id.trim();
  }

  if (node.value !== undefined) {
    const cv = canonicalizeValue(node.value);
    if (cv !== null || node.value === null) {
      canonical.value = cv;
    }
  }

  if (node.fields !== undefined && typeof node.fields === 'object' && node.fields !== null) {
    const cf = canonicalizeValue(node.fields) as Record<string, unknown>;
    if (Object.keys(cf).length > 0) {
      canonical.fields = cf;
    }
  }

  const aux = canonicalizeAuxiliary(node.auxiliary);
  if (aux) {
    canonical.auxiliary = aux;
  }

  const refs = canonicalizeReferences(node.references);
  if (refs) {
    canonical.references = refs;
  }

  if (node.children && Array.isArray(node.children) && node.children.length > 0) {
    const canonicalChildren = node.children.map((c) => canonicalizeMeaningTree(c));
    // ORDERED preserves children sequence strictly. UNORDERED allows deterministic canonical sort.
    if (node.composition === 'UNORDERED') {
      canonicalChildren.sort(compareCanonicalNodes);
    }
    canonical.children = canonicalChildren;
  }

  return canonical;
}

/**
 * Checks semantic equality of two Meaning Trees.
 * Two trees are semantically equal if and only if their canonical forms serialize to identical strings.
 */
export function areMeaningsSemanticallyEqual(a: MeaningNode, b: MeaningNode): boolean {
  try {
    const canA = canonicalizeMeaningTree(a);
    const canB = canonicalizeMeaningTree(b);
    return JSON.stringify(canA) === JSON.stringify(canB);
  } catch {
    return false;
  }
}
