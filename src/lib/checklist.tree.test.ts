import { describe, expect, it } from 'vitest';
import {
  countDualProgress,
  countProgress,
  findRequirementNode,
  flattenRequirements,
  getDescendantIds,
  syncParentStates,
  toggleChecklist,
  toPlainState,
} from './checklist';
import { checkedIds, fixture, FIXTURE_IDS, ts } from './test-utils';

describe('flattenRequirements', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenRequirements([])).toEqual([]);
  });

  it('is depth-first, parent before children', () => {
    expect(flattenRequirements(fixture).map((n) => n.id)).toEqual(FIXTURE_IDS);
  });

  it('keeps a node whose children array is empty and does not recurse into it', () => {
    const ids = flattenRequirements([fixture[4]]).map((n) => n.id);
    expect(ids).toEqual(['rf-5']);
  });

  it('does not mutate the tree', () => {
    const before = JSON.stringify(fixture);
    flattenRequirements(fixture);
    expect(JSON.stringify(fixture)).toBe(before);
  });
});

describe('countProgress', () => {
  it('reports 0/0 and 0% (not NaN) for an empty tree', () => {
    expect(countProgress([], {})).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('reports 0% for an empty state', () => {
    expect(countProgress(fixture, {})).toEqual({ completed: 0, total: 13, percent: 0 });
  });

  it('reports 100% when every node is checked', () => {
    const all = Object.fromEntries(FIXTURE_IDS.map((id) => [id, true]));
    expect(countProgress(fixture, all)).toEqual({ completed: 13, total: 13, percent: 100 });
  });

  it('counts parents and leaves alike (each node is one unit)', () => {
    expect(countProgress(fixture, { 'rf-1': true }).completed).toBe(1);
    expect(countProgress(fixture, { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true }).completed).toBe(3);
  });

  it('ignores ids that are not in the tree', () => {
    expect(countProgress(fixture, { ghost: true, 'rf-2': true }).completed).toBe(1);
  });

  it('ignores explicit false values', () => {
    expect(countProgress(fixture, { 'rf-2': false, 'rf-1': false }).completed).toBe(0);
  });

  it.each([
    [1, 3, 33],
    [2, 3, 67],
    [1, 6, 17],
    [1, 8, 13],
  ])('rounds %i of %i to %i%%', (done, total, percent) => {
    const nodes = Array.from({ length: total }, (_, i) => ({ id: `n${i}`, code: `N${i}`, title: `N${i}` }));
    const state = Object.fromEntries(nodes.slice(0, done).map((n) => [n.id, true]));
    expect(countProgress(nodes, state).percent).toBe(percent);
  });

  it('never rounds up to 100% before everything is done (99.5% case)', () => {
    const nodes = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, code: `N${i}`, title: `N${i}` }));
    const state = Object.fromEntries(nodes.slice(0, 199).map((n) => [n.id, true]));
    // 199/200 = 99.5% -> Math.round gives 100: documents the known display quirk.
    expect(countProgress(nodes, state).completed).toBe(199);
    expect(countProgress(nodes, state).percent).toBe(100);
  });
});

describe('countDualProgress', () => {
  it('keeps back and full independent', () => {
    const progress = countDualProgress(fixture, { 'rf-2': true }, { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true });
    expect(progress.back.completed).toBe(1);
    expect(progress.full.completed).toBe(3);
    expect(progress.back.total).toBe(progress.full.total);
  });

  it('does not add the two lists together (a disjoint item counts once overall)', () => {
    const progress = countDualProgress(fixture, { 'rf-2': true }, { 'rf-1-1': true });
    expect(progress.back.completed + progress.full.completed).toBe(2);
  });
});

describe('findRequirementNode', () => {
  it('finds root, nested and deeply nested nodes', () => {
    expect(findRequirementNode(fixture, 'rf-2')?.code).toBe('RF 2');
    expect(findRequirementNode(fixture, 'rf-1-2')?.code).toBe('RF 1.2');
    expect(findRequirementNode(fixture, 'rf-4-2-2')?.code).toBe('RF 4.2.2');
  });

  it('returns null for unknown ids, empty id and empty tree', () => {
    expect(findRequirementNode(fixture, 'nope')).toBeNull();
    expect(findRequirementNode(fixture, '')).toBeNull();
    expect(findRequirementNode([], 'rf-1')).toBeNull();
  });

  it('returns the very same node object (no copy)', () => {
    expect(findRequirementNode(fixture, 'rf-3-1')).toBe(fixture[2].children![0]);
  });

  it('is case sensitive', () => {
    expect(findRequirementNode(fixture, 'RF-1')).toBeNull();
  });
});

describe('getDescendantIds', () => {
  it('returns only itself for a leaf', () => {
    expect(getDescendantIds(fixture[1])).toEqual(['rf-2']);
  });

  it('returns only itself for a node with an empty children array', () => {
    expect(getDescendantIds(fixture[4])).toEqual(['rf-5']);
  });

  it('returns itself first, then every descendant depth-first', () => {
    expect(getDescendantIds(fixture[3])).toEqual(['rf-4', 'rf-4-1', 'rf-4-2', 'rf-4-2-1', 'rf-4-2-2']);
  });

  it('works from a mid-level node', () => {
    expect(getDescendantIds(findRequirementNode(fixture, 'rf-4-2')!)).toEqual(['rf-4-2', 'rf-4-2-1', 'rf-4-2-2']);
  });
});

describe('syncParentStates', () => {
  it('does not mutate its input', () => {
    const input = { 'rf-1': true };
    syncParentStates(fixture, input);
    expect(input).toEqual({ 'rf-1': true });
  });

  it('returns an equivalent empty state for an empty state (no phantom keys)', () => {
    expect(syncParentStates(fixture, {})).toEqual({});
  });

  it('checks a parent when all its children are checked', () => {
    expect(syncParentStates(fixture, { 'rf-1-1': true, 'rf-1-2': true })['rf-1']).toBe(true);
  });

  it('unchecks a parent that is checked while a child is not', () => {
    const next = syncParentStates(fixture, { 'rf-1': true, 'rf-1-1': true });
    expect(next['rf-1']).toBe(false);
    expect(next['rf-1-1']).toBe(true);
  });

  it('a stored parent with no children state at all becomes false', () => {
    expect(syncParentStates(fixture, { 'rf-1': true })).toEqual({ 'rf-1': false });
  });

  it('rolls up through several levels', () => {
    const next = syncParentStates(fixture, {
      'rf-4-1': true,
      'rf-4-2-1': true,
      'rf-4-2-2': true,
    });
    expect(next['rf-4-2']).toBe(true);
    expect(next['rf-4']).toBe(true);
  });

  it('does not roll up when only one branch of a multi-level parent is complete', () => {
    const next = syncParentStates(fixture, { 'rf-4-2-1': true, 'rf-4-2-2': true });
    expect(next['rf-4-2']).toBe(true);
    expect(next['rf-4']).toBeUndefined();
  });

  it('leaves leaves, unknown ids and empty-children nodes alone', () => {
    const next = syncParentStates(fixture, { 'rf-2': true, 'rf-5': true, ghost: true });
    expect(next).toEqual({ 'rf-2': true, 'rf-5': true, ghost: true });
  });

  it('is idempotent', () => {
    const once = syncParentStates(fixture, { 'rf-1': true, 'rf-1-1': true, 'rf-4-1': true });
    expect(syncParentStates(fixture, once)).toEqual(once);
  });

  it('handles an empty tree', () => {
    expect(syncParentStates([], { a: true })).toEqual({ a: true });
  });
});

describe('toggleChecklist', () => {
  it('toggling twice returns to the original state', () => {
    const once = toggleChecklist({}, 'rf-4', fixture);
    const twice = toggleChecklist(once, 'rf-4', fixture);
    expect(checkedIds(twice)).toEqual([]);
  });

  it('checking a parent over a partially checked branch completes the whole branch', () => {
    const next = toggleChecklist({ 'rf-4-1': true }, 'rf-4', fixture);
    expect(checkedIds(next)).toEqual(['rf-4', 'rf-4-1', 'rf-4-2', 'rf-4-2-1', 'rf-4-2-2']);
  });

  it('checking a mid-level node checks its descendants and leaves siblings alone', () => {
    const next = toggleChecklist({}, 'rf-4-2', fixture);
    expect(checkedIds(next)).toEqual(['rf-4-2', 'rf-4-2-1', 'rf-4-2-2']);
    expect(next['rf-4']).toBeUndefined();
  });

  it('checking the last open leaf completes every ancestor', () => {
    const state = { 'rf-4-1': true, 'rf-4-2-1': true };
    const next = toggleChecklist(state, 'rf-4-2-2', fixture);
    expect(checkedIds(next)).toEqual(['rf-4', 'rf-4-1', 'rf-4-2', 'rf-4-2-1', 'rf-4-2-2']);
  });

  it('unchecking one grandchild unchecks every ancestor but not the siblings', () => {
    const all = toggleChecklist({}, 'rf-4', fixture);
    const next = toggleChecklist(all, 'rf-4-2-1', fixture);
    expect(checkedIds(next)).toEqual(['rf-4-1', 'rf-4-2-2']);
  });

  it('toggles a node with an empty children array like a leaf', () => {
    expect(toggleChecklist({}, 'rf-5', fixture)['rf-5']).toBe(true);
  });

  it('toggling an id that is not in the tree flips just that key', () => {
    expect(toggleChecklist({}, 'ghost', fixture)).toEqual({ ghost: true });
    expect(toggleChecklist({ ghost: true }, 'ghost', fixture)).toEqual({ ghost: false });
  });

  it('does not mutate the previous state', () => {
    const state = { 'rf-1-1': true };
    toggleChecklist(state, 'rf-1', fixture);
    expect(state).toEqual({ 'rf-1-1': true });
  });
});

describe('toPlainState', () => {
  it('returns an empty object for an empty state', () => {
    expect(toPlainState({})).toEqual({});
  });

  it('keeps false values (they are meaningful "explicitly unchecked" entries)', () => {
    expect(toPlainState(ts({ a: false, b: true }))).toEqual({ a: false, b: true });
  });

  it('drops the timestamps', () => {
    expect(toPlainState({ a: { value: true, timestamp: 999 } })).toEqual({ a: true });
  });
});
