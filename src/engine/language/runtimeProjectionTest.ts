import { projectMeaningTreeToRuntimeActions, checkMeaningTreeProjectionConsistency, assertMeaningTreeProjectionConsistency } from './runtimeProjection';
import { MeaningNode } from './types';

function action(type: string, id: string): MeaningNode {
  return {
    atom: 'ACTION',
    scope: 'PROPOSAL',
    value: type,
    fields: {
      actionType: type,
      payload: { id },
    },
  } as MeaningNode;
}

function root(composition: 'ORDERED' | 'UNORDERED', children: MeaningNode[]): MeaningNode {
  return {
    atom: 'CLAIM',
    scope: 'PROPOSAL',
    value: 'composition adversarial test',
    composition,
    children,
  } as MeaningNode;
}

function ids(actions: readonly any[]): string[] {
  return actions.map((a) => a.payload?.id);
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const A = action('ADD_NPC', 'A');
const B = action('ADD_NPC', 'B');
const C = action('ADD_NPC', 'C');
const D = action('ADD_NPC', 'D');

// A. Runtime Projection — ORDERED preserves declaration order.
{
  const p = projectMeaningTreeToRuntimeActions(root('ORDERED', [A, B]));
  expect(JSON.stringify(ids(p.actions)) === JSON.stringify(['A', 'B']), 'ORDERED[A,B] must project to [A,B].');

  const q = projectMeaningTreeToRuntimeActions(root('ORDERED', [B, A]));
  expect(JSON.stringify(ids(q.actions)) === JSON.stringify(['B', 'A']), 'ORDERED[B,A] must project to [B,A].');
}

// A. Runtime Projection — UNORDERED is declaration-order independent and deterministic.
{
  const p = projectMeaningTreeToRuntimeActions(root('UNORDERED', [A, B]));
  const q = projectMeaningTreeToRuntimeActions(root('UNORDERED', [B, A]));
  expect(JSON.stringify(ids(p.actions)) === JSON.stringify(ids(q.actions)), 'UNORDERED[A,B] and UNORDERED[B,A] must have identical runtime projections.');
}

// D. Nested/Mixed composition.
{
  const nestedAB = root('UNORDERED', [C, B]);
  const nestedBA = root('UNORDERED', [B, C]);
  const p = projectMeaningTreeToRuntimeActions(root('ORDERED', [A, nestedAB, D]));
  const q = projectMeaningTreeToRuntimeActions(root('ORDERED', [A, nestedBA, D]));
  expect(JSON.stringify(ids(p.actions)) === JSON.stringify(ids(q.actions)), 'Nested UNORDERED permutations must project identically.');
  expect(ids(p.actions)[0] === 'A' && ids(p.actions)[ids(p.actions).length - 1] === 'D', 'Outer ORDERED boundaries must remain fixed around nested UNORDERED.');

  const orderedBC = root('ORDERED', [B, C]);
  const orderedCB = root('ORDERED', [C, B]);
  const x = projectMeaningTreeToRuntimeActions(root('UNORDERED', [A, orderedBC]));
  const y = projectMeaningTreeToRuntimeActions(root('UNORDERED', [A, orderedCB]));
  expect(JSON.stringify(ids(x.actions)) !== JSON.stringify(ids(y.actions)), 'Nested ORDERED permutation must remain semantically distinct even inside UNORDERED.');
}

// B. MeaningTree ↔ actions consistency.
{
  const tree = root('ORDERED', [A, B]);
  const expected = projectMeaningTreeToRuntimeActions(tree).actions;
  const pass = checkMeaningTreeProjectionConsistency(tree, expected);
  expect(pass.isConsistent, 'Exact MeaningTree projection must pass consistency gate.');

  const mismatchOrder = checkMeaningTreeProjectionConsistency(tree, [...expected].reverse());
  expect(!mismatchOrder.isConsistent, 'ORDERED[A,B] with actions[B,A] must be rejected.');

  const mismatchMissing = checkMeaningTreeProjectionConsistency(tree, expected.slice(0, 1));
  expect(!mismatchMissing.isConsistent, 'ORDERED[A,B] with actions[A] must be rejected.');

  const mismatchExtra = checkMeaningTreeProjectionConsistency(tree, [...expected, projectMeaningTreeToRuntimeActions(root('ORDERED', [C])).actions[0]]);
  expect(!mismatchExtra.isConsistent, 'ORDERED[A,B] with actions[A,B,C] must be rejected.');

  const mismatchSubstitution = checkMeaningTreeProjectionConsistency(tree, [expected[0], projectMeaningTreeToRuntimeActions(root('ORDERED', [C])).actions[0]]);
  expect(!mismatchSubstitution.isConsistent, 'ORDERED[A,B] with actions[A,C] must be rejected.');

  let exactThrew = false;
  try {
    assertMeaningTreeProjectionConsistency(tree, expected);
  } catch {
    exactThrew = true;
  }
  expect(!exactThrew, 'assert gate must not throw for exact projection.');
  let threw = false;
  try {
    assertMeaningTreeProjectionConsistency(tree, [expected[1], expected[0]]);
  } catch {
    threw = true;
  }
  expect(threw, 'assert gate must fail closed on projection mismatch.');
}

// Missing MeaningTree is never allowed to silently fall back to actions[].
{
  const result = checkMeaningTreeProjectionConsistency(undefined, []);
  expect(!result.isConsistent, 'Missing MeaningTree must fail closed.');
}

console.log('COMPOSITION RUNTIME PROJECTION ADVERSARIAL TESTS: PASS');
console.log('ORDERED: sequence-preserving');
console.log('UNORDERED: deterministic canonical projection');
console.log('Nested/Mixed: recursive composition semantics preserved');
console.log('MeaningTree ↔ actions: mismatch rejection verified');
console.log('Missing MeaningTree: fail-closed verified');
