/**
 * @file src/engine/language/serializer.ts
 * @description VEIL Engine Language Deterministic Serialization & Deserialization
 */

import { CanonicalMeaningNode, MeaningNode } from './types';
import { assertValidMeaningTree, validateMeaningTree } from './grammar';
import { areMeaningsSemanticallyEqual, canonicalizeMeaningTree } from './canonicalizer';

/**
 * Deterministically serializes a Meaning Tree into a canonical JSON string.
 */
export function serializeMeaningTree(node: MeaningNode): string {
  const canonical = canonicalizeMeaningTree(node);
  return JSON.stringify(canonical);
}

/**
 * Deserializes a canonical JSON string into a validated Meaning Tree.
 */
export function deserializeMeaningTree(jsonStr: string): MeaningNode {
  if (typeof jsonStr !== 'string' || jsonStr.trim().length === 0) {
    throw new Error('[Deserialization Error] Input JSON string cannot be empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err: any) {
    throw new Error(`[Deserialization Error] Invalid JSON: ${err?.message || String(err)}`);
  }

  assertValidMeaningTree(parsed);
  return parsed;
}

/**
 * Verifies that a node survives the Serialize -> Deserialize -> Canonicalize round trip
 * while preserving 100% semantic equality.
 */
export function verifyRoundTrip(node: MeaningNode): { success: boolean; error?: string } {
  try {
    const serialized = serializeMeaningTree(node);
    const deserialized = deserializeMeaningTree(serialized);
    const equal = areMeaningsSemanticallyEqual(node, deserialized);
    if (!equal) {
      return { success: false, error: 'Semantic equality check failed post-round-trip' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
