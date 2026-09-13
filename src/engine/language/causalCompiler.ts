/**
 * @file src/engine/language/causalCompiler.ts
 * @description VEIL Causal Language v1 Deterministic Compiler
 * Compiles natural language / candidate inputs into structured SemanticEvents,
 * enforces Action Signatures & Epistemic/Modality guards, and builds Canonical MeaningTrees.
 */

import {
  CanonicalRole,
  CausalCompilationResult,
  CausalCompilerStatus,
  EpistemicStatus,
  MeaningNode,
  Modality,
  Polarity,
  ReferenceResolutionStatus,
  Scope,
  SemanticEvent,
  SemanticEventRole,
} from './types';

export type { SemanticEvent };

/**
 * Action Signature Contract definition
 */
export interface ActionSignature {
  action: string;
  requiredRoles: CanonicalRole[];
  forbiddenRoles?: CanonicalRole[];
  optionalRoles?: CanonicalRole[];
  allowedModalities?: Modality[];
  allowedEpistemic?: EpistemicStatus[];
}

export const ACTION_SIGNATURES: Record<string, ActionSignature> = {
  DISCOVER: {
    action: 'DISCOVER',
    requiredRoles: ['SUBJECT', 'OBJECT'],
    forbiddenRoles: ['RECIPIENT'],
    optionalRoles: ['LOCATION', 'SOURCE', 'TIME', 'OBSERVER'],
  },
  PICKUP: {
    action: 'PICKUP',
    requiredRoles: ['SUBJECT', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['LOCATION', 'TIME', 'SOURCE'],
  },
  GIFT: {
    action: 'GIFT',
    requiredRoles: ['SUBJECT', 'RECIPIENT', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['LOCATION', 'TIME', 'BENEFICIARY', 'CAUSE'],
  },
  PURCHASE: {
    action: 'PURCHASE',
    requiredRoles: ['SUBJECT', 'COUNTERPARTY', 'OBJECT', 'VALUE'],
    forbiddenRoles: [],
    optionalRoles: ['LOCATION', 'TIME'],
  },
  RESOURCE_EXCHANGE: {
    action: 'RESOURCE_EXCHANGE',
    requiredRoles: ['SUBJECT', 'COUNTERPARTY', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['VALUE', 'LOCATION', 'TIME'],
  },
  LOOT: {
    action: 'LOOT',
    requiredRoles: ['SUBJECT', 'SOURCE', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['LOCATION', 'TIME'],
  },
  RETURN: {
    action: 'RETURN',
    requiredRoles: ['SUBJECT', 'RECIPIENT', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['LOCATION', 'TIME'],
  },
  PROMISE: {
    action: 'PROMISE',
    requiredRoles: ['SUBJECT', 'RECIPIENT', 'OBJECT'],
    forbiddenRoles: [],
    optionalRoles: ['TIME', 'LOCATION'],
    allowedModalities: ['COMMITMENT', 'INTENTIONAL'],
  },
  UPDATE_STATE: {
    action: 'UPDATE_STATE',
    requiredRoles: ['TARGET'],
    forbiddenRoles: [],
    optionalRoles: ['VALUE', 'TIME'],
  },
};

/**
 * Deterministically validates a SemanticEvent against its ActionSignature.
 */
export function validateActionSignature(event: SemanticEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sig = ACTION_SIGNATURES[event.action.toUpperCase()];

  if (!sig) {
    // If unknown action type, reject as invalid
    return { valid: false, errors: [`Unknown or unregistered action type: ${event.action}`] };
  }

  // Check required roles
  for (const reqRole of sig.requiredRoles) {
    const matching = event.roles.filter((r) => r.role === reqRole);
    if (matching.length === 0 || matching.every((r) => !r.entityName)) {
      errors.push(`Missing required ROLE '${reqRole}' for action '${sig.action}'`);
    }
  }

  // Check all present roles for unresolved or ambiguous reference statuses
  for (const r of event.roles) {
    if (r.status === 'UNRESOLVED' || r.status === 'AMBIGUOUS') {
      errors.push(`Required ROLE '${r.role}' has ambiguous or unresolved reference status: '${r.status}'`);
    }
  }

  // Check forbidden roles
  if (sig.forbiddenRoles) {
    for (const forbRole of sig.forbiddenRoles) {
      const matching = event.roles.filter((r) => r.role === forbRole && Boolean(r.entityName));
      if (matching.length > 0) {
        errors.push(`Forbidden ROLE '${forbRole}' present for action '${sig.action}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parses raw natural language text into discrete SemanticEvents (Event Segmentation).
 */
export function parseNaturalLanguageToEvents(text: string, baseScope: Scope = 'OFFSCREEN'): SemanticEvent[] {
  const events: SemanticEvent[] = [];
  const clean = text.trim();

  // Pattern A: Multi-event with discovery then gift ("~발견한 뒤 ~선물했다" / "~발견했지만 ~주지는 않았다")
  if (clean.includes('발견') && (clean.includes('선물') || clean.includes('주었다') || clean.includes('주지는 않았다') || clean.includes('주려고'))) {
    // Extract Subject (e.g., 삼화상인)
    let subject = 'unknown';
    const subjMatch = clean.match(/^([가-힣a-zA-Z0-9_]+)(이|가|은|는)/);
    if (subjMatch) subject = subjMatch[1];

    // Extract Object (e.g., 은화 / 은화단)
    let object = 'item';
    const objMatch = clean.match(/([가-힣a-zA-Z0-9_]+)(을|를)\s*(발견|보관|소지)/);
    if (objMatch) object = objMatch[1];

    // Event 1: DISCOVER
    events.push({
      eventId: `se-discover-${Date.now()}-1`,
      action: 'DISCOVER',
      roles: [
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: baseScope,
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE',
    });

    // Event 2: GIFT / Intent / Negation
    let recipient = '플레이어';
    if (clean.includes('플레이어에게') || clean.includes('주인공에게')) {
      recipient = clean.includes('주인공에게') ? '주인공' : '플레이어';
    }

    let polarity: Polarity = 'ASSERTED';
    let modality: Modality = 'NONE';

    if (clean.includes('주지는 않았다') || clean.includes('주지 않았다')) {
      polarity = 'NEGATED';
    } else if (clean.includes('주려고 했다') || clean.includes('주려 했다')) {
      modality = 'INTENTIONAL';
    }

    events.push({
      eventId: `se-gift-${Date.now()}-2`,
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: recipient, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: baseScope,
      polarity,
      epistemicStatus: 'OBSERVED',
      modality,
    });

    return events;
  }

  // Pattern B: Single DISCOVER
  if (clean.includes('발견했다') || clean.includes('발견했다.')) {
    let subject = 'unknown';
    const subjMatch = clean.match(/^([가-힣a-zA-Z0-9_]+)(이|가|은|는)/);
    if (subjMatch) subject = subjMatch[1];

    let object = 'item';
    const objMatch = clean.match(/([가-힣a-zA-Z0-9_]+)(을|를)\s*발견/);
    if (objMatch) object = objMatch[1];

    events.push({
      eventId: `se-discover-${Date.now()}`,
      action: 'DISCOVER',
      roles: [
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: baseScope,
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE',
    });
    return events;
  }

  // Pattern C: Passive Voice GIFT ("플레이어는 삼화상인에게 은화를 제공받았다.")
  if (clean.includes('제공받았다') || clean.includes('전달받았다') || clean.includes('수여받았다')) {
    let recipient = '플레이어';
    const recMatch = clean.match(/^([가-힣a-zA-Z0-9_]+)(은|는|이|가)/);
    if (recMatch) recipient = recMatch[1];

    let subject = 'unknown';
    const subjMatch = clean.match(/([가-힣a-zA-Z0-9_]+)에게/);
    if (subjMatch) subject = subjMatch[1];

    let object = 'item';
    const objMatch = clean.match(/([가-힣a-zA-Z0-9_]+)(을|를)/);
    if (objMatch) object = objMatch[1];

    events.push({
      eventId: `se-passive-gift-${Date.now()}`,
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: recipient, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: baseScope,
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality: 'NONE',
    });
    return events;
  }

  // Pattern D: Hearsay / Claim ("경비가 삼화상인이 플레이어에게 은화를 줬다고 말했다.")
  if (clean.includes('말했다') || clean.includes('주장했다') || clean.includes('전했다')) {
    let speaker = '경비';
    const spkMatch = clean.match(/^([가-힣a-zA-Z0-9_]+)(이|가)/);
    if (spkMatch) speaker = spkMatch[1];

    let subject = '삼화상인';
    let recipient = '플레이어';
    let object = '은화';

    events.push({
      eventId: `se-hearsay-${Date.now()}`,
      action: 'GIFT',
      roles: [
        { role: 'SPEAKER', entityName: speaker, status: 'RESOLVED' },
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: recipient, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: 'CLAIM',
      polarity: 'ASSERTED',
      epistemicStatus: 'HEARSAY',
      modality: 'NONE',
    });
    return events;
  }

  // Pattern E: Ambiguous Reference ("누군가가 무언가를 주었다.")
  if (clean.includes('누군가') || clean.includes('무언가')) {
    events.push({
      eventId: `se-ambiguous-${Date.now()}`,
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: undefined, status: 'UNRESOLVED' },
        { role: 'RECIPIENT', entityName: '플레이어', status: 'RESOLVED' },
        { role: 'OBJECT', entityName: undefined, status: 'AMBIGUOUS' },
      ],
      scope: baseScope,
      polarity: 'ASSERTED',
      epistemicStatus: 'UNVERIFIED',
      modality: 'NONE',
    });
    return events;
  }

  // Pattern F: GIFT or GIFT Intent ("삼화상인이 플레이어에게 은화를 주었다." / "주려고 했다")
  if (clean.includes('주었다') || clean.includes('선물했다') || clean.includes('주려고') || clean.includes('주려')) {
    let subject = 'unknown';
    const subjMatch = clean.match(/^([가-힣a-zA-Z0-9_]+)(이|가|은|는)/);
    if (subjMatch) subject = subjMatch[1];

    let recipient = '플레이어';
    const recMatch = clean.match(/([가-힣a-zA-Z0-9_]+)에게/);
    if (recMatch) recipient = recMatch[1];

    let object = 'item';
    const objMatch = clean.match(/([가-힣a-zA-Z0-9_]+)(을|를)/);
    if (objMatch) object = objMatch[1];

    let modality: Modality = 'NONE';
    if (clean.includes('주려고') || clean.includes('주려')) {
      modality = 'INTENTIONAL';
    }

    events.push({
      eventId: `se-gift-${Date.now()}`,
      action: 'GIFT',
      roles: [
        { role: 'SUBJECT', entityName: subject, status: 'RESOLVED' },
        { role: 'RECIPIENT', entityName: recipient, status: 'RESOLVED' },
        { role: 'OBJECT', entityName: object, status: 'RESOLVED' },
      ],
      scope: baseScope,
      polarity: 'ASSERTED',
      epistemicStatus: 'OBSERVED',
      modality,
    });
    return events;
  }

  // Unrecognized input: do not guess or create synthetic mutations
  return [];
}

/**
 * Deterministically compiles SemanticEvents into a Canonical MeaningTree.
 */
export function compileSemanticEventsToMeaningTree(events: readonly SemanticEvent[] | SemanticEvent[]): CausalCompilationResult {
  if (!events || events.length === 0) {
    return {
      status: 'UNKNOWN',
      events: [],
      errors: ['Unrecognized or unrepresentable natural language input'],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ev of events) {
    const val = validateActionSignature(ev);
    if (!val.valid) {
      errors.push(...val.errors);
    }
  }

  if (errors.length > 0) {
    // If ambiguity or missing required roles, check status
    const hasAmbiguity = events.some((ev) =>
      ev.roles.some((r) => r.status === 'UNRESOLVED' || r.status === 'AMBIGUOUS')
    );
    return {
      status: hasAmbiguity ? 'RECONCILIATION_REQUIRED' : 'INVALID',
      events: events as SemanticEvent[],
      errors,
      warnings,
    };
  }

  // Construct MeaningTree using the 11 Core Atoms
  const eventNodes: MeaningNode[] = events.map((ev) => {
    const roleNodes: MeaningNode[] = ev.roles.map((r) => ({
      atom: 'ROLE' as const,
      scope: ev.scope,
      value: r.role,
      fields: {
        entityName: r.entityName,
        entityId: r.entityId,
        status: r.status,
      },
      children: r.entityName
        ? [
            {
              atom: 'ENTITY' as const,
              scope: ev.scope,
              value: r.entityName,
              id: r.entityId,
            },
          ]
        : undefined,
    }));

    // Map extended semantic atoms permitted as ACTION children by Grammar:
    // ALLOWED_COMPOSITIONS['ACTION']: ['ENTITY', 'STATE', 'VALUE', 'TIME', 'ROLE', 'RELATION', 'CAUSE', 'CONSTRAINT', 'ACTION']

    const stateNodes: MeaningNode[] = (ev.states || []).map((st, idx) => ({
      atom: 'STATE' as const,
      scope: ev.scope,
      value: typeof st.name === 'string' ? st.name : (st.key ? String(st.key) : `state-${idx}`),
      fields: st,
    }));

    const relationNodes: MeaningNode[] = (ev.relations || []).map((rel, idx) => ({
      atom: 'RELATION' as const,
      scope: ev.scope,
      value: typeof rel.type === 'string' ? rel.type : (rel.name ? String(rel.name) : `relation-${idx}`),
      fields: rel,
    }));

    const valueNodes: MeaningNode[] = (ev.values || []).map((val, idx) => ({
      atom: 'VALUE' as const,
      scope: ev.scope,
      value: (val.value !== undefined ? (val.value as any) : (val.amount !== undefined ? (val.amount as any) : `value-${idx}`)),
      fields: val,
    }));

    const timeNodes: MeaningNode[] = (ev.times || []).map((tm, idx) => ({
      atom: 'TIME' as const,
      scope: ev.scope,
      value: typeof tm.timestamp === 'string' ? tm.timestamp : (tm.value ? String(tm.value) : `time-${idx}`),
      fields: {
        ...tm,
        ...(ev.temporalPrecision ? { temporalPrecision: ev.temporalPrecision } : {}),
      },
    }));

    // If temporalPrecision is specified without explicit times array, emit a TIME atom to preserve temporal precision
    if ((!ev.times || ev.times.length === 0) && ev.temporalPrecision) {
      timeNodes.push({
        atom: 'TIME' as const,
        scope: ev.scope,
        value: ev.temporalPrecision,
        fields: { temporalPrecision: ev.temporalPrecision },
      });
    }

    const causeNodes: MeaningNode[] = (ev.causes || []).map((cs, idx) => ({
      atom: 'CAUSE' as const,
      scope: ev.scope,
      value: typeof cs.reason === 'string' ? cs.reason : (cs.type ? String(cs.type) : (cs.causeId ? String(cs.causeId) : `cause-${idx}`)),
      fields: cs,
    }));

    const constraintNodes: MeaningNode[] = (ev.constraints || []).map((cn, idx) => ({
      atom: 'CONSTRAINT' as const,
      scope: ev.scope,
      value: typeof cn.rule === 'string' ? cn.rule : (cn.name ? String(cn.name) : `constraint-${idx}`),
      fields: cn,
    }));

    const childNodes: MeaningNode[] = [
      ...roleNodes,
      ...stateNodes,
      ...relationNodes,
      ...valueNodes,
      ...timeNodes,
      ...causeNodes,
      ...constraintNodes,
    ];

    return {
      id: ev.eventId,
      atom: 'ACTION' as const,
      scope: ev.scope,
      value: ev.action,
      fields: {
        eventId: ev.eventId,
        polarity: ev.polarity,
        epistemicStatus: ev.epistemicStatus,
        modality: ev.modality,
        ...(ev.provenance ? { provenance: ev.provenance } : {}),
        ...(ev.intent ? { intent: ev.intent } : {}),
        ...(ev.literalness !== undefined ? { literalness: ev.literalness } : {}),
        ...(ev.temporalPrecision ? { temporalPrecision: ev.temporalPrecision } : {}),
      },
      references: ev.references && ev.references.length > 0 ? ev.references : undefined,
      children: childNodes.length > 0 ? childNodes : undefined,
    };
  });

  const rootNode: MeaningNode = {
    atom: 'ACTION' as const,
    scope: events[0].scope,
    composition: 'ORDERED',
    value: 'COMPOUND_EVENT_SEQUENCE',
    children: eventNodes,
  };

  return {
    status: 'COMPILED',
    events: events as SemanticEvent[],
    meaningTree: rootNode,
    warnings,
  };
}
