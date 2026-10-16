import { afterEach, describe, expect, it, vi } from 'vitest';
import { allRequirements, type RequirementNode } from '@/data/requirements';
import {
  clearTimestampedBranch,
  countProgress,
  flattenRequirements,
  mergeTimestampedStates,
  syncParentStates,
  toggleExclusive,
  toggleTimestampedChecklist,
  toPlainState,
  type TimestampedChecklistState,
  type UpdatePayloadItem,
} from './checklist';
import { checkedIds, fixture, FIXTURE_IDS, seededRandom, ts } from './test-utils';

const derived = (state: TimestampedChecklistState, nodes: RequirementNode[] = fixture) =>
  syncParentStates(nodes, toPlainState(state));

afterEach(() => {
  vi.useRealTimers();
});

describe('mergeTimestampedStates', () => {
  it('returns the remote state when local is empty and vice versa', () => {
    const remote = ts({ a: true }, 5);
    expect(mergeTimestampedStates({}, remote)).toEqual(remote);
    expect(mergeTimestampedStates(remote, {})).toEqual(remote);
    expect(mergeTimestampedStates({}, {})).toEqual({});
  });

  it('keeps local on a timestamp tie (strictly newer remote wins)', () => {
    const merged = mergeTimestampedStates(ts({ a: true }, 10), ts({ a: false }, 10));
    expect(merged.a).toEqual({ value: true, timestamp: 10 });
  });

  it('takes remote when it is newer by a single millisecond', () => {
    const merged = mergeTimestampedStates(ts({ a: true }, 10), ts({ a: false }, 11));
    expect(merged.a).toEqual({ value: false, timestamp: 11 });
  });

  it('lets any remote value beat a legacy (timestamp 0) local value', () => {
    const merged = mergeTimestampedStates(ts({ a: true }, 0), ts({ a: false }, 1));
    expect(merged.a.value).toBe(false);
  });

  it('keeps a legacy local value when remote is also timestamp 0', () => {
    const merged = mergeTimestampedStates(ts({ a: true }, 0), ts({ a: false }, 0));
    expect(merged.a.value).toBe(true);
  });

  it('merges per item, not per list', () => {
    const merged = mergeTimestampedStates(
      { a: { value: true, timestamp: 1 }, b: { value: true, timestamp: 9 } },
      { a: { value: false, timestamp: 5 }, b: { value: false, timestamp: 5 } },
    );
    expect(merged.a.value).toBe(false);
    expect(merged.b.value).toBe(true);
  });

  it('does not mutate either input and returns a new object', () => {
    const local = ts({ a: true }, 1);
    const remote = ts({ a: false, b: true }, 2);
    const localCopy = JSON.stringify(local);
    const remoteCopy = JSON.stringify(remote);
    const merged = mergeTimestampedStates(local, remote);
    expect(merged).not.toBe(local);
    expect(JSON.stringify(local)).toBe(localCopy);
    expect(JSON.stringify(remote)).toBe(remoteCopy);
  });

  it('is commutative when timestamps are distinct and idempotent', () => {
    const x = { a: { value: true, timestamp: 3 }, b: { value: false, timestamp: 7 } };
    const y = { a: { value: false, timestamp: 4 }, c: { value: true, timestamp: 1 } };
    expect(mergeTimestampedStates(x, y)).toEqual(mergeTimestampedStates(y, x));
    const once = mergeTimestampedStates(x, y);
    expect(mergeTimestampedStates(once, y)).toEqual(once);
  });
});

describe('toggleTimestampedChecklist', () => {
  it('emits ONLY the changed ids on the very first toggle (no mass "false" overwrite)', () => {
    const { updates, nextTsState } = toggleTimestampedChecklist({}, 'rf-2', 'back', 10, fixture);
    expect(updates).toEqual([{ id: 'rf-2', type: 'back', value: true, timestamp: 10 }]);
    expect(Object.keys(nextTsState)).toEqual(['rf-2']);
  });

  it('emits the parent and every descendant when a parent is checked', () => {
    const { updates } = toggleTimestampedChecklist({}, 'rf-1', 'full', 10, fixture);
    expect(updates.map((u) => u.id).sort()).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
    expect(updates.every((u) => u.value && u.type === 'full' && u.timestamp === 10)).toBe(true);
  });

  it('does not re-emit descendants that already had the target value', () => {
    const start = ts({ 'rf-1-1': true }, 1);
    const { updates } = toggleTimestampedChecklist(start, 'rf-1', 'back', 10, fixture);
    expect(updates.map((u) => u.id).sort()).toEqual(['rf-1', 'rf-1-2']);
  });

  it('emits the derived parent when the last child completes it', () => {
    const start = ts({ 'rf-1-1': true }, 1);
    const { updates } = toggleTimestampedChecklist(start, 'rf-1-2', 'back', 10, fixture);
    expect(updates.map((u) => u.id).sort()).toEqual(['rf-1', 'rf-1-2']);
  });

  it('emits the parent going false when a child is unchecked', () => {
    const start = ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true }, 1);
    const { updates, nextTsState } = toggleTimestampedChecklist(start, 'rf-1-1', 'back', 10, fixture);
    expect(updates.map((u) => [u.id, u.value])).toEqual([['rf-1', false], ['rf-1-1', false]]);
    expect(nextTsState['rf-1-2']).toEqual({ value: true, timestamp: 1 });
  });

  it('keeps the old timestamp on untouched entries', () => {
    const start = ts({ 'rf-2': true }, 7);
    const { nextTsState } = toggleTimestampedChecklist(start, 'rf-1', 'back', 10, fixture);
    expect(nextTsState['rf-2']).toEqual({ value: true, timestamp: 7 });
  });

  it('toggling twice yields true then false with the newest timestamp', () => {
    const first = toggleTimestampedChecklist({}, 'rf-2', 'back', 10, fixture);
    const second = toggleTimestampedChecklist(first.nextTsState, 'rf-2', 'back', 20, fixture);
    expect(second.nextTsState['rf-2']).toEqual({ value: false, timestamp: 20 });
    expect(second.updates).toEqual([{ id: 'rf-2', type: 'back', value: false, timestamp: 20 }]);
  });

  it('acts on what the user SEES: a displayed-checked parent with a stale stored value unchecks (regression)', () => {
    // Children are true, parent entry missing/stale-false: the UI derives the parent as checked.
    const stale = { ...ts({ 'rf-1-1': true, 'rf-1-2': true }, 5), 'rf-1': { value: false, timestamp: 1 } };
    expect(derived(stale)['rf-1']).toBe(true);

    const { nextTsState } = toggleTimestampedChecklist(stale, 'rf-1', 'full', 10, fixture);
    expect(checkedIds(derived(nextTsState))).toEqual([]);
  });

  it('acts on what the user SEES: a displayed-unchecked parent with a stale stored TRUE checks everything', () => {
    // Stored parent=true but one child false: derived parent is false, a click must check the branch.
    const stale = { ...ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': false }, 5) };
    expect(derived(stale)['rf-1']).toBe(false);

    const { nextTsState } = toggleTimestampedChecklist(stale, 'rf-1', 'full', 10, fixture);
    expect(checkedIds(derived(nextTsState))).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
  });

  it('does not mutate the previous timestamped state', () => {
    const start = ts({ 'rf-2': false }, 5);
    const copy = JSON.stringify(start);
    toggleTimestampedChecklist(start, 'rf-2', 'back', 10, fixture);
    expect(JSON.stringify(start)).toBe(copy);
  });

  it('ignores ids that are not in the tree (no state change, no updates)', () => {
    const { nextTsState, updates } = toggleTimestampedChecklist({}, 'ghost', 'back', 10, fixture);
    expect(updates).toEqual([]);
    expect(nextTsState).toEqual({});
  });

  it('defaults the timestamp to Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(123456);
    const { updates } = toggleTimestampedChecklist({}, 'rf-2', 'back', undefined, fixture);
    expect(updates[0].timestamp).toBe(123456);
  });

  it('tags every update with the requested checklist type', () => {
    const back = toggleTimestampedChecklist({}, 'rf-4', 'back', 1, fixture);
    const full = toggleTimestampedChecklist({}, 'rf-4', 'full', 1, fixture);
    expect(new Set(back.updates.map((u) => u.type))).toEqual(new Set(['back']));
    expect(new Set(full.updates.map((u) => u.type))).toEqual(new Set(['full']));
  });
});

describe('clearTimestampedBranch (additional edge cases)', () => {
  it('is a no-op for an empty state and for an unknown id', () => {
    expect(clearTimestampedBranch({}, 'rf-1', 'back', 5, fixture).updates).toEqual([]);
    const state = ts({ 'rf-2': true });
    const { nextTsState, updates } = clearTimestampedBranch(state, 'ghost', 'back', 5, fixture);
    expect(updates).toEqual([]);
    expect(nextTsState).toEqual(state);
  });

  it('only writes entries that actually changed and tags the requested type', () => {
    const state = ts({ 'rf-1-1': true, 'rf-2': true }, 3);
    const { nextTsState, updates } = clearTimestampedBranch(state, 'rf-1', 'full', 9, fixture);
    expect(updates).toEqual([{ id: 'rf-1-1', type: 'full', value: false, timestamp: 9 }]);
    expect(nextTsState['rf-2']).toEqual({ value: true, timestamp: 3 });
  });

  it('clearing one grandchild also clears the derived ancestors, not the siblings', () => {
    const state = ts({ 'rf-4': true, 'rf-4-1': true, 'rf-4-2': true, 'rf-4-2-1': true, 'rf-4-2-2': true });
    const { nextTsState } = clearTimestampedBranch(state, 'rf-4-2-1', 'back', 9, fixture);
    expect(checkedIds(derived(nextTsState))).toEqual(['rf-4-1', 'rf-4-2-2']);
  });

  it('does not mutate its input', () => {
    const state = ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true });
    const copy = JSON.stringify(state);
    clearTimestampedBranch(state, 'rf-1', 'back', 9, fixture);
    expect(JSON.stringify(state)).toBe(copy);
  });

  it('uses the derived state: clears a branch that is only "checked" through its children', () => {
    const state = ts({ 'rf-1-1': true, 'rf-1-2': true }); // parent entry missing, derived true
    const { nextTsState, updates } = clearTimestampedBranch(state, 'rf-1', 'back', 9, fixture);
    expect(checkedIds(derived(nextTsState))).toEqual([]);
    expect(updates.map((u) => u.id).sort()).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
  });
});

describe('toggleExclusive (cumulative dual checklist semantics)', () => {
  it('checking a leaf in back leaves full untouched when nothing was full', () => {
    const other = ts({ 'rf-2': true });
    const result = toggleExclusive({}, other, 'rf-1-1', 'back', 5, fixture);
    expect(result.nextOppositeTsState).toBe(other);
    expect(result.updates.map((u) => u.type)).toEqual(['back']);
  });

  it('checking an item in full ensures it is also marked in back (cumulative progress)', () => {
    const back = ts({});
    const result = toggleExclusive({}, back, 'rf-1-1', 'full', 5, fixture);
    expect(derived(result.nextTsState)['rf-1-1']).toBe(true);
    expect(derived(result.nextOppositeTsState)['rf-1-1']).toBe(true);
    expect(result.updates).toContainEqual({ id: 'rf-1-1', type: 'full', value: true, timestamp: 5 });
    expect(result.updates).toContainEqual({ id: 'rf-1-1', type: 'back', value: true, timestamp: 5 });
  });

  it('unchecking full leaves back intact (backend is still done)', () => {
    const full = ts({ 'rf-2': true });
    const back = ts({ 'rf-2': true });
    const result = toggleExclusive(full, back, 'rf-2', 'full', 5, fixture);
    expect(derived(result.nextTsState)['rf-2']).toBe(false);
    expect(derived(result.nextOppositeTsState)['rf-2']).toBe(true);
    expect(result.updates).toEqual([{ id: 'rf-2', type: 'full', value: false, timestamp: 5 }]);
  });

  it('unchecking back cascades to uncheck full (since full requires backend)', () => {
    const back = ts({ 'rf-2': true });
    const full = ts({ 'rf-2': true });
    const result = toggleExclusive(back, full, 'rf-2', 'back', 5, fixture);
    expect(derived(result.nextTsState)['rf-2']).toBe(false);
    expect(derived(result.nextOppositeTsState)['rf-2']).toBe(false);
    expect(result.updates).toContainEqual({ id: 'rf-2', type: 'back', value: false, timestamp: 5 });
    expect(result.updates).toContainEqual({ id: 'rf-2', type: 'full', value: false, timestamp: 5 });
  });

  it('the reported colleague scenario: child marked "back", then parent marked "full" (back count never drops)', () => {
    const back = ts({ 'rf-1-1': true });
    const result = toggleExclusive({}, back, 'rf-1', 'full', 5, fixture);

    const backPlain = derived(result.nextOppositeTsState);
    const fullPlain = derived(result.nextTsState);

    expect(checkedIds(fullPlain)).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
    expect(checkedIds(backPlain)).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
    expect(countProgress(fixture, backPlain).completed).toBe(3);
    expect(countProgress(fixture, fullPlain).completed).toBe(3);
  });

  it('completing a parent through its last child in back keeps existing full child intact', () => {
    // rf-1-1 is "full" (and thus "back"); user checks rf-1-2 as "back" -> parent is complete in back, not in full.
    const full = ts({ 'rf-1-1': true });
    const back = ts({ 'rf-1-1': true });
    const result = toggleExclusive(back, full, 'rf-1-2', 'back', 5, fixture);
    expect(checkedIds(derived(result.nextTsState))).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
    expect(checkedIds(derived(result.nextOppositeTsState))).toEqual(['rf-1-1']);
  });

  it('checking then unchecking full leaves back intact', () => {
    const back = ts({ 'rf-2': true });
    const checked = toggleExclusive({}, back, 'rf-2', 'full', 5, fixture);
    expect(derived(checked.nextTsState)['rf-2']).toBe(true);
    expect(derived(checked.nextOppositeTsState)['rf-2']).toBe(true);

    const unchecked = toggleExclusive(checked.nextTsState, checked.nextOppositeTsState, 'rf-2', 'full', 6, fixture);
    expect(derived(unchecked.nextTsState)['rf-2']).toBe(false);
    expect(derived(unchecked.nextOppositeTsState)['rf-2']).toBe(true);
  });

  it('does not mutate either input state', () => {
    const back = ts({ 'rf-1-1': true });
    const full = ts({ 'rf-2': true });
    const copies = [JSON.stringify(back), JSON.stringify(full)];
    toggleExclusive(full, back, 'rf-1', 'full', 5, fixture);
    expect([JSON.stringify(back), JSON.stringify(full)]).toEqual(copies);
  });

  it('ignores unknown ids entirely', () => {
    const other = ts({ 'rf-2': true });
    const result = toggleExclusive({}, other, 'ghost', 'back', 5, fixture);
    expect(result.updates).toEqual([]);
    expect(result.nextOppositeTsState).toBe(other);
  });

  it('defaults the timestamp to Date.now() for both lists', () => {
    vi.useFakeTimers();
    vi.setSystemTime(777);
    const result = toggleExclusive({}, ts({ 'rf-2': true }), 'rf-2', 'back', undefined, fixture);
    expect(new Set(result.updates.map((u) => u.timestamp))).toEqual(new Set([777]));
  });
});

/**
 * Replays the exact cloud rule from api/checklist.ts (latest timestamp wins, strictly newer replaces).
 */
const applyToServer = (
  server: { back: TimestampedChecklistState; full: TimestampedChecklistState },
  updates: UpdatePayloadItem[],
) => {
  for (const update of updates) {
    const target = update.type === 'back' ? server.back : server.full;
    const existing = target[update.id];
    if (!existing || update.timestamp > existing.timestamp) {
      target[update.id] = { value: update.value, timestamp: update.timestamp };
    }
  }
};

describe.each([
  ['hand-made fixture', fixture],
  ['the real requirement tree', allRequirements],
])('random walk invariants — %s', (_label, nodes) => {
  const ids = flattenRequirements(nodes).map((n) => n.id);

  it.each([1, 2, 3, 42, 2026])('seed %i: full implies back, sync is lossless and updates are minimal', (seed) => {
    const random = seededRandom(seed);
    let back: TimestampedChecklistState = {};
    let full: TimestampedChecklistState = {};
    const server = { back: {} as TimestampedChecklistState, full: {} as TimestampedChecklistState };

    for (let step = 1; step <= 300; step += 1) {
      const id = ids[Math.floor(random() * ids.length)];
      const type = random() < 0.5 ? 'back' : 'full';
      const prevBack = derived(back, nodes);
      const prevFull = derived(full, nodes);

      const result = type === 'back'
        ? toggleExclusive(back, full, id, 'back', step, nodes)
        : toggleExclusive(full, back, id, 'full', step, nodes);

      if (type === 'back') {
        back = result.nextTsState;
        full = result.nextOppositeTsState;
      } else {
        full = result.nextTsState;
        back = result.nextOppositeTsState;
      }

      const nextBack = derived(back, nodes);
      const nextFull = derived(full, nodes);

      // 1. cumulative invariant: full implies back (every full node is also done in back)
      const missingBack = ids.filter((nodeId) => nextFull[nodeId] && !nextBack[nodeId]);
      expect(missingBack, `step ${step} (${type} ${id})`).toEqual([]);

      // 2. full progress never exceeds back progress
      expect(
        countProgress(nodes, nextFull).completed,
      ).toBeLessThanOrEqual(countProgress(nodes, nextBack).completed);

      // 3. minimal updates: every update is a real change of the derived value, unique per (type, id)
      const seen = new Set<string>();
      for (const update of result.updates) {
        const prev = update.type === 'back' ? prevBack : prevFull;
        expect(Boolean(prev[update.id])).not.toBe(update.value);
        expect(ids).toContain(update.id);
        const key = `${update.type}:${update.id}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }

      // 4. the server, fed only with `updates`, always equals the local stored state
      applyToServer(server, result.updates);
      expect(toPlainState(server.back)).toEqual(toPlainState(back));
      expect(toPlainState(server.full)).toEqual(toPlainState(full));
    }
  });

  it('a second device that merges only the server state sees exactly the first device\'s view', () => {
    const random = seededRandom(7);
    let back: TimestampedChecklistState = {};
    let full: TimestampedChecklistState = {};
    const server = { back: {} as TimestampedChecklistState, full: {} as TimestampedChecklistState };

    for (let step = 1; step <= 150; step += 1) {
      const id = ids[Math.floor(random() * ids.length)];
      const type = random() < 0.5 ? 'back' : 'full';
      const result = type === 'back'
        ? toggleExclusive(back, full, id, 'back', step, nodes)
        : toggleExclusive(full, back, id, 'full', step, nodes);
      if (type === 'back') {
        back = result.nextTsState;
        full = result.nextOppositeTsState;
      } else {
        full = result.nextTsState;
        back = result.nextOppositeTsState;
      }
      applyToServer(server, result.updates);
    }

    const secondBack = mergeTimestampedStates({}, server.back);
    const secondFull = mergeTimestampedStates({}, server.full);
    expect(derived(secondBack, nodes)).toEqual(derived(back, nodes));
    expect(derived(secondFull, nodes)).toEqual(derived(full, nodes));
  });
});

describe('fixture sanity', () => {
  it('has the ids the other tests rely on', () => {
    expect(flattenRequirements(fixture).map((n) => n.id)).toEqual(FIXTURE_IDS);
  });
});
