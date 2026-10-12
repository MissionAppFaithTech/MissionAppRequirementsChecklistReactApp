import { beforeEach, describe, expect, it } from 'vitest';
import type { RequirementNode } from '@/data/requirements';
import {
  CHECKLIST_BACK_KEY,
  CHECKLIST_FULL_KEY,
  CHECKLIST_STORAGE_KEY,
  countDualProgress,
  countProgress,
  flattenRequirements,
  clearTimestampedBranch,
  loadChecklist,
  loadTimestampedChecklist,
  mergeTimestampedStates,
  saveChecklist,
  saveTimestampedChecklist,
  syncParentStates,
  toggleChecklist,
  toggleTimestampedChecklist,
  toPlainState,
} from './checklist';

const requirements: RequirementNode[] = [
  {
    id: 'rf-1',
    code: 'RF 1',
    title: 'Cadastro',
    children: [
      { id: 'rf-1-1', code: 'RF 1.1', title: 'Nome completo' },
      { id: 'rf-1-2', code: 'RF 1.2', title: 'E-mail' },
    ],
  },
  { id: 'rf-2', code: 'RF 2', title: 'Projetos de impacto' },
  {
    id: 'rf-3',
    code: 'RF 3',
    title: 'Hierarquia profunda',
    children: [
      {
        id: 'rf-3-1',
        code: 'RF 3.1',
        title: 'Nível 2',
        children: [{ id: 'rf-3-1-1', code: 'RF 3.1.1', title: 'Nível 3' }],
      },
    ],
  },
];

describe('checklist state', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
  });

  it('flattens nested requirements and counts progress', () => {
    expect(flattenRequirements(requirements).map((node) => node.id)).toEqual([
      'rf-1',
      'rf-1-1',
      'rf-1-2',
      'rf-2',
      'rf-3',
      'rf-3-1',
      'rf-3-1-1',
    ]);
    expect(countProgress(requirements, { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true })).toEqual({
      completed: 3,
      total: 7,
      percent: 43,
    });
  });

  it('toggles an item without mutating the previous state', () => {
    const initial = { 'rf-2': false };
    const next = toggleChecklist(initial, 'rf-2', requirements);

    expect(next).toEqual({ 'rf-2': true });
    expect(initial).toEqual({ 'rf-2': false });
  });

  it('checks all sub-requirements within the box when a parent requirement is checked', () => {
    const next = toggleChecklist({}, 'rf-1', requirements);

    expect(next).toEqual({
      'rf-1': true,
      'rf-1-1': true,
      'rf-1-2': true,
    });
  });

  it('unchecks all sub-requirements when a parent requirement is unchecked', () => {
    const initial = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const next = toggleChecklist(initial, 'rf-1', requirements);

    expect(next).toEqual({
      'rf-1': false,
      'rf-1-1': false,
      'rf-1-2': false,
    });
  });

  it('unchecks the parent requirement when a sub-requirement is unchecked', () => {
    const initial = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const next = toggleChecklist(initial, 'rf-1-1', requirements);

    expect(next).toEqual({
      'rf-1': false,
      'rf-1-1': false,
      'rf-1-2': true,
    });
  });

  it('automatically checks the parent requirement when all sub-requirements are checked', () => {
    const initial = { 'rf-1': false, 'rf-1-1': true, 'rf-1-2': false };
    const next = toggleChecklist(initial, 'rf-1-2', requirements);

    expect(next).toEqual({
      'rf-1': true,
      'rf-1-1': true,
      'rf-1-2': true,
    });
  });

  it('handles deeply nested sub-requirements recursively', () => {
    const checkedParent = toggleChecklist({}, 'rf-3', requirements);
    expect(checkedParent).toEqual({
      'rf-3': true,
      'rf-3-1': true,
      'rf-3-1-1': true,
    });

    const uncheckedLeaf = toggleChecklist(checkedParent, 'rf-3-1-1', requirements);
    expect(uncheckedLeaf).toEqual({
      'rf-3': false,
      'rf-3-1': false,
      'rf-3-1-1': false,
    });
  });

  it('persists valid checklist entries and ignores unknown ids', () => {
    saveChecklist({ 'rf-2': true, unknown: true });
    expect(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)).toContain('"rf-2":true');

    expect(loadChecklist(CHECKLIST_STORAGE_KEY, requirements)).toEqual({ 'rf-2': true });
  });
});

describe('timestamped checklist state and conflict resolution', () => {
  it('converts timestamped state to plain boolean state', () => {
    const tsState = {
      'rf-1': { value: true, timestamp: 100 },
      'rf-2': { value: false, timestamp: 200 },
    };
    expect(toPlainState(tsState)).toEqual({
      'rf-1': true,
      'rf-2': false,
    });
  });

  it('merges local and remote states based on "latest update wins" per item', () => {
    const localState = {
      'rf-1': { value: true, timestamp: 100 }, // older than remote
      'rf-2': { value: true, timestamp: 300 }, // newer than remote
      'rf-3': { value: false, timestamp: 200 }, // local only
    };

    const remoteState = {
      'rf-1': { value: false, timestamp: 200 }, // remote wins (200 > 100)
      'rf-2': { value: false, timestamp: 150 }, // local wins (300 > 150)
      'rf-4': { value: true, timestamp: 250 },  // remote only
    };

    const merged = mergeTimestampedStates(localState, remoteState);

    expect(merged['rf-1']).toEqual({ value: false, timestamp: 200 });
    expect(merged['rf-2']).toEqual({ value: true, timestamp: 300 });
    expect(merged['rf-3']).toEqual({ value: false, timestamp: 200 });
    expect(merged['rf-4']).toEqual({ value: true, timestamp: 250 });
  });

  it('toggles timestamped state and generates update payloads', () => {
    const initialTs = {
      'rf-2': { value: false, timestamp: 100 },
    };

    const { nextTsState, updates } = toggleTimestampedChecklist(initialTs, 'rf-2', 'back', 500, requirements);

    expect(nextTsState['rf-2']).toEqual({ value: true, timestamp: 500 });
    expect(updates).toContainEqual({ id: 'rf-2', type: 'back', value: true, timestamp: 500 });
  });

  it('loads timestamped checklist with migration from legacy boolean storage', () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    saveChecklist({ 'rf-2': true }, 'legacy-key');
    const loaded = loadTimestampedChecklist('legacy-key', requirements);

    expect(loaded['rf-2']).toEqual({ value: true, timestamp: 0 });
  });
});

describe('clearTimestampedBranch (mutual exclusion between the two checklists)', () => {
  const ts = (state: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(state).map(([id, value]) => [id, { value, timestamp: 1 }]));

  it('returns no updates when the branch is already clear', () => {
    const { nextTsState, updates } = clearTimestampedBranch(ts({ 'rf-2': true }), 'rf-1', 'back', 2, requirements);
    expect(updates).toEqual([]);
    expect(nextTsState['rf-2'].value).toBe(true);
  });

  it('clears the node and all its descendants', () => {
    const state = ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true, 'rf-2': true });
    const { nextTsState, updates } = clearTimestampedBranch(state, 'rf-1', 'back', 2, requirements);

    expect(toPlainState(nextTsState)).toEqual({ 'rf-1': false, 'rf-1-1': false, 'rf-1-2': false, 'rf-2': true });
    expect(updates.map((update) => update.id).sort()).toEqual(['rf-1', 'rf-1-1', 'rf-1-2']);
    expect(updates.every((update) => update.type === 'back' && update.value === false && update.timestamp === 2)).toBe(true);
  });

  it('re-derives ancestors that are no longer fully checked', () => {
    const state = ts({ 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true });
    const { nextTsState } = clearTimestampedBranch(state, 'rf-1-1', 'back', 2, requirements);

    expect(nextTsState['rf-1-1'].value).toBe(false);
    expect(nextTsState['rf-1'].value).toBe(false);
    expect(nextTsState['rf-1-2'].value).toBe(true);
  });

  it('clears a deeply nested branch through every level', () => {
    const state = ts({ 'rf-3': true, 'rf-3-1': true, 'rf-3-1-1': true });
    const { nextTsState } = clearTimestampedBranch(state, 'rf-3-1', 'full', 2, requirements);

    expect(toPlainState(nextTsState)).toEqual({ 'rf-3': false, 'rf-3-1': false, 'rf-3-1-1': false });
  });

  it('keeps an item out of both checklists when a parent is checked over a child of the other list', () => {
    // RF 1.1 marked as back-only, then RF 1 (the parent) marked as back+front.
    const back = ts({ 'rf-1-1': true });
    const { nextTsState: nextFull } = toggleTimestampedChecklist({}, 'rf-1', 'full', 2, requirements);
    const { nextTsState: nextBack } = clearTimestampedBranch(back, 'rf-1', 'back', 2, requirements);

    const backPlain = syncParentStates(requirements, toPlainState(nextBack));
    const fullPlain = syncParentStates(requirements, toPlainState(nextFull));

    expect(fullPlain['rf-1-1']).toBe(true);
    expect(backPlain['rf-1-1']).toBe(false);
    expect(countProgress(requirements, backPlain).completed).toBe(0);
    expect(countProgress(requirements, fullPlain).completed).toBe(3);
  });
});

describe('countDualProgress', () => {
  it('returns independent progress for back and full checklists', () => {
    const backState = { 'rf-1': true, 'rf-1-1': true, 'rf-1-2': true };
    const fullState = { 'rf-2': true };

    const progress = countDualProgress(requirements, backState, fullState);

    expect(progress.back.completed).toBe(3);
    expect(progress.back.total).toBe(7);
    expect(progress.full.completed).toBe(1);
    expect(progress.full.total).toBe(7);
  });

  it('returns zero progress for empty states', () => {
    const progress = countDualProgress(requirements, {}, {});
    expect(progress.back.completed).toBe(0);
    expect(progress.full.completed).toBe(0);
    expect(progress.back.percent).toBe(0);
    expect(progress.full.percent).toBe(0);
  });
});

describe('dual checklist storage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
  });

  it('persists and loads back checklist independently', () => {
    saveTimestampedChecklist({ 'rf-1': { value: true, timestamp: 100 } }, CHECKLIST_BACK_KEY);
    saveTimestampedChecklist({ 'rf-2': { value: true, timestamp: 100 } }, CHECKLIST_FULL_KEY);

    const backLoaded = loadTimestampedChecklist(CHECKLIST_BACK_KEY, requirements);
    const fullLoaded = loadTimestampedChecklist(CHECKLIST_FULL_KEY, requirements);

    expect(backLoaded['rf-1']).toEqual({ value: true, timestamp: 100 });
    expect(backLoaded['rf-2']).toBeUndefined();
    expect(fullLoaded['rf-2']).toEqual({ value: true, timestamp: 100 });
    expect(fullLoaded['rf-1']).toBeUndefined();
  });
});