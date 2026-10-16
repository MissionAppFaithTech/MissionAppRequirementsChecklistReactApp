import { describe, expect, it, vi } from 'vitest';
import {
  isPartiallyChecked,
  restoreTimestampedState,
  syncParentStates,
  toggleExclusive,
  toPlainState,
} from './checklist';
import { describeMove } from './notice';
import { checkedIds, fixture, ts } from './test-utils';

const byId = (id: string) => {
  const find = (nodes: typeof fixture): (typeof fixture)[number] | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = node.children && find(node.children);
      if (found) return found;
    }
    return undefined;
  };
  return find(fixture)!;
};

describe('isPartiallyChecked (indeterminate checkbox)', () => {
  it('is false for a parent with nothing checked', () => {
    expect(isPartiallyChecked(byId('rf-1'), {})).toBe(false);
  });

  it('is true when only some children are checked', () => {
    expect(isPartiallyChecked(byId('rf-1'), { 'rf-1-1': true })).toBe(true);
  });

  it('is false when the parent itself is checked (all children checked)', () => {
    expect(isPartiallyChecked(byId('rf-1'), { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true })).toBe(false);
  });

  it('is never true for a leaf, even if checked or unchecked', () => {
    expect(isPartiallyChecked(byId('rf-2'), { 'rf-2': true })).toBe(false);
    expect(isPartiallyChecked(byId('rf-2'), {})).toBe(false);
  });

  it('never treats a node with an empty children array as partial', () => {
    expect(isPartiallyChecked(byId('rf-5'), { 'rf-5': false })).toBe(false);
  });

  it('looks at deep descendants, not just direct children', () => {
    expect(isPartiallyChecked(byId('rf-4'), { 'rf-4-2-2': true })).toBe(true);
    // rf-3 has a single chain, so its only leaf completes it (derived state): not partial.
    expect(isPartiallyChecked(byId('rf-3'), syncParentStates(fixture, { 'rf-3-1-1': true }))).toBe(false);
  });

  it('is evaluated on the DERIVED state: a mid-level parent complete in this list is not partial', () => {
    const derived = syncParentStates(fixture, { 'rf-4-2-1': true, 'rf-4-2-2': true });
    expect(isPartiallyChecked(byId('rf-4-2'), derived)).toBe(false);
    expect(isPartiallyChecked(byId('rf-4'), derived)).toBe(true);
  });

  it('a group split between back and full is partial in BOTH lists', () => {
    const back = syncParentStates(fixture, { 'rf-1-1': true });
    const full = syncParentStates(fixture, { 'rf-1-2': true });
    expect(isPartiallyChecked(byId('rf-1'), back)).toBe(true);
    expect(isPartiallyChecked(byId('rf-1'), full)).toBe(true);
  });
});

describe('restoreTimestampedState (undo)', () => {
  const derived = (state: ReturnType<typeof ts>) => syncParentStates(fixture, toPlainState(state));

  it('is a no-op when nothing differs', () => {
    const state = ts({ 'rf-2': true });
    const { nextTsState, updates } = restoreTimestampedState(state, state, 'back', 9, fixture);
    expect(updates).toEqual([]);
    expect(nextTsState).toEqual(state);
  });

  it('reverts a checked item and stamps it with the new timestamp', () => {
    const before = ts({});
    const after = ts({ 'rf-2': true }, 5);
    const { nextTsState, updates } = restoreTimestampedState(after, before, 'back', 9, fixture);
    expect(nextTsState['rf-2']).toEqual({ value: false, timestamp: 9 });
    expect(updates).toEqual([{ id: 'rf-2', type: 'back', value: false, timestamp: 9 }]);
  });

  it('re-checks items that a move had cleared', () => {
    const before = ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true });
    const after = ts({ 'rf-1': false, 'rf-1-1': false, 'rf-1-2': false }, 5);
    const { nextTsState } = restoreTimestampedState(after, before, 'full', 9, fixture);
    expect(checkedIds(derived(nextTsState))).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
  });

  it('leaves untouched ids (and their timestamps) alone', () => {
    const before = ts({ 'rf-2': true }, 1);
    const after = { ...ts({ 'rf-2': true }, 1), ...ts({ 'rf-4-1': true }, 5) };
    const { nextTsState } = restoreTimestampedState(after, before, 'back', 9, fixture);
    expect(nextTsState['rf-2']).toEqual({ value: true, timestamp: 1 });
  });

  it('does not mutate its inputs', () => {
    const before = ts({});
    const after = ts({ 'rf-2': true }, 5);
    const copies = [JSON.stringify(before), JSON.stringify(after)];
    restoreTimestampedState(after, before, 'back', 9, fixture);
    expect([JSON.stringify(before), JSON.stringify(after)]).toEqual(copies);
  });

  it('defaults the timestamp to Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(4242);
    const { updates } = restoreTimestampedState(ts({ 'rf-2': true }), ts({}), 'back', undefined, fixture);
    expect(updates[0].timestamp).toBe(4242);
    vi.useRealTimers();
  });

  it('undoing restores BOTH lists exactly (the user scenario)', () => {
    const back0 = ts({ 'rf-1-1': true });
    const full0 = ts({ 'rf-1-1': true });

    // user unchecks "back" on the parent: child is cleared in both back and full
    const result = toggleExclusive(back0, full0, 'rf-1-1', 'back', 5, fixture);

    // undo: put both lists back using the snapshot taken before the click
    const undoBack = restoreTimestampedState(result.nextTsState, back0, 'back', 9, fixture);
    const undoFull = restoreTimestampedState(result.nextOppositeTsState, full0, 'full', 9, fixture);

    expect(checkedIds(derived(undoBack.nextTsState))).toEqual(['rf-1-1']);
    expect(checkedIds(derived(undoFull.nextTsState))).toEqual(['rf-1-1']);
    expect([...undoBack.updates, ...undoFull.updates].every((u) => u.timestamp === 9)).toBe(true);
  });

  it('undo wins over the change in the cloud conflict rule (newer timestamp)', () => {
    const back0 = ts({ 'rf-2': true }, 1);
    const full0 = ts({ 'rf-2': true }, 1);
    const changed = toggleExclusive(back0, full0, 'rf-2', 'back', 5, fixture);
    const undo = restoreTimestampedState(changed.nextTsState, back0, 'back', 9, fixture);
    const clearedAt = changed.nextTsState['rf-2'].timestamp;
    expect(undo.nextTsState['rf-2'].timestamp).toBeGreaterThan(clearedAt);
    expect(undo.nextTsState['rf-2'].value).toBe(true);
  });
});

describe('describeMove', () => {
  it('describes a single item moved to full', () => {
    expect(describeMove('RF 1.1', 'full', 1)).toBe('RF 1.1 movido de “Back” para “Back e Front”.');
  });

  it('describes a single item moved to back', () => {
    expect(describeMove('RF 2', 'back', 1)).toBe('RF 2 movido de “Back e Front” para “Back”.');
  });

  it('mentions how many items moved when more than one', () => {
    expect(describeMove('RF 1', 'full', 3)).toBe('RF 1 movido de “Back” para “Back e Front” (3 itens).');
  });

  it('does not add the count for 0 or 1', () => {
    expect(describeMove('RF 1', 'full', 0)).not.toContain('itens');
    expect(describeMove('RF 1', 'full', 1)).not.toContain('itens');
  });
});
