import {
  ExternalEvidence,
  UntrustedClaim,
  VerifiedClaim,
  ImmigrationVerdict,
  CanonicalState,
  ImmutableHistoricalRecord
} from './types';

/**
 * Runtime-only authority registry.
 *
 * A VerifiedClaim is an authority-bearing runtime capability, not merely a
 * structurally valid data object. WeakSet membership proves that the exact
 * object instance was issued by ImmigrationGate.admit(). A forged clone,
 * even with every visible field copied correctly, cannot enter the registry.
 */
const ISSUED_VERIFIED_CLAIMS = new WeakSet<object>();

/**
 * Deterministic value equality helper without JSON serialization nondeterminism.
 */
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * VEIL Immigration Gate — Sovereign Admission Boundary
 * 
 * INVARIANTS:
 * - INVARIANT-01: LLM is never the verification authority.
 * - INVARIANT-02: VerifiedClaim can ONLY be constructed through ImmigrationGate validation.
 * - INVARIANT-03: VERIFIED != CANONICAL. Admission produces a Canon Candidate, not a state mutation.
 * - INVARIANT-04: Deterministic Grounding. Evidence expansion (unsupported attributes/entities) is rejected.
 * - INVARIANT-05: Immutable provenance linked directly to specific verified evidence IDs.
 * - INVARIANT-06: Conflicting evidence yields CONFLICT verdict and prevents unilateral canonization.
 * - INVARIANT-07: Only the exact runtime object issued by this Gate is a valid VerifiedClaim authority.
 */
export class ImmigrationGate {
  /**
   * Pure deterministic admission function.
   * Evaluates an untrusted claim candidate against an authoritative external evidence pool.
   */
  public static admit(
    untrustedClaim: UntrustedClaim,
    evidencePool: readonly ExternalEvidence[],
    currentSnapshot: CanonicalState,
    _history?: readonly ImmutableHistoricalRecord[]
  ): ImmigrationVerdict {
    if (!untrustedClaim || typeof untrustedClaim !== 'object') {
      return Object.freeze({
        admitted: false,
        status: 'REJECTED',
        rejectionReason: '[MALFORMED_CLAIM] Claim candidate must be a non-null object.'
      });
    }

    const { targetEntityId, targetAttribute, claimedValue, claimedEvidenceIds, rawText } = untrustedClaim;

    // 1. Structural Identity Check
    if (!targetEntityId || typeof targetEntityId !== 'string' || targetEntityId.trim() === '' || targetEntityId.trim() === '*') {
      return Object.freeze({
        admitted: false,
        status: 'REJECTED',
        rejectionReason: '[MISSING_ENTITY_ID] Claim candidate must specify a non-empty, non-wildcard targetEntityId.'
      });
    }

    if (!targetAttribute || typeof targetAttribute !== 'string' || targetAttribute.trim() === '' || targetAttribute.trim() === '*') {
      return Object.freeze({
        admitted: false,
        status: 'REJECTED',
        rejectionReason: '[MISSING_ATTRIBUTE] Claim candidate must specify a non-empty, non-wildcard targetAttribute.'
      });
    }

    // 2. Evidence Existence & Provenance Check
    if (!Array.isArray(claimedEvidenceIds) || claimedEvidenceIds.length === 0) {
      return Object.freeze({
        admitted: false,
        status: 'REJECTED',
        rejectionReason: '[NO_EVIDENCE_PROVIDED] Claim candidate must link to at least one evidenceId.'
      });
    }

    const matchedEvidences: ExternalEvidence[] = [];
    const missingEvidenceIds: string[] = [];

    for (const evId of claimedEvidenceIds) {
      if (typeof evId !== 'string' || evId.trim() === '') {
        missingEvidenceIds.push(String(evId));
        continue;
      }
      const found = evidencePool.find(e => e.evidenceId === evId.trim());
      if (found) {
        matchedEvidences.push(found);
      } else {
        missingEvidenceIds.push(evId);
      }
    }

    if (missingEvidenceIds.length > 0) {
      return Object.freeze({
        admitted: false,
        status: 'REJECTED',
        rejectionReason: `[FAKE_EVIDENCE] Claim references non-existent evidenceId(s): ${missingEvidenceIds.join(', ')}`
      });
    }

    // 3. Deterministic Grounding & Evidence Expansion Check
    const trimmedEntity = targetEntityId.trim();
    const trimmedAttr = targetAttribute.trim();
    const groundValues: any[] = [];
    const groundSources: string[] = [];
    const verifiedEventIds: string[] = [];

    for (const ev of matchedEvidences) {
      // If evidence specifies entityId, it must match
      if (ev.entityId && ev.entityId.trim() !== trimmedEntity) {
        return Object.freeze({
          admitted: false,
          status: 'REJECTED',
          rejectionReason: `[EVIDENCE_EXPANSION_DETECTED] Evidence '${ev.evidenceId}' targets entity '${ev.entityId}', which does not match claim entity '${trimmedEntity}'.`
        });
      }

      // If evidence specifies attribute, it must match
      if (ev.attribute && ev.attribute.trim() !== trimmedAttr) {
        return Object.freeze({
          admitted: false,
          status: 'REJECTED',
          rejectionReason: `[EVIDENCE_EXPANSION_DETECTED] Evidence '${ev.evidenceId}' grounds attribute '${ev.attribute}', which does not match claim attribute '${trimmedAttr}'.`
        });
      }

      if (ev.value !== undefined) {
        groundValues.push({ evidenceId: ev.evidenceId, value: ev.value });
      }

      if (ev.source) groundSources.push(ev.source);
      if (ev.eventId) verifiedEventIds.push(ev.eventId);
    }

    // 4. Multi-Evidence Internal Conflict Detection (INVARIANT-06)
    if (groundValues.length > 1) {
      const firstVal = groundValues[0].value;
      for (let i = 1; i < groundValues.length; i++) {
        if (!isDeepEqual(firstVal, groundValues[i].value)) {
          return Object.freeze({
            admitted: false,
            status: 'CONFLICT',
            rejectionReason: '[EVIDENCE_CONFLICT] Contradictory evidence values detected across provided evidence items.',
            conflictDetails: Object.freeze(groundValues.map(v => `${v.evidenceId}: ${JSON.stringify(v.value)}`))
          });
        }
      }
    }

    // Check individual value matches claimedValue
    for (const gv of groundValues) {
      if (!isDeepEqual(gv.value, claimedValue)) {
        return Object.freeze({
          admitted: false,
          status: 'REJECTED',
          rejectionReason: `[EVIDENCE_EXPANSION_DETECTED] Claimed value for '${trimmedAttr}' mismatches evidence value. Claimed: ${JSON.stringify(claimedValue)}, Evidence: ${JSON.stringify(gv.value)}`
        });
      }
    }

    // Check conflict against competing evidence in evidencePool for same entity/attribute
    const competingEvidences = evidencePool.filter(
      e => e.entityId === trimmedEntity && e.attribute === trimmedAttr && !claimedEvidenceIds.includes(e.evidenceId)
    );
    for (const comp of competingEvidences) {
      if (comp.value !== undefined && !isDeepEqual(comp.value, claimedValue)) {
        return Object.freeze({
          admitted: false,
          status: 'CONFLICT',
          rejectionReason: `[EVIDENCE_CONFLICT] Competing evidence '${comp.evidenceId}' asserts value ${JSON.stringify(comp.value)}, conflicting with claim value ${JSON.stringify(claimedValue)}.`,
          conflictDetails: Object.freeze([
            `Claim: ${JSON.stringify(claimedValue)} (via ${claimedEvidenceIds.join(',')})`,
            `Competing Evidence '${comp.evidenceId}': ${JSON.stringify(comp.value)}`
          ])
        });
      }
    }

    // 5. Successful Admission -> Generate Immutable VerifiedClaim (INVARIANT-02, INVARIANT-05)
    const verifiedClaimId = `vclm-${currentSnapshot.turn}-${matchedEvidences.map(e => e.evidenceId).join('_')}`;
    const verifiedClaim: VerifiedClaim = Object.freeze({
      claimId: verifiedClaimId,
      status: 'VERIFIED',
      targetEntityId: trimmedEntity,
      targetAttribute: trimmedAttr,
      verifiedValue: claimedValue !== undefined ? claimedValue : rawText,
      evidenceIds: Object.freeze([...claimedEvidenceIds]),
      verifiedAtTurn: currentSnapshot.turn,
      verifiedAtStateVersion: currentSnapshot.stateVersion,
      verifiedAtTimestamp: new Date().toISOString(),
      provenance: Object.freeze({
        source: groundSources.length > 0 ? groundSources.join('; ') : 'EXTERNAL_IMMIGRATION_EVIDENCE',
        verifiedEventId: verifiedEventIds.length > 0 ? verifiedEventIds[0] : undefined,
        evidenceCount: matchedEvidences.length
      })
    });

    // The authority registration occurs only after every deterministic grounding
    // and conflict check has passed. The exact object instance is the capability.
    ISSUED_VERIFIED_CLAIMS.add(verifiedClaim);

    return Object.freeze({
      admitted: true,
      status: 'VERIFIED',
      verifiedClaim
    });
  }

  /**
   * Batch admission helper.
   */
  public static verifyClaims(
    claimCandidates: readonly UntrustedClaim[],
    evidencePool: readonly ExternalEvidence[],
    currentSnapshot: CanonicalState,
    history?: readonly ImmutableHistoricalRecord[]
  ): readonly ImmigrationVerdict[] {
    if (!Array.isArray(claimCandidates)) return Object.freeze([]);
    return Object.freeze(claimCandidates.map(c => this.admit(c, evidencePool, currentSnapshot, history)));
  }

  /**
   * Validates that the object is both structurally valid AND an exact
   * authority object previously issued by ImmigrationGate.admit().
   */
  public static isValidVerifiedClaim(claim: any): claim is VerifiedClaim {
    if (!claim || typeof claim !== 'object') return false;
    if (!ISSUED_VERIFIED_CLAIMS.has(claim)) return false;
    if (!Object.isFrozen(claim)) return false;
    if (typeof claim.claimId !== 'string' || !claim.claimId.startsWith('vclm-')) return false;
    if (claim.status !== 'VERIFIED') return false;
    if (typeof claim.targetEntityId !== 'string' || claim.targetEntityId.trim() === '') return false;
    if (typeof claim.targetAttribute !== 'string' || claim.targetAttribute.trim() === '') return false;
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) return false;
    if (typeof claim.verifiedAtTurn !== 'number' || claim.verifiedAtTurn < 0) return false;
    if (
      typeof claim.verifiedAtStateVersion !== 'number' ||
      !Number.isInteger(claim.verifiedAtStateVersion) ||
      claim.verifiedAtStateVersion < 1
    ) {
      return false;
    }
    if (!claim.provenance || typeof claim.provenance !== 'object') return false;
    if (typeof claim.provenance.source !== 'string' || claim.provenance.source.trim() === '') return false;
    return true;
  }
}
